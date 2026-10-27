/*! folder-api v2.1.0 browser bundle. Generated from TypeScript. MIT License. */

// src/options.ts
var integerOption = (value, fallback, minimum, maximum = Number.MAX_SAFE_INTEGER) => typeof value === "number" && Number.isFinite(value) ? Math.min(maximum, Math.max(minimum, Math.trunc(value))) : fallback;
function normalizeOptions(opts) {
  const cache = opts?.cache ?? "default";
  return {
    maxDepth: integerOption(opts?.maxDepth, 0, 0),
    maxEntries: integerOption(opts?.maxEntries, 5e4, 1, 5e4),
    continueOnError: opts?.continueOnError === true,
    mode: opts?.mode === "fetch" || opts?.mode === "iframe" ? opts.mode : "auto",
    cache: ["default", "no-store", "no-cache", "reload", "force-cache", "only-if-cached"].includes(cache) ? cache : "default",
    includeMime: opts?.includeMime ?? false,
    headConcurrency: integerOption(opts?.headConcurrency, 4, 1),
    timeoutMs: integerOption(opts?.timeoutMs, 15e3, 100, 2147483647),
    sameOriginOnly: opts?.sameOriginOnly ?? true,
    signal: opts?.signal
  };
}

// src/utils/abort.ts
function throwIfAborted(signal) {
  if (signal?.aborted) throw signal.reason ?? new DOMException("The operation was aborted", "AbortError");
}
function createRequestController(signal, timeoutMs) {
  throwIfAborted(signal);
  const controller = new AbortController();
  const onAbort = () => controller.abort(signal?.reason);
  signal?.addEventListener("abort", onAbort, { once: true });
  const timer = setTimeout(() => controller.abort(new DOMException("Request timed out", "TimeoutError")), timeoutMs);
  return {
    signal: controller.signal,
    dispose: () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    }
  };
}

// src/core/fetchDirectory.ts
async function fetchDirectoryHtml(url, opts, stats) {
  const request = createRequestController(opts.signal, opts.timeoutMs);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      cache: opts.cache,
      mode: opts.cache === "only-if-cached" ? "same-origin" : void 0,
      signal: request.signal,
      headers: {
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      }
    });
    stats.fetches++;
    if (res.status !== 200) throw new Error(`http ${res.status}${res.statusText ? " " + res.statusText : ""}`);
    const ctype = res.headers.get("content-type") || "";
    if (!/text\/html/i.test(ctype)) throw new Error(`not html content-type: ${ctype}`);
    const html = await res.text();
    throwIfAborted(opts.signal);
    return { html, url: res.url || url };
  } finally {
    request.dispose();
  }
}

// src/core/iframeDirectory.ts
async function iframeDirectoryHtml(url, opts, stats) {
  throwIfAborted(opts.signal);
  if (typeof document === "undefined") throw new Error("iframe mode not supported in this environment");
  const iframe = document.createElement("iframe");
  iframe.setAttribute("sandbox", "allow-same-origin");
  Object.assign(iframe.style, { position: "absolute", width: "0", height: "0", border: "0", visibility: "hidden" });
  return await new Promise((resolve, reject) => {
    const timer = setTimeout(() => fail(new Error("iframe timeout")), opts.timeoutMs);
    function cleanup() {
      clearTimeout(timer);
      iframe.removeEventListener("load", onLoad);
      iframe.removeEventListener("error", onError);
      opts.signal?.removeEventListener("abort", onAbort);
      iframe.remove();
    }
    function fail(error) {
      cleanup();
      reject(error);
    }
    function onAbort() {
      fail(opts.signal?.reason ?? new DOMException("The operation was aborted", "AbortError"));
    }
    function onLoad() {
      try {
        throwIfAborted(opts.signal);
        const doc = iframe.contentDocument;
        if (!doc) throw new Error("Unable to read iframe document. Same-origin access is required.");
        if (doc.URL === "about:blank") return;
        const result = { html: doc.documentElement?.outerHTML || "", url: doc.URL || url };
        cleanup();
        resolve(result);
      } catch (error) {
        fail(error);
      }
    }
    function onError() {
      fail(new Error("iframe error"));
    }
    iframe.addEventListener("load", onLoad);
    iframe.addEventListener("error", onError);
    opts.signal?.addEventListener("abort", onAbort, { once: true });
    try {
      iframe.src = url;
      document.body.appendChild(iframe);
      stats.iframes++;
    } catch (error) {
      fail(error);
    }
  });
}

