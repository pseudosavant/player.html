const global = window;
// audio-thumbnail.js v1.0.0
// https://github.com/pseudosavant/audio-thumbnail.js
// License: MIT

const isAbortError = (e) => (e && (e.name === 'AbortError' || e.code === 20));

const _audioThumbnailActiveObjectURLs = new Set();

const nowMs = () => {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') return performance.now();
  return Date.now();
};

const defaults = {
  sources: ['sidecar', 'embedded'],
  sourceStrategy: 'race',
  sidecarNames: ['folder', 'cover', 'albumart', 'front', 'album', 'default', 'thumb', 'artwork', 'thumbnail'],
  sidecarExts: ['jpg', 'jpeg'],
  sidecarIncludeBasename: true,
  sidecarValidate: 'auto',
  sidecarConcurrency: 6,
  sidecarMaxResults: 1,
  sidecarCache: true,
  sidecarCacheKeyPrefix: 'audio-thumbnail.js',

  embedded: {
    maxBytes: 1000000,
    preferPicture: 'front'
  },

  output: {
    type: 'objectURL',
    mime: undefined,
    size: undefined
  },

  timeoutMs: 15000,
  fetch: (typeof fetch === 'function' ? fetch.bind(globalThis) : null),
  debug: false,
  onTiming: null,
  signal: null
};

const normalizeOptions = (options = {}) => {
  const out = {
    ...defaults,
    ...options,
    embedded: { ...defaults.embedded, ...(options.embedded || {}) },
    output: { ...defaults.output, ...(options.output || {}) }
  };
  if (!Array.isArray(out.sources)) out.sources = defaults.sources.slice();
  return out;
};

const extractEmbedded = async (url, opts) => {
  const u = new URL(url, location.href);
  const ext = (u.pathname.split('/').pop() || '').split('.').pop()?.toLowerCase() || '';

  const tryOrder = [];
  if (ext === 'mp3') tryOrder.push('mp3');
  if (ext === 'm4a' || ext === 'mp4') tryOrder.push('m4a');
  if (ext === 'mka' || ext === 'mkv') tryOrder.push('mka');
  if (tryOrder.length === 0) tryOrder.push('mp3', 'm4a', 'mka');

  const attempts = [];
  for (const kind of tryOrder) {
    try {
      if (kind === 'mp3') return await extractEmbeddedArtworkMP3(url, opts);
      if (kind === 'm4a') return await extractEmbeddedArtworkM4A(url, opts);
      if (kind === 'mka') return await extractEmbeddedArtworkMKA(url, opts);
    } catch (e) {
      attempts.push(`${kind}: ${e?.message || String(e)}`);
    }
  }
  const err = new Error(`Embedded artwork extraction failed. ${attempts.join(' | ')}`);
  err.attempts = attempts;
  throw err;
};

const materializeEmbeddedArtwork = async (embedded, options) => {
  const { output } = options;

  const wantsResize = !!(output && Number.isFinite(output.size));
  const wantsMime = !!(output && output.mime && output.mime.type);
  const wantsMimeChange = wantsMime && output.mime.type !== embedded.mime;
  const wantsQuality = wantsMime && typeof output.mime.quality === 'number';
  const wantsTranscode = wantsResize || wantsMimeChange || wantsQuality;

  if (!wantsTranscode) {
    if (output.type === 'dataURI') {
      const uri = bytesToDataURI(embedded.bytes, embedded.mime);
      return { URI: uri, outputMime: { type: embedded.mime } };
    }
    const uri = bytesToObjectURL(embedded.bytes, embedded.mime);
    trackObjectURL(uri);
    return { URI: uri, outputMime: { type: embedded.mime } };
  }

  const t0 = nowMs();
  const out = await transcodeImageBytesToOutput(embedded.bytes, embedded.mime, output);
  out.encodeMs = nowMs() - t0;
  if (out.type === 'objectURL') trackObjectURL(out.URI);
  return { URI: out.URI, outputMime: out.mime, width: out.width, height: out.height, encodeMs: out.encodeMs };
};

