    const global = window;
    // video-thumbnail.js v2.0.2
    // https://github.com/pseudosavant/video-thumbnail.js
    // Â© 2025 Paul Ellis (https://github.com/pseudosavant)
    // License: MIT
    
    const defaults = {
      timestamps: [0.1],
      size: 480,
      mime: { type: 'image/jpeg', quality: 0.5 },
      type: 'dataURI',
      cache: false,
      cacheKeyPrefix: 'video-thumbnail.js',
      debug: false
    };
    
    const round = (val, digits) => +val.toFixed(digits);
    
    let lastDebug = defaults.debug;
    let lastCacheKeyPrefix = defaults.cacheKeyPrefix;
    
    const store = (key, val, debug = false, cacheKeyPrefix = defaults.cacheKeyPrefix) => {
      try {
        localStorage.setItem(key, val);
        if (debug) console.info(`[${cacheKeyPrefix}] Persisted to localStorage: ${key}`);
        return true;
      } catch (e) {
        if (e.name === 'QuotaExceededError') {
          if (debug) console.warn(`[${cacheKeyPrefix}] localStorage quota exceeded: unable to persist ${key}`)
        } else {
          if (debug) console.warn(`[${cacheKeyPrefix}] Failed to store in localStorage: ${key} (${e.name})`, e);
        }
        return null;
      }
    }
    
    const retrieve = (key, debug = false, cacheKeyPrefix = defaults.cacheKeyPrefix) => {
      try {
        return localStorage.getItem(key);
      } catch (e) {
        if (debug) console.warn(`[${cacheKeyPrefix}] Failed to retrieve from localStorage: ${key}`, e);
        return null;
      }
    }
    
    const findCachedKey = (cacheKeySuffix, cacheKeyPrefix = defaults.cacheKeyPrefix) => {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(cacheKeyPrefix + '-') && key.endsWith(cacheKeySuffix)) {
          return key;
        }
      }
      return null;
    }
    
    const betweenZeroAndOne = (n) => (n >= 0 && n < 1);
    
    const is = (type) => (v) => typeof v === type;
    const isNumber = is('number');
    const isString = is('string');
    const isBoolean = is('boolean');
    const isUndefined = is('undefined');
    
    let _canCache;
    const canCache = (debug = false, cacheKeyPrefix = defaults.cacheKeyPrefix) => {
      if (!isUndefined(_canCache)) return _canCache;
    
      const falseMessage = `[${cacheKeyPrefix}] Thumbnail caching support: false`;
      try {
        const key = '__canCacheTest__';
        const val = 'true';
    
        localStorage.setItem(key, val);
        const supported = localStorage.getItem(key) === val;
        localStorage.removeItem(key);
    
        if (!supported && debug) console.info(falseMessage);
        _canCache = supported;
        return supported;
      } catch (e) {
        if (debug) console.info(falseMessage);
        _canCache = false;
        return false;
      }
    };
    
    const getVideo = (url, timeout = 10000, onTiming) => {
      const $player = document.createElement('video');
      $player.crossOrigin = 'anonymous';
      $player.muted = true;
      $player.autoplay = false;
      $player.playsInline = true; // Must be set to `true` to prevent automatic fullscreen on iOS
    
      const promise = new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          cleanup();
          reject(new Error(`Video loading timeout after ${timeout}ms: ${url}`));
        }, timeout);
    
        const cleanup = () => {
          clearTimeout(timeoutId);
        };
    
        $player.addEventListener('canplay', () => {
          cleanup();
          $player.pause();
          if (typeof onTiming === 'function') {
            onTiming({ phase: 'load', when: 'end', ts: performance.now() });
          }
          resolve($player);
        }, { once: true });
    
        $player.addEventListener('error', (e) => {
          cleanup();
          const errorMsg = e.target?.error?.message || 'Unknown video loading error';
          if (typeof onTiming === 'function') {
            onTiming({ phase: 'load', when: 'end', ts: performance.now(), error: true });
          }
          reject(new Error(`Video loading failed: ${errorMsg} (${url})`));
        }, { once: true});
    
        $player.addEventListener('loadedmetadata', () => {
          if ($player.videoWidth === 0 || $player.videoHeight === 0) {
            cleanup();
            if (typeof onTiming === 'function') {
              onTiming({ phase: 'load', when: 'end', ts: performance.now(), error: true });
            }
            reject(new Error(`Invalid video dimensions (${$player.videoWidth}x${$player.videoHeight}): ${url}`));
          }
        }, { once: true });
      });
    
      if (typeof onTiming === 'function') {
        onTiming({ phase: 'load', when: 'start', ts: performance.now() });
      }
      $player.src = url;
      $player.load();
    
      return promise;
    }
    
    // Canvas pool for reuse to improve performance
    const canvasPool = new Map();
    
    const getCanvas = (width, height, useOffscreen = false) => {
      const key = `${width}x${height}:${useOffscreen ? 'off' : 'dom'}`;
      const legacyKey = `${width}x${height}`; // pre-type-keyed entries
    
      const prepare = (canvas) => {
        const ctx = canvas.getContext('2d');
        // Ensure dimensions match exactly (in case an older entry exists with different size)
        if ('width' in canvas && canvas.width !== width) canvas.width = width;
        if ('height' in canvas && canvas.height !== height) canvas.height = height;
        ctx.clearRect(0, 0, width, height);
        return { canvas, ctx };
      };
    
      // Try exact key
      if (canvasPool.has(key)) {
        const canvas = canvasPool.get(key);
        // If DOM canvas is needed, ensure it supports toDataURL
        if (!useOffscreen && typeof canvas.toDataURL !== 'function') {
          // Wrong type in pool; drop and recreate
          canvasPool.delete(key);
        } else {
          return prepare(canvas);
        }
      }
    
      // Try legacy key, migrate when compatible
      if (canvasPool.has(legacyKey)) {
        const canvas = canvasPool.get(legacyKey);
        if (useOffscreen) {
          if (typeof OffscreenCanvas !== 'undefined' && canvas instanceof OffscreenCanvas) {
            canvasPool.set(key, canvas);
            canvasPool.delete(legacyKey);
            return prepare(canvas);
          }
          // Not offscreen; ignore legacy entry
        } else {
          if (typeof canvas.toDataURL === 'function') {
            canvasPool.set(key, canvas);
            canvasPool.delete(legacyKey);
            return prepare(canvas);
          }
          // Legacy entry is offscreen or incompatible; ignore
        }
      }
    
      // Create new canvas of the requested type
      let canvas, ctx;
      if (useOffscreen && typeof OffscreenCanvas !== 'undefined') {
        canvas = new OffscreenCanvas(width, height);
        ctx = canvas.getContext('2d');
      } else {
        canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        ctx = canvas.getContext('2d');
      }
    
      if (width * height <= 1920 * 1080) {
        canvasPool.set(key, canvas);
      }
    
      return { canvas, ctx };
    };
    
    const _waitForPresentedFrame = (video, targetSeconds, budgetMs = 600) => {
      return new Promise((resolve) => {
        const epsilon = 0.03; // ~30ms tolerance
        if (typeof video.requestVideoFrameCallback !== 'function') {
          // Best-effort fallback: give the browser two paints
          requestAnimationFrame(() => requestAnimationFrame(resolve));
          return;
        }
        const deadline = performance.now() + budgetMs;
        const loop = () => {
          video.requestVideoFrameCallback((now, metadata) => {
            const mt = metadata && typeof metadata.mediaTime === 'number' ? metadata.mediaTime : null;
            if (mt !== null && Math.abs(mt - targetSeconds) <= epsilon) {
              resolve();
              return;
            }
            if (performance.now() > deadline) {
              resolve();
            } else {
              loop();
            }
          });
        };
        loop();
      });
    };
    
    const videoToDataURI = async (videoElement, timestamp, size, mime, type, onTiming, index, debug = false, cacheKeyPrefix = defaults.cacheKeyPrefix) => {
      const start = performance.now();
      const $player = videoElement;
    
      const aspectRatio = $player.videoHeight / $player.videoWidth;
    
      const w = Math.max(1, Math.min(32767, size));
      const h = Math.max(1, Math.min(32767, w * aspectRatio));
    
      if (w !== size) {
        if (debug) console.warn(`[${cacheKeyPrefix}] Canvas width clamped from ${size} to ${w}`);
      }
    
      const { canvas: c, ctx } = getCanvas(w, h, type === 'objectURL');
    
      var seekTime = 0;
      let seekMs = 0;
      let encodeMs = 0;
      if (isSeekable($player)) {
        // Interpret timestamp: [0,1) => relative; otherwise absolute seconds
        const relSeconds = timestamp * $player.duration;
        const requestedSeconds = betweenZeroAndOne(timestamp)
          ? relSeconds
          : timestamp;
    
        const epsilon = 0;
        const maxT = Math.max(0, $player.duration - 0.05);
        if (!betweenZeroAndOne(timestamp) && requestedSeconds > $player.duration) {
          if (debug) console.warn(`[${cacheKeyPrefix}] Timestamp ${timestamp} exceeds video duration ${$player.duration}s, using end of video`);
        }
        seekTime = Math.min(Math.max(requestedSeconds, epsilon), maxT);
    
        if (typeof onTiming === 'function') {
          onTiming({ phase: 'seek', when: 'start', ts: performance.now(), index });
        }
        const seekStart = performance.now();
        await seek($player, seekTime, 3, debug, cacheKeyPrefix);
        // Briefly play to force frame presentation, then wait for presented frame at target
        try { await $player.play(); } catch (e) { /* ignore autoplay restrictions - muted helps */ }
        await _waitForPresentedFrame($player, seekTime);
        $player.pause();
        seekMs = performance.now() - seekStart;
        if (typeof onTiming === 'function') {
          onTiming({ phase: 'seek', when: 'end', ts: performance.now(), index });
        }
      } else {
        if (debug) console.warn(`[${cacheKeyPrefix}] Unable to seek video: ${videoElement.src}`);
      }
    
      $player.pause();
      if (typeof onTiming === 'function') {
        onTiming({ phase: 'encode', when: 'start', ts: performance.now(), index });
      }
      const encodeStart = performance.now();
      ctx.drawImage($player, 0, 0, w, h);
    
      const URI = (type === 'objectURL' ? await canvasToBlob(c, mime.type, mime.quality) : c.toDataURL(mime.type, mime.quality));
      // Compute size in KB accurately for object URLs
      let sizeKB = 0;
      if (type === 'objectURL') {
        const sz = globalThis._videoThumbnailObjectURLSizes && globalThis._videoThumbnailObjectURLSizes.get(URI);
        if (typeof sz === 'number') sizeKB = round(sz / 1024, 2);
      } else {
        sizeKB = round((URI && URI.length ? (URI.length / 1024) : 0), 2);
      }
      encodeMs = performance.now() - encodeStart;
      if (typeof onTiming === 'function') {
        onTiming({ phase: 'encode', when: 'end', ts: performance.now(), index });
      }
      const duration = performance.now() - start;
      const response = { URI, timestamp, duration, seekTime, mime, seekMs, encodeMs, sizeKB };
    
      return response;
    }
    
    const canvasToBlob = (canvas, type, quality) => {
      const makeURL = (blob, resolve) => {
        const objectURL = URL.createObjectURL(blob);
        if (!globalThis._videoThumbnailObjectURLs) {
          globalThis._videoThumbnailObjectURLs = new Set();
        }
        globalThis._videoThumbnailObjectURLs.add(objectURL);
        // Track sizes for accurate metrics
        if (!globalThis._videoThumbnailObjectURLSizes) {
          globalThis._videoThumbnailObjectURLSizes = new Map();
        }
        try { globalThis._videoThumbnailObjectURLSizes.set(objectURL, blob.size); } catch {}
        resolve(objectURL);
      };
    
      // OffscreenCanvas path
      try {
        if (typeof OffscreenCanvas !== 'undefined' && canvas instanceof OffscreenCanvas) {
          return new Promise(async (resolve, reject) => {
            try {
              const blob = await canvas.convertToBlob({ type, quality });
              if (blob) return makeURL(blob, resolve);
              reject(new Error('Failed to create blob from OffscreenCanvas'));
            } catch (e) {
              reject(new Error(`Unable to create blob from OffscreenCanvas: ${e.message}`));
            }
          });
        }
      } catch {}
    
      // HTMLCanvasElement path
      if (typeof canvas.toBlob === 'function') {
        return new Promise((resolve, reject) => {
          try {
            canvas.toBlob((blob) => {
              if (blob) {
                return makeURL(blob, resolve);
              }
              reject(new Error('Failed to create blob from canvas'));
            }, type, quality);
          } catch (e) {
            reject(new Error(`Unable to create blob from canvas: ${e.message}`));
          }
        });
      }
    
      // Fallback: dataURL -> Blob via fetch (works in most browsers)
      return new Promise(async (resolve, reject) => {
        try {
          if (typeof canvas.toDataURL !== 'function') {
            return reject(new Error('Canvas cannot produce dataURL for fallback'));
          }
          const dataURL = canvas.toDataURL(type, quality);
          const resp = await fetch(dataURL);
          const blob = await resp.blob();
          return makeURL(blob, resolve);
        } catch (e) {
          reject(new Error(`Unable to create blob from canvas (fallback): ${e.message}`));
        }
      });
    }
    
    const cleanupObjectURLs = () => {
      let revokedCount = 0;
      if (globalThis._videoThumbnailObjectURLs) {
        revokedCount = globalThis._videoThumbnailObjectURLs.size;
        globalThis._videoThumbnailObjectURLs.forEach(url => {
          try {
            URL.revokeObjectURL(url);
          } catch (e) {
            if (lastDebug) console.warn(`[${lastCacheKeyPrefix}] Failed to revoke object URL: ${e.message}`);
          }
        });
        globalThis._videoThumbnailObjectURLs.clear();
      }
      if (globalThis._videoThumbnailObjectURLSizes) {
        try { globalThis._videoThumbnailObjectURLSizes.clear(); } catch {}
      }
      return revokedCount;
    };
    
    const _getMemoryUsage = () => {
      const cacheSize = getThumbnailDataURI.cacheSize();
      const canvasPoolSize = canvasPool.size;
      const objectURLCount = globalThis._videoThumbnailObjectURLs ? globalThis._videoThumbnailObjectURLs.size : 0;
    
      return {
        cacheSizeBytes: cacheSize,
        cacheSizeKB: Math.round(cacheSize / 1024),
        canvasPoolEntries: canvasPoolSize,
        activeObjectURLs: objectURLCount
      };
    };
    
    const seek = ($player, time, maxRetries = 3, debug = false, cacheKeyPrefix = defaults.cacheKeyPrefix) => {
      const attemptSeek = (attempt = 1) => {
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error(`Seek timeout after 5 seconds (attempt ${attempt}/${maxRetries})`));
          }, 5000);
    
          const errorHandler = (e) => {
            clearTimeout(timeout);
            if (attempt < maxRetries) {
              if (debug) console.warn(`[${cacheKeyPrefix}] Seek attempt ${attempt} failed, retrying...`);
              setTimeout(() => {
                attemptSeek(attempt + 1).then(resolve).catch(reject);
              }, 100 * attempt);
            } else {
              reject(new Error(`Error while seeking video after ${maxRetries} attempts: ${e.message || 'Unknown error'}`));
            }
          };
    
          $player.addEventListener('error', errorHandler, { once: true});
    
          $player.addEventListener('seeked', () => {
            clearTimeout(timeout);
            $player.removeEventListener('error', errorHandler);
    
            const tolerance = 0.5;
            const actualTime = $player.currentTime;
            if (Math.abs(actualTime - time) > tolerance) {
              if (debug) console.warn(`[${cacheKeyPrefix}] Seek inaccuracy: requested ${time}s, got ${actualTime}s`);
            }
    
            resolve(actualTime);
          }, { once: true});
    
          $player.currentTime = time;
        });
      };
    
      return attemptSeek();
    }
    
    const isSeekable = (videoElement) => {
      try {
        const ranges = videoElement?.seekable;
        if (!ranges || ranges.length === 0) return false;
        const end = ranges.end(ranges.length - 1);
        return end > 0;
      } catch {
        return false;
      }
    };
    
    const validateInputs = (url, opts) => {
      if (!url || typeof url !== 'string') {
        throw new Error('URL must be a non-empty string');
      }
    
      try {
        new URL(url);
      } catch (e) {
        if (!url.match(/^[\w\-._~:\/?#[\]@!$&'()*+,;=%]+$/)) {
          throw new Error(`Invalid URL format: ${url}`);
        }
      }
    
      if (opts.size !== undefined) {
        if (!isNumber(opts.size) || opts.size <= 0 || opts.size > 32767) {
          throw new Error('Size must be a positive number not exceeding 32767');
        }
      }
    
      if (opts.timestamps !== undefined) {
        const timestamps = Array.isArray(opts.timestamps) ? opts.timestamps : [opts.timestamps];
        for (const timestamp of timestamps) {
          if (!isNumber(timestamp) || timestamp < 0) {
            throw new Error('Timestamps must be non-negative numbers');
          }
        }
      }
    
      if (opts.mime && opts.mime.type) {
        if (!(/^image\/(webp|jpeg|png)$/i).test(opts.mime.type)) {
          throw new Error(`Unsupported mime type: ${opts.mime.type}. Supported formats: JPEG (default), WebP, PNG`);
        }
        if (opts.mime.quality !== undefined) {
          if (!isNumber(opts.mime.quality) || opts.mime.quality < 0 || opts.mime.quality > 1) {
            throw new Error('Quality must be a number between 0 and 1');
          }
        }
      }
    };
    
    const getThumbnailDataURI = async (url, opts) => {
      opts = {...opts} || {};
    
      validateInputs(url, opts);
    
      const isImageMimeType = (s) => (/image\/.+/i).test(s);
      const size          = (isNumber(opts.size) && opts.size > 0         ? opts.size : defaults.size);
      const defaultMime   = { type: 'image/jpeg', quality: 0.5 };
      const mime          = {
        type: (opts.mime && isImageMimeType(opts.mime.type)) ? opts.mime.type : defaultMime.type,
        quality: (opts.mime && isNumber(opts.mime.quality)) ? opts.mime.quality : defaultMime.quality
      };
      const type          = (opts.type === 'objectURL'                    ? opts.type : defaults.type);
      const shouldCache   = (isBoolean(opts.cache)                        ? opts.cache : defaults.cache);
      const cacheReadOnly = opts.cacheReadOnly;
      const cacheKeyPrefix = (isString(opts.cacheKeyPrefix) ? opts.cacheKeyPrefix : defaults.cacheKeyPrefix);
      const debug         = (isBoolean(opts.debug)                        ? opts.debug : defaults.debug);
    
      lastDebug = debug;
      lastCacheKeyPrefix = cacheKeyPrefix;
    
      const timestamps = (
        Array.isArray(opts.timestamps) ?
          opts.timestamps :
          (isUndefined(opts.timestamps) ? defaults.timestamps : [opts.timestamps])
      );
    
      try {
        const onTiming = (typeof opts.onTiming === 'function') ? opts.onTiming : null;
        const totalStart = performance.now();
        if (onTiming) onTiming({ phase: 'total', when: 'start', ts: totalStart });
        const thumbnails = [];
        let $player = null;
        const timingAgg = { loadMs: 0, totalMs: 0, seeksMs: [], encodesMs: [], seekMsTotal: 0, encodeMsTotal: 0 };
    
        for (let i = 0; i < timestamps.length; i++) {
          const timestamp = timestamps[i];
    
      const cacheKeySuffix = `${size}|${imageFormat(mime)}|${timestamp}|${url}`;
      const cachedKey = findCachedKey(cacheKeySuffix, cacheKeyPrefix);
          const cachedURI = cachedKey ? retrieve(cachedKey, debug, cacheKeyPrefix) : null;
    
          if (canCache(debug, cacheKeyPrefix) && shouldCache && isDataURI(cachedURI)) {
            try {
              const metadata = cacheKeyParser(cachedKey);
              if (!metadata || typeof metadata !== 'object') {
                throw new Error('Invalid metadata structure');
              }
    
              const {timestamp: cacheTimestamp, seekTime, mime: cacheMime} = metadata;
    
              if (typeof cacheTimestamp !== 'number' || typeof seekTime !== 'number') {
                throw new Error('Invalid metadata types');
              }
    
              const sizeKB = round(cachedURI.length / 1024, 2);
              const URI = cachedURI;
              const duration = 0;
    
              thumbnails.push({URI, timestamp: cacheTimestamp, duration, mime: cacheMime || mime, seekTime, sizeKB, seekMs: 0, encodeMs: 0});
              // Cached path: no additional seek/encode time
              timingAgg.seeksMs[i] = 0;
              timingAgg.encodesMs[i] = 0;
              if (debug) console.info(`[${cacheKeyPrefix}] Retrieved from cache: ${cachedKey}`);
              continue;
            } catch (parseError) {
              if (debug) console.warn(`[${cacheKeyPrefix}] Failed to parse cache key, will regenerate: ${cachedKey}`, parseError);
            }
          }
    
          if (!cacheReadOnly) {
            if (!$player) {
              const loadStart = performance.now();
              $player = await getVideo(url, 10000, onTiming);
              timingAgg.loadMs = performance.now() - loadStart;
            }
    
            const thumbnail = await videoToDataURI($player, timestamp, size, mime, type, onTiming, i, debug, cacheKeyPrefix);
    
            if (!thumbnail || typeof thumbnail !== 'object' || !thumbnail.URI) {
              throw new Error(`Invalid thumbnail generated for timestamp ${timestamp}`);
            }
    
            if (typeof thumbnail.sizeKB !== 'number') {
              thumbnail.sizeKB = round((thumbnail.URI && thumbnail.URI.length ? (thumbnail.URI.length / 1024) : 0), 2);
            }
            thumbnail.seekTime = round(thumbnail.seekTime || 0, 2);
            thumbnails.push(thumbnail);
    
            // Aggregate per-thumbnail timings
            timingAgg.seeksMs[i] = typeof thumbnail.seekMs === 'number' ? thumbnail.seekMs : 0;
            timingAgg.encodesMs[i] = typeof thumbnail.encodeMs === 'number' ? thumbnail.encodeMs : 0;
    
            const cacheTimestamp = Date.now();
      const cacheKey = `${cacheKeyPrefix}-${cacheTimestamp}-${thumbnail.seekTime}-${cacheKeySuffix}`;
    
            // Only cache data URIs; skip caching blob/object URLs
            if (type !== 'objectURL' && canCache(debug, cacheKeyPrefix) && shouldCache && !retrieve(cacheKey, debug, cacheKeyPrefix)) {
              const keys = Object.keys(localStorage)
                .filter((key) => key.startsWith(cacheKeyPrefix))
                .sort();
    
              while (!store(cacheKey, thumbnail.URI, debug, cacheKeyPrefix) && keys.length > 0) {
                const key = keys.shift();
                localStorage.removeItem(key);
                if (debug) console.info(`[${cacheKeyPrefix}] Purged from cache: ${key}`);
              }
            }
          }
        }
    
        if ($player) {
          try {
            $player.removeAttribute('src');
            $player.load();
          } catch (cleanupError) {
            if (debug) console.warn(`[${cacheKeyPrefix}] Error during video cleanup: ${cleanupError.message}`);
          }
        }
    
        const totalEnd = performance.now();
        timingAgg.totalMs = totalEnd - totalStart;
        timingAgg.seekMsTotal = timingAgg.seeksMs.reduce((a, b) => a + (b || 0), 0);
        timingAgg.encodeMsTotal = timingAgg.encodesMs.reduce((a, b) => a + (b || 0), 0);
        if (onTiming) onTiming({ phase: 'total', when: 'end', ts: totalEnd });
    
        // Attach non-enumerable timing aggregate to the array (keeps API backward-compatible)
        try {
          Object.defineProperty(thumbnails, 'timing', { value: timingAgg, enumerable: false, configurable: false });
        } catch {}
        return thumbnails;
      } catch (e) {
        if (debug) console.error(`[${cacheKeyPrefix}] Unable to create thumbnail(s) for: ${url}`, e);
        throw e;
      }
    }
    
    const cacheKeyParser = (key) => {
      // Prefix-agnostic parser: <prefix>-<timestamp>-<seekTime>-<size>|<fmt>|<ts>|<url>
        const re = /^(.+?)-(\d{13,})-(\d+\.?\d{0,2})-(\d{1,5})\|(\w{3,4})\|([\d\.]+)\|(.+)$/i;
      const parts = re.exec(key);
    
      if (!parts || parts.length < 8) {
        throw new Error(`Invalid cache key format: ${key}`);
      }
    
      const res = {
        prefix: parts[1],
        cacheTimestamp: +parts[2],
        seekTime: +parts[3],
        size: +parts[4],
        mime: { type: `image/${parts[5]}`},
        timestamp: +parts[6],
        URL: parts[7]
      }
    
      return res;
    };
    const imageFormat = (mime) => mime.type.split('/')[1];
    const isDataURI = (uri) => uri && uri.startsWith('data:image/') && uri.length > 30;
    
    getThumbnailDataURI.clearCache = (prefix) => {
      const cacheKeyPrefix = (typeof prefix === 'string' ? prefix : defaults.cacheKeyPrefix);
    
      const keys = Object.keys(localStorage)
        .filter((k) => k.startsWith(cacheKeyPrefix));
      while (keys.length > 0) localStorage.removeItem(keys.pop());
    
      const remaining = Object.keys(localStorage).some((k) => k.startsWith(cacheKeyPrefix));
      return !remaining;
    }
    
    getThumbnailDataURI.cacheSize = (prefix) => {
      const cacheKeyPrefix = (typeof prefix === 'string' ? prefix : defaults.cacheKeyPrefix);
      const keys = Object.keys(localStorage).filter((key) => key.startsWith(cacheKeyPrefix));
      const size = keys.reduce((acc, key) => acc += (localStorage.getItem(key) || '').length, 0);
      return size;
    }
    
    getThumbnailDataURI.getMemoryUsage = _getMemoryUsage;
    getThumbnailDataURI.cleanupObjectURLs = cleanupObjectURLs;
    
    getThumbnailDataURI.clearCanvasPool = () => {
      canvasPool.clear();
      return true;
    };
    
    
    global.videoThumbnail = getThumbnailDataURI;