// src/utils/url.ts
function ensureHttp(url) {
  let u;
  try {
    u = new URL(url);
  } catch (e) {
    throw new Error(`invalid url: ${url}`);
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error(`unsupported scheme: ${u.protocol}`);
  }
  u.pathname = u.pathname.replace(/\/+/g, "/");
  if (!u.pathname.endsWith("/")) u.pathname += "/";
  u.hash = "";
  return u;
}
function normalizeDirectoryUrl(url) {
  return ensureHttp(url).toString();
}
function keyForVisited(u) {
  return `${u.origin}${canonicalPath(u.pathname)}`;
}
function keyForFile(u) {
  return keyForVisited(u) + u.search;
}
function canonicalPath(pathname) {
  return pathname.replace(/%[\da-f]{2}/gi, (encoded) => {
    const decoded = String.fromCharCode(parseInt(encoded.slice(1), 16));
    return /^[\w.~-]$/.test(decoded) ? decoded : encoded.toUpperCase();
  });
}
function parentDirectory(u) {
  const parts = u.pathname.split("/").filter((p) => p.length > 0);
  if (parts.length === 0) return null;
  parts.pop();
  return `${u.protocol}//${u.host}/${parts.join("/")}${parts.length ? "/" : ""}`;
}
function rootDirectory(u) {
  return `${u.protocol}//${u.host}/`;
}
function isHiddenName(name) {
  return name.startsWith(".") && name !== "." && name !== "..";
}

// src/utils/classify.ts
function classifyEntry(href, metadataText) {
  const pathname = typeof href === "string" ? new URL(href).pathname : href.pathname;
  if (pathname.endsWith("/")) return "folder";
  const last = pathname.split("/").filter(Boolean).pop() || "";
  if (/^[^.].*\.[^.]+$/.test(last)) return "file";
  if (/\b(dir|folder|directory)\b/i.test(metadataText)) return "folder";
  return "file";
}
function detectHidden(decodedName) {
  return isHiddenName(decodedName);
}

// src/utils/date.ts
var isoPattern = /\b(\d{4})-(\d{2})-(\d{2})(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?(Z|[+-]\d{2}:?\d{2})?)?\b/i;
var apachePattern = /\b(\d{1,2})-([a-z]{3})-(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\b/i;
var usPattern = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)\b/i;
var isoGlobalPattern = new RegExp(isoPattern.source, "gi");
var apacheGlobalPattern = new RegExp(apachePattern.source, "gi");
function parseDateMeta(text, errors) {
  const iso = isoPattern.exec(text);
  if (iso) {
    const remainder = text.slice(iso.index + iso[0].length);
    if (/^(?:[:.]|[+-]\d|Z\b)/i.test(remainder) || !iso[4] && /^(?:T|\s+\d+:)/i.test(remainder) || iso[4] && /^\s+[+-]\d/.test(remainder)) return invalidDate(errors);
    return validatedDate(
      +iso[1],
      +iso[2],
      +iso[3],
      +(iso[4] || 0),
      +(iso[5] || 0),
      +(iso[6] || 0),
      +(iso[7] || "").padEnd(3, "0").slice(0, 3),
      iso[8] || "",
      errors
    );
  }
  const apache = apachePattern.exec(text);
  if (apache) {
    if (/^[:.]/.test(text.slice(apache.index + apache[0].length))) return invalidDate(errors);
    const month = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(apache[2].toLowerCase()) + 1;
    return validatedDate(+apache[3], month, +apache[1], +apache[4], +apache[5], +(apache[6] || 0), 0, "", errors);
  }
  const us = usPattern.exec(text);
  if (us) {
    const hour = +us[4];
    if (hour < 1 || hour > 12) return invalidDate(errors);
    return validatedDate(+us[3], +us[1], +us[2], hour % 12 + (/pm/i.test(us[7]) ? 12 : 0), +us[5], +(us[6] || 0), 0, "", errors);
  }
  if (/\b\d{4}-\d{2}-\d{2}T/i.test(text)) return invalidDate(errors);
  if (/\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/.test(text)) errors.push("date: ambiguous numeric date pattern");
  return null;
}
function validatedDate(year, month, day, hour, minute, second, millisecond, zone, errors) {
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) return invalidDate(errors);
  const date = /* @__PURE__ */ new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, millisecond);
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return invalidDate(errors);
  if (zone && zone.toUpperCase() !== "Z") {
    const digits = zone.slice(1).replace(":", "");
    const hours = +digits.slice(0, 2);
    const minutes = +digits.slice(2);
    if (hours > 23 || minutes > 59) return invalidDate(errors);
    const offset = (hours * 60 + minutes) * (zone[0] === "+" ? 1 : -1);
    date.setTime(date.getTime() - offset * 6e4);
  }
  return date.toISOString();
}
function invalidDate(errors) {
  errors.push("date: invalid date or time");
  return null;
}
function stripDateTime(text) {
  return text.replace(isoGlobalPattern, "").replace(apacheGlobalPattern, "").replace(/\b\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?\b/gi, "");
}