const audioThumbnail = async (url, options = {}) => {
  const opts = normalizeOptions(options);
  if (!opts.fetch) throw new Error('fetch() is not available in this environment.');
  const parentSignal = opts.signal || null;
  if (parentSignal?.aborted) throw (parentSignal.reason || new Error('aborted'));

  const tStart = nowMs();
  const timing = { totalMs: 0, fetchMsTotal: 0, decodeMsTotal: 0, encodeMsTotal: 0 };
  const results = [];
  const attempts = [];

  const onTiming = (e) => {
    if (typeof opts.onTiming === 'function') opts.onTiming(e);
  };

  const audioURL = new URL(url, location.href);

  if (opts.sourceStrategy === 'race' && opts.sources.includes('sidecar') && opts.sources.includes('embedded')) {
    if (opts.sidecarCache) {
      const groups = makeSidecarCandidateGroups(audioURL, opts);
      const mode = opts.sidecarValidate || 'auto';
      for (const urls of groups) {
        for (const u of urls) {
          const v = getCachedSidecarVerdict(u, opts, mode);
          if (v === true) {
            results.push({ URI: u, source: 'sidecar', kind: 'front' });
            timing.totalMs = nowMs() - tStart;
            const best = pickBestArtwork(results);
            defineHidden(results, 'best', best);
            defineHidden(results, 'timing', timing);
            return results;
          }
        }
      }
    }

    const sidecarController = new AbortController();
    const embeddedController = new AbortController();
    const onAbort = () => {
      try { sidecarController.abort(parentSignal?.reason || new Error('aborted')); } catch { /* ignore */ }
      try { embeddedController.abort(parentSignal?.reason || new Error('aborted')); } catch { /* ignore */ }
    };
    if (parentSignal) parentSignal.addEventListener('abort', onAbort, { once: true });

    const runSidecarR = async () => {
      const groups = makeSidecarCandidateGroups(audioURL, opts);
      if (opts.sidecarValidate === 'none') {
        const c = groups[0]?.[0];
        if (!c) throw new Error('No sidecar candidates generated');
        return { URI: c, source: 'sidecar', kind: 'front' };
      }

      const maxResults = 1;
      const concurrency = Math.max(1, opts.sidecarConcurrency | 0);

      const foundURLs = [];
      let i = 0;
      let active = 0;
      let stop = false;

      await new Promise((resolve) => {
        const pump = () => {
          while (!stop && active < concurrency && i < groups.length) {
            const urls = groups[i++];
            active++;
            (async () => {
              let hit = null;
              for (const c of urls) {
                const ok = await validateSidecarURL(c, opts, onTiming, sidecarController.signal).catch(() => false);
                if (ok) { hit = c; break; }
              }

              if (hit && !stop) {
                foundURLs.push(hit);
                if (foundURLs.length >= maxResults) {
                  stop = true;
                  try { sidecarController.abort(new Error('sidecar-found')); } catch { /* ignore */ }
                  active--;
                  resolve();
                  return;
                }
              }
              active--;
              if (!stop && active === 0 && i >= groups.length) resolve();
              else pump();
            })();
          }
        };
        pump();
      });

      if (foundURLs.length === 0) throw new Error('No valid sidecar URL found');
      return { URI: foundURLs[0], source: 'sidecar', kind: 'front' };
    };

    const runEmbeddedR = async () => {
      const embeddedList = await extractEmbedded(url, {
        fetch: opts.fetch,
        timeoutMs: opts.timeoutMs,
        maxBytes: opts.embedded.maxBytes,
        preferPicture: opts.embedded.preferPicture,
        onTiming,
        signal: embeddedController.signal
      });
      const first = embeddedList && embeddedList[0];
      if (!first) throw new Error('No embedded artwork extracted');
      return first;
    };

    let winner;
    try {
      winner = await Promise.any([
        runSidecarR().then((r) => ({ type: 'sidecar', r })),
        runEmbeddedR().then((e) => ({ type: 'embedded', e }))
      ]).catch((e) => {
        const msg = e?.errors?.map?.((x) => x?.message || String(x)).join(' | ') || (e?.message || String(e));
        throw new Error(`No artwork found. ${msg}`);
      });
    } finally {
      if (parentSignal) {
        try { parentSignal.removeEventListener('abort', onAbort); } catch { /* ignore */ }
      }
    }

    if (winner.type === 'sidecar') {
      try { embeddedController.abort(new Error('race-lost')); } catch { /* ignore */ }
      results.push(winner.r);
    } else {
      try { sidecarController.abort(new Error('race-lost')); } catch { /* ignore */ }
      const emb = winner.e;
      const t0 = nowMs();
      const materialized = await materializeEmbeddedArtwork(emb, opts);
      timing.encodeMsTotal += (nowMs() - t0);
      results.push({
        URI: materialized.URI,
        source: 'embedded',
        container: emb.container,
        kind: emb.kind || 'other',
        inputMime: emb.mime,
        outputMime: materialized.outputMime,
        width: materialized.width,
        height: materialized.height
      });
    }

    timing.totalMs = nowMs() - tStart;
    const best = pickBestArtwork(results);
    defineHidden(results, 'best', best);
    defineHidden(results, 'timing', timing);
    return results;
  }

  if (opts.sourceStrategy === 'all') {
    const sidecarTask = async () => {
      if (!opts.sources.includes('sidecar')) return;

      const groups = makeSidecarCandidateGroups(audioURL, opts);
      if (opts.sidecarValidate === 'none') {
        const flat = groups.flat();
        for (const c of flat.slice(0, Math.max(1, opts.sidecarMaxResults | 0))) {
          results.push({ URI: c, source: 'sidecar', kind: 'front' });
        }
        return;
      }

      const maxResults = Math.max(1, opts.sidecarMaxResults | 0);
      const concurrency = Math.max(1, opts.sidecarConcurrency | 0);
      const controller = new AbortController();
      const onAbort = () => {
        try { controller.abort(parentSignal?.reason || new Error('aborted')); } catch { /* ignore */ }
      };
      if (parentSignal) parentSignal.addEventListener('abort', onAbort, { once: true });

      const foundURLs = [];
      let i = 0;
      let active = 0;
      let stop = false;

      try {
        await new Promise((resolve) => {
          const pump = () => {
            while (!stop && active < concurrency && i < groups.length) {
              const urls = groups[i++];
              active++;
              (async () => {
                let hit = null;
                for (const c of urls) {
                  const t0 = nowMs();
                  const ok = await validateSidecarURL(c, opts, onTiming, controller.signal).catch((e) => {
                    if (!isAbortError(e)) attempts.push(`sidecar:${opts.sidecarValidate}:${c}: ${e?.message || String(e)}`);
                    return false;
                  });
                  timing.fetchMsTotal += (nowMs() - t0);
                  if (ok) { hit = c; break; }
                }

                if (hit && !stop) {
                  foundURLs.push(hit);
                  if (foundURLs.length >= maxResults) {
                    stop = true;
                    try { controller.abort(new Error('sidecar-found')); } catch { /* ignore */ }
                    active--;
                    resolve();
                    return;
                  }
                }

                active--;
                if (!stop && active === 0 && i >= groups.length) resolve();
                else pump();
              })();
            }
          };
          pump();
        });
      } finally {
        if (parentSignal) {
          try { parentSignal.removeEventListener('abort', onAbort); } catch { /* ignore */ }
        }
      }

      for (const c of foundURLs) results.push({ URI: c, source: 'sidecar', kind: 'front' });
    };

    const embeddedTask = async () => {
      if (!opts.sources.includes('embedded')) return;
      try {
        const embeddedList = await extractEmbedded(url, {
          fetch: opts.fetch,
          timeoutMs: opts.timeoutMs,
          maxBytes: opts.embedded.maxBytes,
          preferPicture: opts.embedded.preferPicture,
          onTiming,
          signal: parentSignal
        });

        for (const emb of embeddedList) {
          const t0 = nowMs();
          const materialized = await materializeEmbeddedArtwork(emb, opts);
          timing.encodeMsTotal += (nowMs() - t0);
          results.push({
            URI: materialized.URI,
            source: 'embedded',
            container: emb.container,
            kind: emb.kind || 'other',
            inputMime: emb.mime,
            outputMime: materialized.outputMime,
            width: materialized.width,
            height: materialized.height
          });
        }
      } catch (e) {
        attempts.push(`embedded:${e?.message || String(e)}`);
      }
    };

    await Promise.allSettled([sidecarTask(), embeddedTask()]);

    timing.totalMs = nowMs() - tStart;
    const best = pickBestArtwork(results);
    defineHidden(results, 'best', best);
    defineHidden(results, 'timing', timing);

    if (!best) throw new Error(`No artwork found. ${summarizeAttempts(attempts)}`);
    return results;
  }

  if (opts.sources.includes('sidecar')) {
    const groups = makeSidecarCandidateGroups(audioURL, opts);
    if (opts.sidecarValidate === 'none') {
      const flat = groups.flat();
      for (const c of flat.slice(0, opts.sidecarMaxResults)) {
        results.push({ URI: c, source: 'sidecar', kind: 'front' });
      }
    } else {
      const maxResults = Math.max(1, opts.sidecarMaxResults | 0);
      const concurrency = Math.max(1, opts.sidecarConcurrency | 0);
      const controller = new AbortController();
      const onAbort = () => {
        try { controller.abort(parentSignal?.reason || new Error('aborted')); } catch { /* ignore */ }
      };
      if (parentSignal) parentSignal.addEventListener('abort', onAbort, { once: true });

      const foundURLs = [];
      let i = 0;
      let active = 0;
      let stop = false;

      try {
        await new Promise((resolve) => {
          const pump = () => {
            while (!stop && active < concurrency && i < groups.length) {
              const urls = groups[i++];
              active++;
              (async () => {
                let hit = null;
                for (const c of urls) {
                  const t0 = nowMs();
                  const ok = await validateSidecarURL(c, opts, onTiming, controller.signal).catch((e) => {
                    if (!isAbortError(e)) attempts.push(`sidecar:${opts.sidecarValidate}:${c}: ${e?.message || String(e)}`);
                    return false;
                  });
                  timing.fetchMsTotal += (nowMs() - t0);
                  if (ok) { hit = c; break; }
                }

                if (hit && !stop) {
                  foundURLs.push(hit);
                  if (foundURLs.length >= maxResults) {
                    stop = true;
                    try { controller.abort(new Error('sidecar-found')); } catch { /* ignore */ }
                    active--;
                    resolve();
                    return;
                  }
                }

                active--;
                if (!stop && active === 0 && i >= groups.length) {
                  resolve();
                  return;
                }
                pump();
              })();
            }
          };
          pump();
        });

        for (const c of foundURLs) results.push({ URI: c, source: 'sidecar', kind: 'front' });
      } finally {
        if (parentSignal) {
          try { parentSignal.removeEventListener('abort', onAbort); } catch { /* ignore */ }
        }
      }
    }
  }

  if (results.length === 0 && opts.sources.includes('embedded')) {
    try {
      const embeddedList = await extractEmbedded(url, {
        fetch: opts.fetch,
        timeoutMs: opts.timeoutMs,
        maxBytes: opts.embedded.maxBytes,
        preferPicture: opts.embedded.preferPicture,
        onTiming,
        signal: parentSignal
      });

      for (const emb of embeddedList) {
        const t0 = nowMs();
        const materialized = await materializeEmbeddedArtwork(emb, opts);
        timing.encodeMsTotal += (nowMs() - t0);
        results.push({
          URI: materialized.URI,
          source: 'embedded',
          container: emb.container,
          kind: emb.kind || 'other',
          inputMime: emb.mime,
          outputMime: materialized.outputMime,
          width: materialized.width,
          height: materialized.height
        });
      }
    } catch (e) {
      attempts.push(`embedded:${e?.message || String(e)}`);
    }
  }

  timing.totalMs = nowMs() - tStart;
  const best = pickBestArtwork(results);

  defineHidden(results, 'best', best);
  defineHidden(results, 'timing', timing);

  if (!best) {
    throw new Error(`No artwork found. ${summarizeAttempts(attempts)}`);
  }
  return results;
};

