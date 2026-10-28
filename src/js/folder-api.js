/*! folder-api v3.0.0 browser bundle. Generated from TypeScript. MIT License. */

// src/options.ts
var integerOption = (value, fallback, minimum, maximum = Number.MAX_SAFE_INTEGER) => typeof value === "number" && Number.isFinite(value) ? Math.min(maximum, Math.max(minimum, Math.trunc(value))) : fallback;
function normalizeOptions(opts) {
  const mode = opts?.mode === "fetch" || opts?.mode === "iframe" ? opts.mode : "auto";
  const requestedCache = opts?.cache ?? "default";
  const cache = ["default", "no-store", "no-cache", "reload", "force-cache", "only-if-cached"].includes(requestedCache) ? requestedCache : "default";
  if (mode === "iframe" && cache !== "default") {
    throw new TypeError(`mode: 'iframe' only supports cache: 'default'. Iframe navigation cannot honor cache: '${cache}'. Use mode: 'fetch' or mode: 'auto' instead.`);
  }
  const listingSelector = opts?.listingSelector;
  if (listingSelector !== void 0 && (typeof listingSelector !== "string" || !listingSelector.trim())) {
    throw new TypeError("listingSelector must be a nonempty CSS selector string");
  }
  return {
    maxDepth: integerOption(opts?.maxDepth, 0, 0),
    maxEntries: integerOption(opts?.maxEntries, 5e4, 1, 5e4),
    maxResponseBytes: integerOption(opts?.maxResponseBytes, 4 * 1024 * 1024, 1),
    continueOnError: opts?.continueOnError === true,
    mode,
    cache,
    listingSelector,
    includeMime: opts?.includeMime ?? false,
    includeProvenance: opts?.includeProvenance === true,
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
    abort: () => controller.abort(),
    dispose: () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    }
  };
}

// src/utils/errors.ts
function pushError(errors, prefix, message) {
  errors.push(`${prefix}: ${message}`);
}
function recordError(sink, detail) {
  sink.errors.push(detail.message);
  sink.errorDetails.push(detail);
}
function recordParseErrors(sink, errors, url) {
  for (const message of errors) {
    const category = message.split(":", 1)[0];
    recordError(sink, { category, code: category === "limit" ? "limit" : "parse", phase: "parse", url, message });
  }
}
var RequestFailure = class extends Error {
  constructor(details, cause) {
    super(details.message);
    this.details = details;
    this.cause = cause;
    this.name = details.code === "timeout" ? "TimeoutError" : "Error";
  }
};
function describeCause(error) {
  if (typeof error === "object" && error !== null && "message" in error) {
    return { name: "name" in error ? String(error.name) : "Error", message: String(error.message) };
  }
  return { name: "Error", message: String(error) };
}
function requestFailure(error, phase, url, timeoutMs) {
  if (error instanceof RequestFailure) return error;
  const cause = describeCause(error);
  const code = cause.name === "TimeoutError" ? "timeout" : phase === "iframe" ? "iframe" : "network";
  const operation = phase === "head" ? "HEAD" : phase === "fetch" ? "GET" : "iframe";
  const message = code === "timeout" ? `${operation} ${url} timed out after ${timeoutMs}ms` : `${operation} ${url} failed: ${cause.name}: ${cause.message}`;
  return new RequestFailure({ category: phase === "head" ? "mime" : "traversal", code, phase, url, message, cause }, error);
}

// src/utils/document.ts
var htmlNamespace = "http://www.w3.org/1999/xhtml";
function listingContentType(raw, phase, url) {
  const type = raw.split(";", 1)[0].trim().toLowerCase();
  if (type === "text/html" || type === "application/xhtml+xml") return type;
  throw new RequestFailure({
    category: "traversal",
    code: "content-type",
    phase,
    url,
    message: `${phase === "fetch" ? "GET" : "iframe"} ${url} returned unsupported content-type: ${raw || "(missing)"}`
  });
}
function validateListingDocument(doc, type, url) {
  if (type === "application/xhtml+xml" && (doc.getElementsByTagNameNS("*", "parsererror").length > 0 || doc.documentElement?.namespaceURI !== htmlNamespace || doc.documentElement.localName !== "html")) {
    throw new RequestFailure({
      category: "traversal",
      code: "parse",
      phase: "parse",
      url,
      message: `Malformed XHTML directory listing at ${url}`
    });
  }
}
function responseLimit(url, phase, maximum) {
  return new RequestFailure({
    category: "limit",
    code: "response-limit",
    phase,
    url,
    message: `Directory response for ${url} exceeds maxResponseBytes (${maximum} bytes)`
  });
}
function checkSerializedSize(html, url, maximum) {
  let bytes = 0;
  for (const character of html) {
    const point = character.codePointAt(0);
    bytes += point <= 127 ? 1 : point <= 2047 ? 2 : point <= 65535 ? 3 : 4;
    if (bytes > maximum) throw responseLimit(url, "iframe", maximum);
  }
}