// src/utils/size.ts
function parseSizeMeta(text) {
  const metadata = stripDateTime(text).trim();
  const match = /^(\d+(?:,\d{3})*(?:\.\d+)?)\s*([KMGTP](?:i?B)?|B|bytes?)?$/i.exec(metadata);
  if (!match) return null;
  const unit = (match[2] || "").toUpperCase();
  const power = unit && !unit.startsWith("B") ? "KMGTP".indexOf(unit[0]) + 1 : 0;
  const bytes = Number(match[1].replace(/,/g, "")) * Math.pow(1024, power);
  return Number.isFinite(bytes) ? Math.floor(bytes) : null;
}

// src/utils/decode.ts
function safeDecodeURIComponent(segment, errors) {
  try {
    return decodeURIComponent(segment);
  } catch (e) {
    errors.push(`decode: failed to decode segment '${segment}'`);
    return segment;
  }
}

// src/utils/errors.ts
function pushError(errors, prefix, message) {
  errors.push(`${prefix}: ${message}`);
}

// src/core/parseDirectory.ts
function parseDirectoryHtml(baseUrl, html, opts, admitEntry) {
  throwIfAborted(opts.signal);
  const errors = [];
  const doc = new DOMParser().parseFromString(html, "text/html");
  let anchors = doc.querySelectorAll("pre a[href], table a[href], ul a[href], ol a[href]");
  if (anchors.length === 0) anchors = doc.querySelectorAll("a[href]");
  const base = new URL(baseUrl);
  let linkBase = base;
  const baseHref = doc.querySelector("base[href]")?.getAttribute("href");
  if (baseHref !== void 0 && baseHref !== null) {
    try {
      const candidate = new URL(baseHref, base);
      if (!/^https?:$/.test(candidate.protocol)) throw new Error("unsupported base protocol");
      linkBase = candidate;
    } catch {
      pushError(errors, "url", `invalid base '${baseHref}'`);
    }
  }
  const seen = /* @__PURE__ */ new Set();
  const rows = /* @__PURE__ */ new WeakMap();
  const columns = /* @__PURE__ */ new WeakMap();
  const folders = [];
  const files = [];
  for (const anchor of anchors) {
    throwIfAborted(opts.signal);
    const href = anchor.getAttribute("href")?.trim();
    const container = anchor.closest("th,tr,li");
    if (!href || href.includes("#") || container?.tagName === "TH") continue;
    let url;
    try {
      url = new URL(href, linkBase);
    } catch {
      pushError(errors, "url", `invalid link '${href}'`);
      continue;
    }
    if (!/^https?:$/.test(url.protocol) || opts.sameOriginOnly && url.origin !== base.origin) continue;
    if (url.origin === base.origin && url.pathname === base.pathname && url.search && url.search !== base.search) continue;
    const metadata = deriveMetadataFields(anchor, container, rows, columns);
    const kind = classifyEntry(url, metadata.fields.join(" "));
    if (kind === "unknown") continue;
    if (kind === "folder") url = new URL(normalizeDirectoryUrl(url.href));
    const key = kind + ":" + (kind === "folder" ? keyForVisited(url) : keyForFile(url));
    if (seen.has(key)) continue;
    const admission = admitEntry ? admitEntry(kind, url) : folders.length + files.length >= opts.maxEntries ? "limit" : "accept";
    if (admission === "skip") continue;
    if (admission === "limit") {
      pushError(errors, "limit", "entry limit exceeded");
      break;
    }
    seen.add(key);
    const rawName = url.pathname.split("/").filter(Boolean).pop() || "";
    const name = safeDecodeURIComponent(rawName, errors);
    const dateFields = metadata.dateIndex === void 0 ? metadata.fields : [metadata.fields[metadata.dateIndex] || ""];
    let date = null;
    for (const field of dateFields) {
      if (!field.trim() || field.trim() === "-") continue;
      date = parseDateMeta(field, errors);
      if (date !== null) break;
    }
    const sizeFields = metadata.sizeIndex === void 0 ? metadata.fields : [metadata.fields[metadata.sizeIndex] || ""];
    let size = null;
    for (const field of sizeFields) {
      if (!field.trim() || field.trim() === "-") continue;
      const candidate = parseSizeMeta(field);
      if (candidate === null) continue;
      if (size !== null && size !== candidate) {
        size = null;
        break;
      }
      size = candidate;
    }
    const entry = { url: url.href, rawName, name, hidden: detectHidden(name), date };
    if (kind === "folder") folders.push({ ...entry, kind: "folder", size: null });
    else files.push({ ...entry, kind: "file", size });
  }
  return { folders, files, errors };
}
function deriveMetadataFields(anchor, container, rows, columns) {
  const row = container?.tagName === "TR" ? container : null;
  if (row) {
    const cached = rows.get(row);
    if (cached) return cached;
    const table = row.closest("table");
    let schema = table ? columns.get(table) : void 0;
    if (table && !schema) {
      const header = Array.from(table.rows).find((candidate) => Array.from(candidate.cells).some((cell) => cell.tagName === "TH"));
      const labels = header ? Array.from(header.cells).flatMap((cell) => Array(cell.colSpan).fill(cell.textContent?.trim().toLowerCase() || "")) : [];
      const sizeIndex = labels.findIndex((label) => /^(?:file\s+)?size$|^length$/.test(label));
      const dateIndex = labels.findIndex((label) => /modified|date|timestamp|last\s+write/.test(label));
      schema = { sizeIndex: sizeIndex < 0 ? void 0 : sizeIndex, dateIndex: dateIndex < 0 ? void 0 : dateIndex };
      columns.set(table, schema);
    }
    const cellIndex = (column) => {
      if (column === void 0) return void 0;
      let offset = 0;
      return Array.from(row.cells).findIndex((cell) => {
        offset += cell.colSpan;
        return column < offset;
      });
    };
    const metadata = {
      fields: Array.from(row.cells, readMetadataText),
      sizeIndex: cellIndex(schema?.sizeIndex),
      dateIndex: cellIndex(schema?.dateIndex)
    };
    rows.set(row, metadata);
    return metadata;
  }
  const item = container?.tagName === "LI" ? container : null;
  if (item) return { fields: [readMetadataText(item)] };
  const adjacentText = (before) => {
    const parts = [];
    for (let node = before ? anchor.previousSibling : anchor.nextSibling; node; node = before ? node.previousSibling : node.nextSibling) {
      if (node.nodeType === 1) {
        const element = node;
        if (element.matches("a,br") || element.querySelector("a,br")) break;
      }
      const lines = (node.textContent || "").split(/\r?\n/);
      if (before) parts.unshift(lines[lines.length - 1]);
      else parts.push(lines[0]);
      if (lines.length > 1) break;
    }
    return parts.join("");
  };
  return { fields: [(adjacentText(true) + " " + adjacentText(false)).trim()] };
}
function readMetadataText(element) {
  const parts = [];
  const visit = (node) => {
    if (node.nodeType === 3) parts.push(node.textContent || "");
    else if (node.nodeType === 1 && !node.matches("a,ul,ol,table")) {
      for (const child of node.childNodes) visit(child);
    }
  };
  for (const child of element.childNodes) visit(child);
  return parts.join(" ").trim();
}