audioThumbnail.cleanupObjectURLs = () => cleanupObjectURLs();
audioThumbnail.clearCanvasPool = () => clearCanvasPool();
audioThumbnail.getMemoryUsage = () => ({
  canvasPoolEntries: getCanvasPoolEntries(),
  activeObjectURLs: getActiveObjectURLCount()
});

global.audioThumbnail = audioThumbnail;

const textDecoder = new TextDecoder('utf-8');

const readVint = (b, o, mask) => {
  if (o >= b.length) return null;
  const first = b[o];
  let len = 0;
  for (let i = 0; i < 8; i++) {
    if (first & (1 << (7 - i))) { len = i + 1; break; }
  }
  if (!len || o + len > b.length) return null;

  let val = 0;
  if (mask) {
    val = first & ((1 << (8 - len)) - 1);
  } else {
    val = first;
  }
  for (let i = 1; i < len; i++) val = (val << 8) | b[o + i];

  let unknown = false;
  if (mask) {
    const allOnes = (len === 1)
      ? (val === 0x7f)
      : (val === ((1 << (7 * len)) - 1));
    unknown = allOnes;
  }
  return { len, val, unknown };
};

const ID_ATTACHMENTS = 0x1941A469;
const ID_SEGMENT = 0x18538067;
const ID_ATTACHED_FILE = 0x61A7;
const ID_FILE_NAME = 0x466E;
const ID_FILE_MIME = 0x4660;
const ID_FILE_DATA = 0x465C;

const bytesToString = (b) => {
  try { return textDecoder.decode(b); } catch { return ''; }
};