// src/core/fetchDirectory.ts
async function fetchDirectoryHtml(url, opts, stats) {
  const request = createRequestController(opts.signal, opts.timeoutMs);
  let res;
  let complete = false;
  try {
    stats.fetches++;
    res = await fetch(url, {
      redirect: "follow",
      cache: opts.cache,
      mode: opts.cache === "only-if-cached" ? "same-origin" : void 0,
      signal: request.signal,
      headers: {
        "Accept": "text/html,application/xhtml+xml"
      }
    });
    if (res.status !== 200) throw new RequestFailure({
      category: "traversal",
      code: "http",
      phase: "fetch",
      url,
      status: res.status,
      message: `GET ${url} returned HTTP ${res.status}${res.statusText ? " " + res.statusText : ""}`
    });
    const contentType = listingContentType(res.headers.get("content-type") || "", "fetch", url);
    const html = await readLimitedBody(res, res.url || url, opts.maxResponseBytes);
    throwIfAborted(opts.signal);
    complete = true;
    return { html, url: res.url || url, contentType };
  } catch (error) {
    throwIfAborted(opts.signal);
    throw requestFailure(request.signal.aborted ? request.signal.reason : error, "fetch", url, opts.timeoutMs);
  } finally {
    if (!complete) {
      request.abort();
      if (res?.body && !res.body.locked) void res.body.cancel().catch(() => {
      });
    }
    request.dispose();
  }
}
async function readLimitedBody(response, url, maximum) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const parts = [];
  let bytes = 0;
  try {
    for (; ; ) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maximum) throw responseLimit(url, "fetch", maximum);
      parts.push(decoder.decode(value, { stream: true }));
    }
    parts.push(decoder.decode());
    return parts.join("");
  } catch (error) {
    void reader.cancel().catch(() => {
    });
    throw error;
  } finally {
    reader.releaseLock();
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
    const timer = setTimeout(() => fail(new DOMException("iframe timeout", "TimeoutError")), opts.timeoutMs);
    function cleanup() {
      clearTimeout(timer);
      iframe.removeEventListener("load", onLoad);
      iframe.removeEventListener("error", onError);
      opts.signal?.removeEventListener("abort", onAbort);
      iframe.remove();
    }
    function fail(error) {
      cleanup();
      reject(opts.signal?.aborted ? opts.signal.reason ?? new DOMException("The operation was aborted", "AbortError") : requestFailure(error, "iframe", url, opts.timeoutMs));
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
        const finalUrl = doc.URL || url;
        const contentType = listingContentType(doc.contentType, "iframe", finalUrl);
        validateListingDocument(doc, contentType, finalUrl);
        const html = contentType === "application/xhtml+xml" ? new XMLSerializer().serializeToString(doc.documentElement) : doc.documentElement?.outerHTML || "";
        checkSerializedSize(html, finalUrl, opts.maxResponseBytes);
        const result = { html, url: finalUrl, contentType };
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
  if (/<\s*dir\s*>|\[(?:dir|folder|directory)\]/i.test(metadataText) || /^(?:dir|folder|directory)$/i.test(metadataText.trim())) return "folder";
  return "file";
}
function detectHidden(decodedName) {
  return isHiddenName(decodedName);
}

// src/utils/date.ts
var datePatterns = [
  /\b(\d{4})-(\d{2})-(\d{2})/i,
  /\b(\d{1,2})-([a-z]{3})-(\d{4})/i,
  /\b(\d{1,2})\/(\d{1,2})\/(\d{4})/i
];
var clockPattern = /^(?:T|\s+)(\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?/i;
var remainingMetadata = /^\s+(?:\d+(?:,\d{3})*(?:\.\d+)?\s*(?:[KMGTP](?:i?B)?|B|bytes?)?|<dir>|-)\s*$/i;
function parseDateMetadata(text, errors) {
  const matches = datePatterns.map((pattern, family2) => ({ match: pattern.exec(text), family: family2 })).filter((candidate) => candidate.match !== null).sort((a, b) => a.match.index - b.match.index);
  if (matches.length === 0) {
    if (/\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/.test(text)) errors.push("date: ambiguous numeric date pattern");
    return null;
  }
  const { match, family } = matches[0];
  const year = +(family === 0 ? match[1] : match[3]);
  const month = family === 1 ? ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(match[2].toLowerCase()) + 1 : +(family === 0 ? match[2] : match[1]);
  const day = +(family === 0 ? match[3] : family === 1 ? match[1] : match[2]);
  let end = match.index + match[0].length;
  const clock = clockPattern.exec(text.slice(end));
  if (clock) end += clock[0].length;
  else if (family === 1 || /^(?:T|\s+\d+:)/i.test(text.slice(end))) return invalidDate(errors);
  const meridiem = clock ? /^\s*(AM|PM)\b/i.exec(text.slice(end)) : null;
  if (meridiem) end += meridiem[0].length;
  if (family === 2 && (!clock || !meridiem)) {
    errors.push("date: ambiguous numeric date pattern");
    return null;
  }
  const zone = clock ? /^\s*(Z|[+-]\d{2}:?\d{2})(?![\da-z])/i.exec(text.slice(end)) : null;
  if (zone) end += zone[0].length;
  const remainder = text.slice(end);
  if (remainder.trim() && !remainingMetadata.test(remainder)) return invalidDate(errors);
  let hour = +(clock?.[1] || 0);
  if (meridiem) {
    if (hour < 1 || hour > 12) return invalidDate(errors);
    hour = hour % 12 + (/pm/i.test(meridiem[1]) ? 12 : 0);
  }
  const value = validatedDate(
    year,
    month,
    day,
    hour,
    +(clock?.[2] || 0),
    +(clock?.[3] || 0),
    +(clock?.[4] || "").padEnd(3, "0").slice(0, 3),
    zone?.[1] || "",
    errors
  );
  return value === null ? null : {
    value,
    raw: text.slice(match.index, end).trim(),
    timezone: zone ? "explicit" : "assumed-utc",
    start: match.index,
    end
  };
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
    date.setTime(date.getTime() - (hours * 60 + minutes) * (zone[0] === "+" ? 1 : -1) * 6e4);
  }
  return date.toISOString();
}
function invalidDate(errors) {
  errors.push("date: invalid date or time");
  return null;
}
function stripDateTime(text) {
  const date = parseDateMetadata(text, []);
  return date ? text.slice(0, date.start) + text.slice(date.end) : text;
}

// src/utils/size.ts
function parseSizeMetadata(text) {
  const metadata = stripDateTime(text).trim();
  const match = /^(\d+(?:,\d{3})*(?:\.\d+)?)\s*([KMGTP](?:i?B)?|B|bytes?)?$/i.exec(metadata);
  if (!match) return null;
  const unit = (match[2] || "").toUpperCase();
  const power = unit && !unit.startsWith("B") ? "KMGTP".indexOf(unit[0]) + 1 : 0;
  const bytes = Number(match[1].replace(/,/g, "")) * Math.pow(1024, power);
  return Number.isFinite(bytes) ? {
    value: Math.floor(bytes),
    raw: metadata,
    precision: power > 0 || !Number.isSafeInteger(bytes) ? "estimated" : "exact"
  } : null;
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

// src/core/parseDirectory.ts
var dateHeaderLabels = /* @__PURE__ */ new Set([
  "date",
  "modified",
  "last modified",
  "modified date",
  "date modified",
  "last modified date",
  "date last modified",
  "modification date",
  "timestamp",
  "last write",
  "last write time"
]);
function parseDirectoryHtml(baseUrl, html, opts, admitEntry, contentType = "text/html") {
  throwIfAborted(opts.signal);
  const errors = [];
  const doc = new DOMParser().parseFromString(html, contentType);
  validateListingDocument(doc, contentType, baseUrl);
  const anchors = listingAnchors(doc, opts.listingSelector, baseUrl);
  const base = new URL(baseUrl);
  let linkBase = base;
  const baseHref = Array.from(doc.getElementsByTagNameNS(htmlNamespace, "base")).find((element) => element.hasAttribute("href"))?.getAttribute("href");
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
  const tables = /* @__PURE__ */ new WeakMap();
  const folders = [];
  const files = [];
  for (const anchor of anchors) {
    throwIfAborted(opts.signal);
    const href = anchor.getAttribute("href")?.trim();
    const container = ancestor(anchor, ["th", "tr", "li"]);
    if (!href || href.includes("#") || container?.localName === "th") continue;
    let url;
    try {
      url = new URL(href, linkBase);
    } catch {
      pushError(errors, "url", `invalid link '${href}'`);
      continue;
    }
    if (!/^https?:$/.test(url.protocol) || opts.sameOriginOnly && url.origin !== base.origin) continue;
    if (url.origin === base.origin && url.pathname === base.pathname && url.search && url.search !== base.search) continue;
    const metadata = deriveMetadataFields(anchor, container, tables);
    const typeText = metadata.schemaKnown ? metadata.fields[metadata.typeIndex ?? -1] || "" : metadata.fields.join(" ");
    const kind = classifyEntry(url, typeText);
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
    const fieldsFor = (index) => index !== void 0 ? [metadata.fields[index] || ""] : metadata.schemaKnown ? [] : metadata.fields;
    let date = null;
    for (const field of fieldsFor(metadata.dateIndex)) {
      if (!field.trim() || field.trim() === "-") continue;
      date = parseDateMetadata(field, errors);
      if (date) break;
    }
    let size = null;
    for (const field of fieldsFor(metadata.sizeIndex)) {
      if (!field.trim() || field.trim() === "-") continue;
      const candidate = parseSizeMetadata(field);
      if (!candidate) continue;
      if (size && size.value !== candidate.value) {
        size = null;
        break;
      }
      size = candidate;
    }
    const provenance = {};
    if (opts.includeProvenance) {
      if (date) provenance.date = { source: "listing", raw: date.raw, timezone: date.timezone };
      if (kind === "file" && size) provenance.size = { source: "listing", raw: size.raw, precision: size.precision };
    }
    const entry = {
      url: url.href,
      rawName,
      name,
      hidden: detectHidden(name),
      date: date?.value ?? null,
      ...Object.keys(provenance).length ? { provenance } : {}
    };
    if (kind === "folder") folders.push({ ...entry, kind: "folder", size: null });
    else files.push({ ...entry, kind: "file", size: size?.value ?? null });
  }
  return { folders, files, errors };
}
function listingAnchors(doc, selector, url) {
  let containers;
  if (selector !== void 0) {
    try {
      containers = new Set(doc.querySelectorAll(selector));
    } catch (error) {
      throw new RequestFailure({
        category: "traversal",
        code: "parse",
        phase: "parse",
        url,
        message: `Invalid listingSelector '${selector}' for ${url}`,
        cause: describeCause(error)
      }, error);
    }
    if (containers.size === 0) throw new RequestFailure({
      category: "traversal",
      code: "parse",
      phase: "parse",
      url,
      message: `listingSelector '${selector}' did not match any elements in ${url}`
    });
  }
  const anchors = Array.from(doc.getElementsByTagNameNS(htmlNamespace, "a")).filter((anchor) => anchor.hasAttribute("href"));
  if (containers) {
    return anchors.filter((anchor) => {
      for (let element = anchor; element; element = element.parentElement) {
        if (containers.has(element)) return true;
      }
      return false;
    });
  }
  const preferred = anchors.filter((anchor) => ancestor(anchor, ["pre", "table", "ul", "ol"]));
  return preferred.length ? preferred : anchors;
}
function ancestor(element, names) {
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    if (parent.namespaceURI === htmlNamespace && names.includes(parent.localName)) return parent;
  }
  return null;
}
function deriveMetadataFields(anchor, container, tables) {
  if (container?.localName === "tr") {
    const table = ancestor(container, ["table"]);
    if (table) {
      let rows = tables.get(table);
      if (!rows) {
        rows = tableMetadata(table);
        tables.set(table, rows);
      }
      return rows.get(container) || { fields: [] };
    }
  }
  if (container?.localName === "li") return { fields: [readMetadataText(container)] };
  const adjacentText = (before) => {
    const parts = [];
    for (let node = before ? anchor.previousSibling : anchor.nextSibling; node; node = before ? node.previousSibling : node.nextSibling) {
      if (node.nodeType === 1) {
        const element = node;
        if (element.namespaceURI === htmlNamespace && ["a", "br"].includes(element.localName) || element.getElementsByTagNameNS(htmlNamespace, "a").length || element.getElementsByTagNameNS(htmlNamespace, "br").length) break;
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
function tableMetadata(table) {
  const rows = Array.from(table.getElementsByTagNameNS(htmlNamespace, "tr")).filter((row) => ancestor(row, ["table"]) === table);
  const layouts = /* @__PURE__ */ new Map();
  let active = [];
  let group = null;
  const headerRows = [];
  for (const row of rows) {
    const rowGroup = ancestor(row, ["thead", "tbody", "tfoot", "table"]);
    if (rowGroup !== group) {
      active = [];
      group = rowGroup;
    }
    const cells = Array.from(row.children).filter((cell) => cell.namespaceURI === htmlNamespace && ["td", "th"].includes(cell.localName));
    if (cells.some((cell) => cell.localName === "th") && !cells.some((cell) => cell.localName === "td" && cell.getElementsByTagNameNS(htmlNamespace, "a").length)) headerRows.push(row);
    const placed = [...active];
    const next = active.filter((cell) => cell.remaining > 1).map((cell) => ({ ...cell, remaining: cell.remaining - 1 }));
    let column = 0;
    let activeIndex = 0;
    for (const cell of cells) {
      const width = span(cell, "colspan", 1e3);
      while (activeIndex < active.length) {
        const occupied = active[activeIndex];
        if (occupied.end <= column) activeIndex++;
        else if (occupied.start < column + width) {
          column = occupied.end;
          activeIndex++;
        } else break;
      }
      const position = { cell, start: column, end: column + width };
      placed.push(position);
      const height = cell.getAttribute("rowspan")?.trim() === "0" ? Infinity : span(cell, "rowspan", 65534);
      if (height > 1) next.push({ ...position, remaining: height - 1 });
      column += width;
    }
    layouts.set(row, placed.sort((a, b) => a.start - b.start));
    active = next.sort((a, b) => a.start - b.start);
  }
  let sizeColumn;
  let dateColumn;
  let typeColumn;
  let schemaKnown = false;
  for (const row of headerRows) {
    for (const position of layouts.get(row) || []) {
      const label = position.cell.textContent?.trim().toLowerCase().replace(/\s+/g, " ") || "";
      if (/^(?:file\s+)?size$|^length$/.test(label)) {
        sizeColumn = position.start;
        schemaKnown = true;
      }
      const dateLabel = label.replace(/[-_\s]+/g, " ").replace(/ \([^)]*\)$/, "");
      if (dateHeaderLabels.has(dateLabel)) {
        dateColumn = position.start;
        schemaKnown = true;
      }
      if (/^(?:type|kind)$/.test(label)) {
        typeColumn = position.start;
        schemaKnown = true;
      }
      if (/^(?:(?:file ?)?name|description|permissions?|mode)$/.test(label)) schemaKnown = true;
    }
  }
  const result = /* @__PURE__ */ new Map();
  const text = /* @__PURE__ */ new WeakMap();
  for (const [row, positions] of layouts) {
    const index = (column) => column === void 0 ? void 0 : positions.findIndex((position) => position.start <= column && column < position.end);
    result.set(row, { fields: positions.map((position) => {
      let value = text.get(position.cell);
      if (value === void 0) {
        value = readMetadataText(position.cell);
        text.set(position.cell, value);
      }
      return value;
    }), schemaKnown, sizeIndex: index(sizeColumn), dateIndex: index(dateColumn), typeIndex: index(typeColumn) });
  }
  return result;
}
function span(cell, attribute, maximum) {
  const raw = cell.getAttribute(attribute)?.trim() || "";
  const value = /^\d+$/.test(raw) ? Number(raw) : 1;
  return Math.min(maximum, Math.max(1, value));
}
function readMetadataText(element) {
  const parts = [];
  const pending = Array.from(element.childNodes).reverse();
  while (pending.length) {
    const node = pending.pop();
    if (node.nodeType === 3 || node.nodeType === 4) parts.push(node.textContent || "");
    else if (node.nodeType === 1) {
      const child = node;
      if (child.namespaceURI !== htmlNamespace || !["a", "ul", "ol", "table"].includes(child.localName)) {
        for (let index = child.childNodes.length - 1; index >= 0; index--) pending.push(child.childNodes[index]);
      }
    }
  }
  return parts.join(" ").trim();
}

// src/core/recursion.ts
async function traverse(startUrl, opts, state) {
  const root = createNode(normalizeDirectoryUrl(startUrl), "self", 0, state);
  const folders = /* @__PURE__ */ new Map([[keyForVisited(new URL(root.url)), root]]);
  const parents = /* @__PURE__ */ new WeakMap();
  const files = /* @__PURE__ */ new Map();
  let limitReported = false;
  const entryCount = () => folders.size + files.size;
  const reportLimit = () => {
    if (!limitReported) recordError(state, {
      category: "limit",
      code: "limit",
      phase: "traversal",
      url: root.url,
      message: "limit: entry limit exceeded"
    });
    limitReported = true;
  };
  const canAdd = () => {
    if (entryCount() < opts.maxEntries) return true;
    reportLimit();
    return false;
  };
  const detach = (node) => {
    const parent = parents.get(node);
    if (parent) parent.children = parent.children.filter((child) => child !== node);
    parents.delete(node);
  };
  const attach = (node, parent) => {
    if (parents.get(node) === parent) return;
    detach(node);
    parents.set(node, parent);
    parent.children.push(node);
  };
  const redirectedParent = (node) => {
    const start = new URL(root.url);
    if (!isChild(start, new URL(node.url))) return parents.get(node) || root;
    const startKey = keyForVisited(start);
    let url = parentDirectory(new URL(node.url));
    while (url) {
      const candidate = new URL(url);
      const key = keyForVisited(candidate);
      if (key !== startKey && !isChild(start, candidate)) break;
      const ancestor2 = folders.get(key);
      if (ancestor2 && ancestor2 !== node && (ancestor2 === root || ancestor2.role === "child")) return ancestor2;
      url = parentDirectory(candidate);
    }
    return root;
  };
  const loadDocument = async (url) => {
    throwIfAborted(opts.signal);
    if (opts.mode === "iframe") return await iframeDirectoryHtml(url, opts, state.stats);
    if (opts.mode === "fetch" || opts.cache !== "default") return await fetchDirectoryHtml(url, opts, state.stats);
    try {
      return await fetchDirectoryHtml(url, opts, state.stats);
    } catch (fetchError) {
      throwIfAborted(opts.signal);
      if (fetchError instanceof RequestFailure && fetchError.details.code === "response-limit") throw fetchError;
      try {
        return await iframeDirectoryHtml(url, opts, state.stats);
      } catch (iframeError) {
        throwIfAborted(opts.signal);
        const failure = requestFailure(iframeError, "iframe", url, opts.timeoutMs);
        failure.details.previous = requestFailure(fetchError, "fetch", url, opts.timeoutMs).details;
        throw failure;
      }
    }
  };
  const loadDirectory = async (node) => {
    const requestedKey = keyForVisited(new URL(node.url));
    const loaded = await loadDocument(node.url);
    throwIfAborted(opts.signal);
    const url = normalizeDirectoryUrl(loaded.url);
    const final = new URL(url);
    if (node !== root && opts.sameOriginOnly && final.origin !== new URL(root.url).origin) {
      throw new RequestFailure({
        category: "traversal",
        code: "scope",
        phase: "traversal",
        url,
        message: `Child directory redirected to another origin: ${node.url} -> ${url}`
      });
    }
    const finalKey = keyForVisited(final);
    if (node !== root && opts.sameOriginOnly && !isChild(new URL(root.url), final) && !folders.has(finalKey)) {
      throw new RequestFailure({
        category: "traversal",
        code: "scope",
        phase: "traversal",
        url,
        message: `Child directory redirected outside the starting directory: ${node.url} -> ${url}`
      });
    }
    if (finalKey !== requestedKey) {
      const existing = folders.get(finalKey);
      folders.delete(requestedKey);
      if (existing && existing !== node) {
        detach(node);
        if (existing.role !== "child" || state.visited.has(finalKey)) return null;
        node = existing;
      } else {
        const updated = createNode(url, node.role, node.depth, state);
        delete node.provenance;
        Object.assign(node, updated);
        folders.set(finalKey, node);
      }
    }
    node.url = url;
    if (node !== root && isChild(new URL(root.url), final)) node.depth = relativeDepth(new URL(root.url), final);
    if (node !== root && finalKey !== requestedKey) attach(node, redirectedParent(node));
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
    }, loaded.contentType);
    for (const error of parsed.errors) {
      if (error.startsWith("limit:")) reportLimit();
      else recordParseErrors(state, [error], url);
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
        child = {
          ...createNode(folder.url, role, depth, state),
          date: folder.date ?? null,
          ...folder.provenance ? { provenance: folder.provenance } : {}
        };
        folders.set(key, child);
      }
      if (role === "child" && !parents.has(child) && !state.visited.has(key)) {
        attach(child, node);
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
        date: file.date ?? null,
        ...file.provenance ? { provenance: file.provenance } : {}
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
    folders.set(keyForVisited(new URL(url)), createNode(url, role, 0, state));
  }
  const pending = [];
  const enqueue = (parent) => {
    for (let index = parent.children.length - 1; index >= 0; index--) {
      const node = parent.children[index];
      if (node.depth <= opts.maxDepth) pending.push(node);
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
    const key = keyForVisited(new URL(next.url));
    if (state.visited.has(key)) continue;
    state.visited.add(key);
    try {
      const loaded = await loadDirectory(next);
      if (loaded) enqueue(loaded);
    } catch (error) {
      throwIfAborted(opts.signal);
      if (!opts.continueOnError) throw error;
      const cause = describeCause(error);
      const failure = error instanceof RequestFailure ? error : new RequestFailure({
        category: "traversal",
        code: "parse",
        phase: "traversal",
        url: next.url,
        message: `${cause.name}: ${cause.message}`,
        cause
      }, error);
      recordError(state, {
        ...failure.details,
        category: "traversal",
        message: `traversal: failed to load ${next.url}: ${failure.message}`
      });
    }
  }
  for (const folder of folders.values()) state.allFolders.push(folder);
  for (const file of files.values()) state.allFiles.push(file);
  return root;
}
function createNode(url, role, depth, sink) {
  const rawName = new URL(url).pathname.split("/").filter(Boolean).pop() || "";
  const errors = [];
  const name = safeDecodeURIComponent(rawName, errors);
  recordParseErrors(sink, errors, url);
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
async function enrichMime(files, opts, stats, sink) {
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
        stats.heads++;
        const res = await fetch(file.url, { method: "HEAD", signal: request.signal });
        throwIfAborted(opts.signal);
        if (res.ok) {
          if (file.mime == null) {
            file.mime = res.headers.get("content-type");
            if (opts.includeProvenance && file.mime !== null) {
              (file.provenance ?? (file.provenance = {})).mime = { source: "head", raw: file.mime };
            }
          }
          const length = res.headers.get("content-length");
          if (file.size == null && length && /^\d+$/.test(length)) {
            const size = Number(length);
            if (Number.isSafeInteger(size) && size >= 0) {
              file.size = size;
              if (opts.includeProvenance) (file.provenance ?? (file.provenance = {})).size = { source: "head", raw: length, precision: "exact" };
            }
          }
        } else if (res.status === 405 || res.status === 501) {
          recordError(sink, {
            category: "mime",
            code: "unsupported-method",
            phase: "head",
            url: file.url,
            status: res.status,
            message: `mime: HEAD not supported for ${file.url}`
          });
        } else {
          recordError(sink, {
            category: "mime",
            code: "http",
            phase: "head",
            url: file.url,
            status: res.status,
            message: `mime: HEAD ${res.status} for ${file.url}`
          });
        }
      } catch (error) {
        throwIfAborted(opts.signal);
        const failure = requestFailure(request.signal.aborted ? request.signal.reason : error, "head", file.url, opts.timeoutMs);
        recordError(sink, { ...failure.details, message: `mime: ${failure.message}` });
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
    errorDetails: [],
    stats: { fetches: 0, iframes: 0, heads: 0 },
    maxDepthEncountered: 0
  };
  const rootNode = await traverse(url, opts, state);
  if (opts.includeMime) {
    await enrichMime(state.allFiles, opts, state.stats, state);
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
    errorDetails: state.errorDetails,
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