// src/core/recursion.ts
async function traverse(startUrl, opts, state) {
  const root = createNode(normalizeDirectoryUrl(startUrl), "self", 0, state.errors);
  const folders = /* @__PURE__ */ new Map([[keyForVisited(new URL(root.url)), root]]);
  const parents = /* @__PURE__ */ new WeakMap();
  const files = /* @__PURE__ */ new Map();
  let limitReported = false;
  const entryCount = () => folders.size + files.size;
  const reportLimit = () => {
    if (!limitReported) pushError(state.errors, "limit", "entry limit exceeded");
    limitReported = true;
  };
  const canAdd = () => {
    if (entryCount() < opts.maxEntries) return true;
    reportLimit();
    return false;
  };
  const loadDocument = async (url) => {
    throwIfAborted(opts.signal);
    if (opts.mode === "iframe") return await iframeDirectoryHtml(url, opts, state.stats);
    if (opts.mode === "fetch") return await fetchDirectoryHtml(url, opts, state.stats);
    try {
      return await fetchDirectoryHtml(url, opts, state.stats);
    } catch {
      throwIfAborted(opts.signal);
      return await iframeDirectoryHtml(url, opts, state.stats);
    }
  };
  const loadDirectory = async (node, parent) => {
    const requestedKey = keyForVisited(new URL(node.url));
    const loaded = await loadDocument(node.url);
    throwIfAborted(opts.signal);
    const url = normalizeDirectoryUrl(loaded.url);
    const final = new URL(url);
    if (node !== root && opts.sameOriginOnly && final.origin !== new URL(root.url).origin) {
      throw new Error("Child directory redirected to another origin");
    }
    const finalKey = keyForVisited(final);
    if (node !== root && opts.sameOriginOnly && !isChild(new URL(root.url), final) && !folders.has(finalKey)) {
      throw new Error("Child directory redirected outside the starting directory");
    }
    if (finalKey !== requestedKey) {
      const existing = folders.get(finalKey);
      folders.delete(requestedKey);
      if (existing && existing !== node) {
        if (parent) parent.children = parent.children.filter((child) => child !== node);
        if (existing.role !== "child" || state.visited.has(finalKey)) return null;
        node = existing;
      } else {
        const updated = createNode(url, node.role, node.depth, state.errors);
        Object.assign(node, updated);
        folders.set(finalKey, node);
      }
    }
    node.url = url;
    if (node !== root && isChild(new URL(root.url), final)) node.depth = relativeDepth(new URL(root.url), final);
    state.visited.add(finalKey);
    if (node.depth > opts.maxDepth) return null;
    state.maxDepthEncountered = Math.max(state.maxDepthEncountered, node.depth);
    const start = new URL(root.url);
    const startKey = keyForVisited(start);
    const rootKey = keyForVisited(new URL(rootDirectory(start)));
    const parentUrl = parentDirectory(start);
    const parentKey = parentUrl ? keyForVisited(new URL(parentUrl)) : null;
    const folderRole = (candidate) => {
      const key = keyForVisited(candidate);
      if (key === startKey) return "self";
      if (key === rootKey) return "root";
      if (key === parentKey) return "parent";
      if (isChild(final, candidate) || !opts.sameOriginOnly && candidate.origin !== final.origin) return "child";
      return void 0;
    };
    let pendingEntries = 0;
    const parsed = parseDirectoryHtml(url, loaded.html, opts, (kind, candidate) => {
      if (kind === "folder") {
        if (!folderRole(candidate)) return "skip";
        if (folders.has(keyForVisited(candidate))) return "accept";
      } else if (files.has(keyForFile(candidate))) return "skip";
      if (entryCount() + pendingEntries >= opts.maxEntries) return "limit";
      pendingEntries++;
      return "accept";
    });
    for (const error of parsed.errors) {
      if (error.startsWith("limit:")) reportLimit();
      else state.errors.push(error);
    }
    for (const folder of parsed.folders) {
      throwIfAborted(opts.signal);
      const candidate = new URL(folder.url);
      const key = keyForVisited(candidate);
      const role = folderRole(candidate);
      if (!role) continue;
      let child = folders.get(key);
      if (!child) {
        if (!canAdd()) break;
        const depth = role === "child" ? node.depth + relativeDepth(final, candidate) : 0;
        child = { ...createNode(folder.url, role, depth, state.errors), date: folder.date ?? null };
        folders.set(key, child);
      }
      if (role === "child" && !parents.has(child) && !state.visited.has(key)) {
        parents.set(child, node);
        node.children.push(child);
      }
    }
    for (const file of parsed.files) {
      throwIfAborted(opts.signal);
      const key = keyForFile(new URL(file.url));
      if (files.has(key)) continue;
      if (!canAdd()) break;
      const entry = {
        kind: "file",
        url: file.url,
        name: file.name || "",
        rawName: file.rawName || "",
        hidden: file.hidden || false,
        size: file.size ?? null,
        date: file.date ?? null
      };
      files.set(key, entry);
      node.files.push(entry);
    }
    return node;
  };
  state.visited.add(keyForVisited(new URL(root.url)));
  await loadDirectory(root);
  for (const [url, role] of [[rootDirectory(new URL(root.url)), "root"], [parentDirectory(new URL(root.url)), "parent"]]) {
    if (!url || folders.has(keyForVisited(new URL(url)))) continue;
    if (!canAdd()) break;
    folders.set(keyForVisited(new URL(url)), createNode(url, role, 0, state.errors));
  }
  const pending = [];
  const enqueue = (parent) => {
    for (let index = parent.children.length - 1; index >= 0; index--) {
      const node = parent.children[index];
      if (node.depth <= opts.maxDepth) pending.push({ node, parent });
    }
  };
  enqueue(root);
  while (pending.length > 0) {
    throwIfAborted(opts.signal);
    if (entryCount() >= opts.maxEntries) {
      reportLimit();
      break;
    }
    const next = pending.pop();
    const key = keyForVisited(new URL(next.node.url));
    if (state.visited.has(key)) continue;
    state.visited.add(key);
    try {
      const loaded = await loadDirectory(next.node, next.parent);
      if (loaded) enqueue(loaded);
    } catch (error) {
      throwIfAborted(opts.signal);
      if (!opts.continueOnError) throw error;
      pushError(state.errors, "traversal", `failed to load ${next.node.url}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  for (const folder of folders.values()) state.allFolders.push(folder);
  for (const file of files.values()) state.allFiles.push(file);
  state.safetyCount = entryCount();
  return root;
}
function createNode(url, role, depth, errors) {
  const rawName = new URL(url).pathname.split("/").filter(Boolean).pop() || "";
  const name = safeDecodeURIComponent(rawName, errors);
  return {
    kind: "folder",
    url,
    rawName,
    name,
    hidden: name.startsWith(".") && name !== "." && name !== "..",
    size: null,
    date: null,
    role,
    depth,
    children: [],
    files: []
  };
}
function isChild(base, candidate) {
  const parent = keyForVisited(base);
  const child = keyForVisited(candidate);
  return candidate.origin === base.origin && child.startsWith(parent) && child !== parent;
}
function relativeDepth(base, candidate) {
  return isChild(base, candidate) ? candidate.pathname.split("/").filter(Boolean).length - base.pathname.split("/").filter(Boolean).length : 1;
}

// src/core/mime.ts
async function enrichMime(files, opts, stats, errors) {
  throwIfAborted(opts.signal);
  if (!opts.includeMime || files.length === 0) return;
  let next = 0;
  const worker = async () => {
    while (next < files.length) {
      throwIfAborted(opts.signal);
      const file = files[next++];
      if (file.mime != null && file.size != null) continue;
      const request = createRequestController(opts.signal, opts.timeoutMs);
      try {
        const res = await fetch(file.url, { method: "HEAD", signal: request.signal });
        throwIfAborted(opts.signal);
        stats.heads++;
        if (res.ok) {
          if (file.mime == null) file.mime = res.headers.get("content-type");
          const length = res.headers.get("content-length");
          if (file.size == null && length && /^\d+$/.test(length)) {
            const size = Number(length);
            if (Number.isSafeInteger(size) && size >= 0) file.size = size;
          }
        } else if (res.status === 405 || res.status === 501) {
          pushError(errors, "mime", `HEAD not supported for ${file.url}`);
        } else {
          pushError(errors, "mime", `HEAD ${res.status} for ${file.url}`);
        }
      } catch {
        throwIfAborted(opts.signal);
        pushError(errors, "mime", `failed HEAD for ${file.url}`);
      } finally {
        request.dispose();
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(opts.headConcurrency, files.length) }, worker));
}

// src/folderApiRequest.ts
async function folderApiRequest(url, options) {
  const opts = normalizeOptions(options);
  throwIfAborted(opts.signal);
  const started = performance.now?.() ?? Date.now();
  const state = {
    visited: /* @__PURE__ */ new Set(),
    allFolders: [],
    allFiles: [],
    errors: [],
    stats: { fetches: 0, iframes: 0, heads: 0 },
    safetyCount: 0,
    maxDepthEncountered: 0
  };
  const rootNode = await traverse(url, opts, state);
  if (opts.includeMime) {
    await enrichMime(state.allFiles, opts, state.stats, state.errors);
  }
  const durationMs = (performance.now?.() ?? Date.now()) - started;
  const entries = [...state.allFolders, ...state.allFiles];
  return {
    url: rootNode.url,
    root: rootNode,
    folders: state.allFolders,
    files: state.allFiles,
    entries,
    generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    errors: state.errors,
    stats: {
      fetches: state.stats.fetches,
      iframes: state.stats.iframes,
      heads: state.stats.heads,
      durationMs,
      maxDepth: state.maxDepthEncountered
    }
  };
}

// src/browser.ts
var global = globalThis;
if (!global.folderApiRequest) global.folderApiRequest = folderApiRequest;
export {
  folderApiRequest
};