const hasAscii = (b, s) => {
  const pat = new TextEncoder().encode(s);
  for (let i = 0; i + pat.length <= b.length; i++) {
    let ok = true;
    for (let j = 0; j < pat.length; j++) {
      if (b[i + j] !== pat[j]) { ok = false; break; }
    }
    if (ok) return true;
  }
  return false;
};

const extractFirstJPEGStream = (b, minBytes = 2048) => {
  for (let i = 0; i + 3 < b.length; i++) {
    if (b[i] !== 0xff || b[i + 1] !== 0xd8) continue;

    for (let j = i + 2; j + 1 < b.length; j++) {
      if (b[j] === 0xff && b[j + 1] === 0xd9) {
        const end = j + 2;
        const len = end - i;
        if (len >= minBytes) return b.subarray(i, end);
        i = end - 1;
        break;
      }
    }
  }
  return null;
};

const parseElements = (b, start, end, onElement) => {
  let p = start;
  while (p < end) {
    const idV = readVint(b, p, false);
    if (!idV) return;
    p += idV.len;

    const sizeV = readVint(b, p, true);
    if (!sizeV) return;
    p += sizeV.len;

    const dataStart = p;
    let dataEnd = sizeV.unknown ? end : (p + sizeV.val);
    if (dataEnd > end) dataEnd = end;

    onElement(idV.val, dataStart, dataEnd);
    p = dataEnd;
  }
};

const looksLikeCoverName = (name) => {
  const n = (name || '').toLowerCase();
  return n.includes('cover') || n.includes('front') || n.includes('folder') || n.includes('art');
};

const extractEmbeddedArtworkMKV = async (url, opts) => {
  const { fetch, timeoutMs, maxBytes, preferPicture, signal } = opts || {};

  const b = await fetchBytes(url, { fetch, timeoutMs, maxBytes, signal });
  if (b.length < 32) throw new Error('MKV too small');

  const out = [];

  const parseAttachedFile = (start, end) => {
    let fileName = '';
    let mime = '';
    let fileData = null;

    parseElements(b, start, end, (id, ds, de) => {
      if (id === ID_FILE_NAME) fileName = bytesToString(b.subarray(ds, de));
      else if (id === ID_FILE_MIME) mime = bytesToString(b.subarray(ds, de));
      else if (id === ID_FILE_DATA) fileData = b.subarray(ds, de);
    });

    if (!fileData || fileData.length === 0) return;
    if (!mime) {
      if (fileData[0] === 0xff && fileData[1] === 0xd8) mime = 'image/jpeg';
      else if (fileData[0] === 0x89 && fileData[1] === 0x50 && fileData[2] === 0x4e && fileData[3] === 0x47) mime = 'image/png';
      else if (fileData[0] === 0x52 && fileData[1] === 0x49 && fileData[2] === 0x46 && fileData[3] === 0x46) mime = 'image/webp';
      else mime = 'application/octet-stream';
    }
    if (!mime.startsWith('image/')) return;

    const kind = looksLikeCoverName(fileName) ? 'front' : 'other';
    out.push({ bytes: fileData, mime, kind, container: 'mka', fileName });
  };

  const parseAttachments = (start, end) => {
    parseElements(b, start, end, (id, ds, de) => {
      if (id === ID_ATTACHED_FILE) parseAttachedFile(ds, de);
    });
  };

  const parseSegment = (start, end) => {
    parseElements(b, start, end, (id, ds, de) => {
      if (id === ID_ATTACHMENTS) parseAttachments(ds, de);
    });
  };

  parseElements(b, 0, b.length, (id, ds, de) => {
    if (id === ID_SEGMENT) parseSegment(ds, de);
    if (id === ID_ATTACHMENTS) parseAttachments(ds, de);
  });

  if (out.length === 0) {
    if (hasAscii(b, 'V_MJPEG')) {
      const jpg = extractFirstJPEGStream(b, 4096);
      if (jpg) out.push({ bytes: jpg, mime: 'image/jpeg', kind: 'front', container: 'mka' });
    }
  }

  if (out.length === 0) throw new Error('No MKV artwork found (no attachments, no detectable cover stream)');

  if (preferPicture === 'front') {
    const front = out.filter((x) => x.kind === 'front');
    return (front.length ? front : out);
  }
  return out;
};

const extractEmbeddedArtworkMKA = async (url, opts) => {
  const out = await extractEmbeddedArtworkMKV(url, opts);
  return out.map((x) => ({ ...x, container: 'mka' }));
};

const u64be = (b, o) => {
  const hi = u32be(b, o);
  const lo = u32be(b, o + 4);
  return hi * 2 ** 32 + lo;
};

function *iterBoxes(b, start, end) {
  let p = start;
  while (p + 8 <= end) {
    let size = u32be(b, p);
    const type = bytesToAscii(b, p + 4, 4);
    let header = 8;
    if (size === 1) {
      if (p + 16 > end) break;
      size = u64be(b, p + 8);
      header = 16;
    } else if (size === 0) {
      size = end - p;
    }
    if (!size || size < header) break;
    const boxStart = p;
    const boxEnd = Math.min(end, p + size);
    const dataStart = p + header;
    yield { type, start: boxStart, end: boxEnd, header, dataStart };
    p = boxEnd;
  }
}

const findChildBox = (b, parent, type) => {
  for (const box of iterBoxes(b, parent.dataStart, parent.end)) {
    if (box.type === type) return box;
  }
  return null;
};

const extractCovrFromIlst = (b, ilstBox) => {
  for (const item of iterBoxes(b, ilstBox.dataStart, ilstBox.end)) {
    if (item.type !== 'covr') continue;

    for (const child of iterBoxes(b, item.dataStart, item.end)) {
      if (child.type !== 'data') continue;

      const p = child.dataStart;
      if (p + 8 > child.end) continue;

      const sniffMimeAt = (off) => {
        if (off + 12 > child.end) return null;
        const x = b.subarray(off, off + 12);
        if (x[0] === 0xff && x[1] === 0xd8) return 'image/jpeg';
        if (x[0] === 0x89 && x[1] === 0x50 && x[2] === 0x4e && x[3] === 0x47) return 'image/png';
        if (x[0] === 0x52 && x[1] === 0x49 && x[2] === 0x46 && x[3] === 0x46 && x[8] === 0x57 && x[9] === 0x45 && x[10] === 0x42 && x[11] === 0x50) return 'image/webp';
        return null;
      };

      const starts = [p + 8, p + 12, p + 16].filter((s) => s < child.end);
      let payloadStart = starts[0];
      let mime = null;
      for (const s of starts) {
        const m = sniffMimeAt(s);
        if (m) {
          payloadStart = s;
          mime = m;
          break;
        }
      }
      const payload = b.subarray(payloadStart, child.end);
      if (!mime) mime = sniffMimeAt(payloadStart) || 'application/octet-stream';

      return { bytes: payload, mime, kind: 'front', container: 'm4a' };
    }
  }
  return null;
};

const extractEmbeddedArtworkM4A = async (url, opts) => {
  const { fetch, timeoutMs, maxBytes, signal } = opts || {};

  const b = await fetchBytes(url, { fetch, timeoutMs, maxBytes, signal });
  if (b.length < 16) throw new Error('M4A too small');

  const root = { type: 'root', dataStart: 0, end: b.length };

  const moov = findChildBox(b, root, 'moov');
  if (!moov) throw new Error('No moov box found');

  const udta = findChildBox(b, moov, 'udta');
  if (!udta) throw new Error('No udta box found');
  const meta = findChildBox(b, udta, 'meta');
  if (!meta) throw new Error('No meta box found');

  const metaAsContainer = { ...meta, dataStart: meta.dataStart + 4 };
  const ilst = findChildBox(b, metaAsContainer, 'ilst');
  if (!ilst) throw new Error('No ilst box found');

  const covr = extractCovrFromIlst(b, ilst);
  if (!covr) throw new Error('No covr artwork found');

  return [covr];
};

const canvasPool = new Map();

const getCanvas = (width, height) => {
  const key = `${width}x${height}`;
  if (canvasPool.has(key)) {
    const canvas = canvasPool.get(key);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, width, height);
    return { canvas, ctx };
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvasPool.set(key, canvas);
  const ctx = canvas.getContext('2d');
  return { canvas, ctx };
};

const clearCanvasPool = () => {
  const n = canvasPool.size;
  canvasPool.clear();
  return n > 0;
};

const getCanvasPoolEntries = () => canvasPool.size;

const decodeToBitmap = async (bytes, mime) => {
  const blob = new Blob([bytes], { type: mime || 'application/octet-stream' });
  if (typeof createImageBitmap === 'function') {
    return await createImageBitmap(blob);
  }
  const uri = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = 'async';
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = uri;
    });
    return img;
  } finally {
    try { URL.revokeObjectURL(uri); } catch { /* ignore */ }
  }
};

const canvasToBlob = (canvas, mime, quality) => {
  if (canvas && typeof canvas.convertToBlob === 'function') {
    return canvas.convertToBlob({ type: mime, quality });
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) reject(new Error('toBlob returned null'));
      else resolve(blob);
    }, mime, quality);
  });
};

const transcodeImageBytesToOutput = async (bytes, inputMime, output) => {
  const outMime = output?.mime?.type || inputMime || 'image/jpeg';
  const quality = output?.mime?.quality;
  const size = output?.size;
  const type = output?.type || 'objectURL';

  const bitmap = await decodeToBitmap(bytes, inputMime);
  const srcW = bitmap.width || bitmap.naturalWidth;
  const srcH = bitmap.height || bitmap.naturalHeight;
  if (!srcW || !srcH) throw new Error('Unable to determine image dimensions');

  const dstW = size ? Math.max(1, Math.round(size)) : srcW;
  const dstH = size ? Math.max(1, Math.round((srcH * dstW) / srcW)) : srcH;

  const { canvas, ctx } = getCanvas(dstW, dstH);
  ctx.drawImage(bitmap, 0, 0, dstW, dstH);

  try { bitmap.close?.(); } catch { /* ignore */ }

  if (type === 'dataURI') {
    const uri = canvas.toDataURL(outMime, quality);
    return { URI: uri, type: 'dataURI', mime: { type: outMime, quality }, width: dstW, height: dstH };
  }

  const blob = await canvasToBlob(canvas, outMime, quality);
  const uri = URL.createObjectURL(blob);
  return { URI: uri, type: 'objectURL', mime: { type: outMime, quality }, width: dstW, height: dstH };
};

const u32be = (b, o) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
const synchsafe32 = (b, o) => ((b[o] & 0x7f) << 21) | ((b[o + 1] & 0x7f) << 14) | ((b[o + 2] & 0x7f) << 7) | (b[o + 3] & 0x7f);
const bytesToAscii = (b, o, n) => String.fromCharCode.apply(null, b.subarray(o, o + n));

const findTerminator = (b, start, encoding) => {
  if (encoding === 0 || encoding === 3) {
    for (let i = start; i < b.length; i++) if (b[i] === 0x00) return i;
    return -1;
  }
  for (let i = start; i + 1 < b.length; i++) if (b[i] === 0x00 && b[i + 1] === 0x00) return i;
  return -1;
};

const mimeFromPICFormat = (fmt3) => {
  const f = (fmt3 || '').toUpperCase();
  if (f === 'JPG' || f === 'JPEG') return 'image/jpeg';
  if (f === 'PNG') return 'image/png';
  if (f === 'WEB') return 'image/webp';
  return 'application/octet-stream';
};

const kindFromPictureType = (pt) => (pt === 3 ? 'front' : 'other');

const parseAPIC = (frameBytes) => {
  if (frameBytes.length < 4) return null;
  const enc = frameBytes[0];
  let p = 1;
  const mimeEnd = frameBytes.indexOf(0x00, p);
  if (mimeEnd < 0) return null;
  const mime = bytesToAscii(frameBytes, p, mimeEnd - p);
  p = mimeEnd + 1;
  if (p >= frameBytes.length) return null;
  const picType = frameBytes[p++];

  const descEnd = findTerminator(frameBytes, p, enc);
  if (descEnd < 0) return null;
  p = (enc === 0 || enc === 3) ? (descEnd + 1) : (descEnd + 2);
  if (p >= frameBytes.length) return null;

  if (mime === '-->') return null;
  const bytes = frameBytes.subarray(p);
  return { bytes, mime, kind: kindFromPictureType(picType) };
};

const parsePIC = (frameBytes) => {
  if (frameBytes.length < 6) return null;
  const enc = frameBytes[0];
  const fmt3 = bytesToAscii(frameBytes, 1, 3);
  let p = 4;
  const picType = frameBytes[p++];
  const descEnd = findTerminator(frameBytes, p, enc);
  if (descEnd < 0) return null;
  p = (enc === 0 || enc === 3) ? (descEnd + 1) : (descEnd + 2);
  if (p >= frameBytes.length) return null;
  const mime = mimeFromPICFormat(fmt3);
  const bytes = frameBytes.subarray(p);
  return { bytes, mime, kind: kindFromPictureType(picType) };
};

const extractEmbeddedArtworkMP3 = async (url, opts) => {
  const { fetch, timeoutMs, maxBytes, preferPicture, signal } = opts || {};

  const head = await fetchBytes(url, { fetch, timeoutMs, maxBytes: 64, allowTruncate: true, signal, range: { start: 0, end: 9 } });
  if (head.length < 10) throw new Error('MP3 too small');
  if (bytesToAscii(head, 0, 3) !== 'ID3') throw new Error('No ID3v2 tag found');

  const verMajor = head[3];
  const flags = head[5];
  const tagSize = synchsafe32(head, 6);
  const total = 10 + tagSize;
  if (total > maxBytes) throw new Error(`ID3 tag size (${total}) exceeds maxBytes (${maxBytes})`);

  const tag = await fetchBytes(url, { fetch, timeoutMs, maxBytes: total, allowTruncate: true, signal, range: { start: 0, end: total - 1 } });
  if (tag.length < total) throw new Error(`Unable to fetch full ID3 tag (${tag.length}/${total} bytes)`);
  let p = 10;

  if (flags & 0x40) {
    if (verMajor === 3) {
      const extSize = u32be(tag, p);
      p += 4 + extSize;
    } else if (verMajor === 4) {
      const extSize = synchsafe32(tag, p);
      p += extSize;
    } else {
      throw new Error(`Unsupported ID3 version: 2.${verMajor}`);
    }
  }

  const out = [];
  while (p + 6 < tag.length) {
    if (tag[p] === 0x00) break;

    if (verMajor === 2) {
      const id = bytesToAscii(tag, p, 3);
      const size = ((tag[p + 3] << 16) | (tag[p + 4] << 8) | tag[p + 5]) >>> 0;
      p += 6;
      if (!id.trim() || size === 0 || p + size > tag.length) break;
      const frame = tag.subarray(p, p + size);
      p += size;
      if (id === 'PIC') {
        const pic = parsePIC(frame);
        if (pic) out.push({ ...pic, container: 'mp3' });
      }
      continue;
    }

    if (p + 10 > tag.length) break;
    const id = bytesToAscii(tag, p, 4);
    const size = (verMajor === 4) ? synchsafe32(tag, p + 4) : u32be(tag, p + 4);
    p += 10;
    if (!id.trim() || size === 0 || p + size > tag.length) break;
    const frame = tag.subarray(p, p + size);
    p += size;

    if (id === 'APIC') {
      const pic = parseAPIC(frame);
      if (pic) out.push({ ...pic, container: 'mp3' });
    }
  }

  if (out.length === 0) throw new Error('No embedded pictures found in ID3 tag');

  if (preferPicture === 'front') {
    const front = out.filter((x) => x.kind === 'front');
    return (front.length ? front : out);
  }
  return out;
};

const stripExtension = (filename) => {
  const i = filename.lastIndexOf('.');
  if (i <= 0) return filename;
  return filename.slice(0, i);
};

const makeSidecarCandidates = (audioURL, opts) => {
  const candidates = [];

  const add = (filename) => {
    const resolved = opts.resolveSidecarURL
      ? opts.resolveSidecarURL(audioURL, filename)
      : new URL(filename, audioURL);
    const u = (resolved instanceof URL) ? resolved : new URL(String(resolved), audioURL);
    candidates.push(u.toString());
  };

  for (const name of opts.sidecarNames || []) {
    for (const ext of opts.sidecarExts || []) add(`${name}.${ext}`);
  }

  if (opts.sidecarIncludeBasename) {
    const leaf = audioURL.pathname.split('/').pop() || '';
    const base = stripExtension(leaf);
    if (base) {
      for (const ext of opts.sidecarExts || []) add(`${base}.${ext}`);
    }
  }

  return [...new Set(candidates)];
};

const makeSidecarCandidateGroups = (audioURL, opts) => {
  const groups = [];

  const resolve = (filename) => {
    const resolved = opts.resolveSidecarURL
      ? opts.resolveSidecarURL(audioURL, filename)
      : new URL(filename, audioURL);
    const u = (resolved instanceof URL) ? resolved : new URL(String(resolved), audioURL);
    return u.toString();
  };

  const stems = [];
  for (const name of opts.sidecarNames || []) stems.push(String(name));

  if (opts.sidecarIncludeBasename) {
    const leaf = audioURL.pathname.split('/').pop() || '';
    const base = stripExtension(leaf);
    if (base) stems.push(base);
  }

  const seenStem = new Set();
  for (const stem of stems) {
    if (!stem) continue;
    if (seenStem.has(stem)) continue;
    seenStem.add(stem);

    const urls = [];
    const seenURL = new Set();
    for (const ext of opts.sidecarExts || []) {
      const u = resolve(`${stem}.${ext}`);
      if (seenURL.has(u)) continue;
      seenURL.add(u);
      urls.push(u);
    }
    if (urls.length) groups.push(urls);
  }

  return groups;
};

const getSessionStorage = () => {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    sessionStorage.length;
    return sessionStorage;
  } catch {
    return null;
  }
};

const cacheKey = (opts, method, url) => {
  const prefix = opts.sidecarCacheKeyPrefix || 'audio-thumbnail.js';
  return `${prefix}:sidecar:${method}:${url}`;
};

const cacheGet = (opts, method, url) => {
  if (!opts.sidecarCache) return { hit: false };
  const ss = getSessionStorage();
  if (!ss) return { hit: false };
  const v = ss.getItem(cacheKey(opts, method, url));
  if (v === null) return { hit: false };
  if (v === '1') return { hit: true, val: true };
  if (v === '0') return { hit: true, val: false };
  if (v === '-1') return { hit: true, val: null };
  return { hit: false };
};

const cacheSet = (opts, method, url, val) => {
  if (!opts.sidecarCache) return;
  const ss = getSessionStorage();
  if (!ss) return;
  const v = (val === true) ? '1' : (val === false) ? '0' : '-1';
  try { ss.setItem(cacheKey(opts, method, url), v); } catch { /* ignore */ }
};

const getCachedSidecarVerdict = (url, opts, mode = null) => {
  const m = mode || opts?.sidecarValidate || 'auto';
  const cached = cacheGet(opts || {}, `any:${m}`, url);
  if (!cached.hit) return undefined;
  return cached.val;
};

const withTimeoutSignal = (parentSignal, timeoutMs) => {
  const controller = new AbortController();
  const onAbort = () => {
    try { controller.abort(parentSignal?.reason || new Error('aborted')); } catch { /* ignore */ }
  };
  if (parentSignal) {
    if (parentSignal.aborted) onAbort();
    else parentSignal.addEventListener('abort', onAbort, { once: true });
  }
  const timeoutId = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs);
  const cleanup = () => {
    clearTimeout(timeoutId);
    if (parentSignal) {
      try { parentSignal.removeEventListener('abort', onAbort); } catch { /* ignore */ }
    }
  };
  return { controller, signal: controller.signal, cleanup };
};

const validateHead = async (url, opts, parentSignal) => {
  const cached = cacheGet(opts, 'head', url);
  if (cached.hit) return cached.val;

  const { signal, cleanup } = withTimeoutSignal(parentSignal, opts.timeoutMs);
  try {
    const res = await opts.fetch(url, { method: 'HEAD', signal });
    if (res.ok) {
      const ct = res.headers?.get?.('content-type') || '';
      if (ct && !ct.toLowerCase().startsWith('image/')) return false;
      return true;
    }

    if (res.status === 404 || res.status === 410) return false;
    return null;
  } catch (e) {
    if (isAbortError(e) || parentSignal?.aborted) throw e;
    return null;
  } finally {
    cleanup();
  }
};

const validateGetRange = async (url, opts, parentSignal) => {
  const cached = cacheGet(opts, 'get-range', url);
  if (cached.hit) return cached.val;

  const { controller, signal, cleanup } = withTimeoutSignal(parentSignal, opts.timeoutMs);
  try {
    const headers = new Headers();
    headers.set('Range', 'bytes=0-0');
    const res = await opts.fetch(url, { method: 'GET', headers, signal });

    try { res.body?.cancel?.(); } catch { /* ignore */ }
    try { controller.abort(); } catch { /* ignore */ }

    if (res.status === 206 || res.status === 200) {
      const ct = res.headers?.get?.('content-type') || '';
      if (ct && !ct.toLowerCase().startsWith('image/')) return false;
      return true;
    }

    if (res.status === 404 || res.status === 410) return false;
    return null;
  } catch (e) {
    if (isAbortError(e) || parentSignal?.aborted) throw e;
    return null;
  } finally {
    cleanup();
  }
};

const validateImg = (url, opts, parentSignal) => {
  const cached = cacheGet(opts, 'img', url);
  if (cached.hit) return Promise.resolve(cached.val === true);

  return new Promise((resolve, reject) => {
    const img = new Image();
    let done = false;

    const timeoutId = setTimeout(() => finish(false), opts.timeoutMs);

    const finish = (ok) => {
      if (done) return;
      done = true;
      clearTimeout(timeoutId);
      img.onload = null;
      img.onerror = null;
      if (parentSignal) {
        try { parentSignal.removeEventListener('abort', onAbort); } catch { /* ignore */ }
      }
      cacheSet(opts, 'img', url, ok);
      resolve(ok);
    };

    const onAbort = () => {
      if (done) return;
      try { img.src = ''; } catch { /* ignore */ }
      clearTimeout(timeoutId);
      img.onload = null;
      img.onerror = null;
      try { parentSignal.removeEventListener('abort', onAbort); } catch { /* ignore */ }
      done = true;
      reject(parentSignal?.reason || new DOMException('Aborted', 'AbortError'));
    };

    if (parentSignal) {
      if (parentSignal.aborted) return onAbort();
      parentSignal.addEventListener('abort', onAbort, { once: true });
    }

    img.decoding = 'async';
    img.onload = () => finish(true);
    img.onerror = () => finish(false);
    img.src = url;
  });
};

const validateSidecarURL = async (url, opts, onTiming, signal = null) => {
  if (signal?.aborted) throw (signal.reason || new DOMException('Aborted', 'AbortError'));

  const mode = opts.sidecarValidate || 'auto';
  const cachedAny = cacheGet(opts, `any:${mode}`, url);
  if (cachedAny.hit && cachedAny.val !== null) return cachedAny.val === true;

  const t0 = nowMs();

  const emit = (when, extra) => {
    if (typeof onTiming === 'function') onTiming({ phase: 'sidecar-validate', when, ts: nowMs(), url, mode, ...extra });
  };

  const cacheMaybeSet = (method, val) => {
    if (signal?.aborted) return;
    cacheSet(opts, method, url, val);
  };

  emit('start');
  try {
    let result = false;

    if (mode === 'head') {
      const v = await validateHead(url, opts, signal);
      cacheMaybeSet('head', v);
      result = (v === true);
      cacheMaybeSet(`any:${mode}`, result);
      return result;
    }

    if (mode === 'get-range') {
      const v = await validateGetRange(url, opts, signal);
      cacheMaybeSet('get-range', v);
      result = (v === true);
      cacheMaybeSet(`any:${mode}`, result);
      return result;
    }

    if (mode === 'img') {
      result = await validateImg(url, opts, signal);
      cacheMaybeSet(`any:${mode}`, result);
      return result;
    }

    if (mode === 'none') {
      cacheMaybeSet(`any:${mode}`, true);
      return true;
    }

    try {
      const head = await validateHead(url, opts, signal);
      cacheMaybeSet('head', head);
      if (head === true) {
        cacheMaybeSet(`any:${mode}`, true);
        return true;
      }
      if (head === false) {
        cacheMaybeSet(`any:${mode}`, false);
        return false;
      }
    } catch {
      if (signal?.aborted) throw (signal.reason || new DOMException('Aborted', 'AbortError'));
    }
    try {
      const get = await validateGetRange(url, opts, signal);
      cacheMaybeSet('get-range', get);
      if (get === true) {
        cacheMaybeSet(`any:${mode}`, true);
        return true;
      }
      if (get === false) {
        cacheMaybeSet(`any:${mode}`, false);
        return false;
      }
    } catch {
      if (signal?.aborted) throw (signal.reason || new DOMException('Aborted', 'AbortError'));
    }
    result = await validateImg(url, opts, signal);
    cacheMaybeSet(`any:${mode}`, result);
    return result;
  } finally {
    emit('end', { ms: nowMs() - t0 });
  }
};

const defineHidden = (obj, key, value) => {
  Object.defineProperty(obj, key, {
    value,
    enumerable: false,
    configurable: true,
    writable: true
  });
};

const pickBestArtwork = (results) => {
  if (!results || results.length === 0) return null;
  const front = results.find((r) => r && r.kind === 'front');
  return front || results[0];
};

const summarizeAttempts = (attempts) => {
  if (!attempts || attempts.length === 0) return '';
  const max = 8;
  const head = attempts.slice(0, max).join(' | ');
  const more = attempts.length > max ? ` | (+${attempts.length - max} more)` : '';
  return `Attempts: ${head}${more}`;
};

const bytesToObjectURL = (bytes, mime) => {
  const blob = new Blob([bytes], { type: mime || 'application/octet-stream' });
  return URL.createObjectURL(blob);
};

const bytesToDataURI = (bytes, mime) => {
  const bin = [];
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin.push(String.fromCharCode.apply(null, bytes.subarray(i, i + chunk)));
  }
  const b64 = btoa(bin.join(''));
  return `data:${mime || 'application/octet-stream'};base64,${b64}`;
};

const trackObjectURL = (uri) => {
  if (typeof uri === 'string' && uri.startsWith('blob:')) _audioThumbnailActiveObjectURLs.add(uri);
};

const cleanupObjectURLs = () => {
  let n = 0;
  for (const uri of _audioThumbnailActiveObjectURLs) {
    try {
      URL.revokeObjectURL(uri);
      n++;
    } catch {
      // ignore
    }
  }
  _audioThumbnailActiveObjectURLs.clear();
  return n;
};

const getActiveObjectURLCount = () => _audioThumbnailActiveObjectURLs.size;

const fetchBytes = async (url, opts) => {
  const {
    fetch,
    timeoutMs = 15000,
    maxBytes = 8000000,
    allowTruncate = false,
    signal = null,
    range = null
  } = opts || {};

  if (typeof fetch !== 'function') throw new Error('fetchBytes: fetch is required');

  const controller = new AbortController();
  const onAbort = () => {
    try { controller.abort(signal?.reason || new Error('aborted')); } catch { /* ignore */ }
  };
  if (signal) {
    if (signal.aborted) onAbort();
    else signal.addEventListener('abort', onAbort, { once: true });
  }
  const timeoutId = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs);

  try {
    const headers = new Headers();
    if (range && Number.isFinite(range.start) && Number.isFinite(range.end) && range.start >= 0 && range.end >= range.start) {
      headers.set('Range', `bytes=${range.start}-${range.end}`);
    }

    const res = await fetch(url, { method: 'GET', headers, signal: controller.signal });
    if (!res.ok && res.status !== 206) {
      throw new Error(`HTTP ${res.status} ${res.statusText || ''}`.trim());
    }

    if (res.body && typeof res.body.getReader === 'function') {
      const reader = res.body.getReader();
      const chunks = [];
      let total = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          total += value.byteLength;
          if (total > maxBytes) {
            if (!allowTruncate) {
              try { controller.abort(new Error('maxBytes')); } catch { /* ignore */ }
              try { reader.cancel(); } catch { /* ignore */ }
              throw new Error(`Response exceeded maxBytes (${maxBytes})`);
            }

            const over = total - maxBytes;
            const keepLen = value.byteLength - over;
            if (keepLen > 0) chunks.push(value.subarray(0, keepLen));
            total = maxBytes;
            try { reader.cancel(); } catch { /* ignore */ }
            break;
          }
          chunks.push(value);
        }
      }
      const out = new Uint8Array(total);
      let off = 0;
      for (const c of chunks) {
        out.set(c, off);
        off += c.byteLength;
      }
      return out;
    }

    const ab = await res.arrayBuffer();
    if (ab.byteLength > maxBytes) throw new Error(`Response exceeded maxBytes (${maxBytes})`);
    return new Uint8Array(ab);
  } finally {
    clearTimeout(timeoutId);
    if (signal) {
      try { signal.removeEventListener('abort', onAbort); } catch { /* ignore */ }
    }
  }
};
