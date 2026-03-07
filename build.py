import argparse
import base64
import mimetypes
import pathlib
import re
import time
from datetime import datetime

ROOT = pathlib.Path(__file__).resolve().parent
SRC = ROOT / "src"
DIST = ROOT / "dist"
TEMPLATE = SRC / "player.html"
ASSETS = SRC / "assets"
SVG_DIR = SRC / "svg"


def read_text(path: pathlib.Path) -> str:
    return path.read_text(encoding="utf-8")


def data_uri(path: pathlib.Path) -> str:
    mime, _ = mimetypes.guess_type(path.name)
    if not mime:
        mime = "application/octet-stream"
    encoded = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:{mime};base64,{encoded}"


def format_elapsed(seconds: float) -> str:
    if seconds < 1:
        return f"{seconds * 1000:.1f}ms"
    return f"{seconds:.3f}s"


def minify_css(css: str) -> str:
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.DOTALL)
    css = re.sub(r"\s+", " ", css)
    css = re.sub(r"\s*([{}:;,>+~])\s*", r"\1", css)
    css = re.sub(r";}", "}", css)
    return css.strip()


def _is_js_identifier_char(ch: str) -> bool:
    return ch.isalnum() or ch in "_$"


def _read_js_string(source: str, start: int, quote: str) -> tuple[str, int]:
    i = start + 1
    out = [quote]
    while i < len(source):
        ch = source[i]
        out.append(ch)
        i += 1
        if ch == "\\" and i < len(source):
            out.append(source[i])
            i += 1
            continue
        if ch == quote:
            break
    return "".join(out), i


def _read_js_regex(source: str, start: int) -> tuple[str, int]:
    i = start + 1
    out = ["/"]
    in_class = False
    while i < len(source):
        ch = source[i]
        out.append(ch)
        i += 1
        if ch == "\\" and i < len(source):
            out.append(source[i])
            i += 1
            continue
        if ch == "[":
            in_class = True
            continue
        if ch == "]" and in_class:
            in_class = False
            continue
        if ch == "/" and not in_class:
            break
    while i < len(source) and source[i].isalpha():
        out.append(source[i])
        i += 1
    return "".join(out), i


def _minify_js_segment(source: str, start: int = 0, stop_char: str | None = None) -> tuple[str, int]:
    i = start
    out: list[str] = []
    pending_gap = ""
    last_token_type = "start"
    last_token_value = ""
    regex_keywords = {
        "case",
        "delete",
        "do",
        "else",
        "in",
        "instanceof",
        "new",
        "return",
        "throw",
        "typeof",
        "void",
        "yield",
        "await",
    }
    operator_tokens = sorted(
        (
            ">>>=",
            "===",
            "!==",
            ">>>",
            "<<=",
            ">>=",
            "**=",
            "&&=",
            "||=",
            "??=",
            "=>",
            "==",
            "!=",
            "<=",
            ">=",
            "++",
            "--",
            "&&",
            "||",
            "??",
            "<<",
            ">>",
            "**",
            "+=",
            "-=",
            "*=",
            "/=",
            "%=",
            "&=",
            "|=",
            "^=",
            "?.",
            "...",
        ),
        key=len,
        reverse=True,
    )

    def last_output_char() -> str:
        if not out:
            return ""
        return out[-1][-1]

    def should_emit_space(next_token: str) -> bool:
        prev = last_output_char()
        if pending_gap != " " or not prev or not next_token:
            return False
        next_char = next_token[0]
        if _is_js_identifier_char(prev) and _is_js_identifier_char(next_char):
            return True
        if prev in "+-" and next_char == prev:
            return True
        if prev == "/" and next_char in "/*":
            return True
        if (prev.isdigit() and next_char == ".") or (prev == "." and next_char.isdigit()):
            return True
        return False

    def mark_gap(*, newline: bool = False) -> None:
        nonlocal pending_gap
        if newline:
            pending_gap = "\n"
        elif not pending_gap:
            pending_gap = " "

    def emit(token: str, token_type: str, token_value: str = "") -> None:
        nonlocal pending_gap, last_token_type, last_token_value
        if pending_gap == "\n":
            if out and last_output_char() != "\n":
                out.append("\n")
        elif should_emit_space(token):
            out.append(" ")
        out.append(token)
        pending_gap = ""
        last_token_type = token_type
        last_token_value = token_value or token

    def can_start_regex() -> bool:
        if last_token_type == "start":
            return True
        if last_token_type == "word":
            return last_token_value in regex_keywords
        return last_token_type in {"open", "operator"}

    while i < len(source):
        ch = source[i]
        if stop_char and ch == stop_char:
            break
        if ch.isspace():
            mark_gap(newline=(ch in "\r\n"))
            i += 1
            continue
        if ch == "/" and i + 1 < len(source):
            nxt = source[i + 1]
            if nxt == "/":
                i += 2
                while i < len(source) and source[i] not in "\r\n":
                    i += 1
                mark_gap(newline=True)
                continue
            if nxt == "*":
                comment = source[i + 2 : source.find("*/", i + 2) if source.find("*/", i + 2) != -1 else len(source)]
                i += 2
                while i + 1 < len(source) and source[i : i + 2] != "*/":
                    i += 1
                i = min(i + 2, len(source))
                mark_gap(newline=("\n" in comment or "\r" in comment))
                continue
            if can_start_regex():
                token, i = _read_js_regex(source, i)
                emit(token, "literal", "/")
                continue
        if ch in ("'", '"'):
            token, i = _read_js_string(source, i, ch)
            emit(token, "literal", ch)
            continue
        if ch == "`":
            token, i = _read_js_template(source, i)
            emit(token, "literal", "`")
            continue
        if _is_js_identifier_char(ch):
            j = i + 1
            while j < len(source) and _is_js_identifier_char(source[j]):
                j += 1
            token = source[i:j]
            emit(token, "word", token)
            i = j
            continue
        if ch.isdigit() or (ch == "." and i + 1 < len(source) and source[i + 1].isdigit()):
            j = i + 1
            while j < len(source) and re.match(r"[0-9A-Fa-f_xXbBoO\.eE\+\-]", source[j]):
                j += 1
            token = source[i:j]
            emit(token, "number", token)
            i = j
            continue
        token = ch
        for candidate in operator_tokens:
            if source.startswith(candidate, i):
                token = candidate
                break
        token_type = "operator"
        if token in ("(", "[", "{"):
            token_type = "open"
        elif token in (")", "]", "}"):
            token_type = "close"
        emit(token, token_type, token)
        i += len(token)
    return "".join(out), i


def _read_js_template(source: str, start: int) -> tuple[str, int]:
    i = start + 1
    out = ["`"]
    while i < len(source):
        ch = source[i]
        if ch == "\\" and i + 1 < len(source):
            out.append(ch)
            out.append(source[i + 1])
            i += 2
            continue
        if ch == "`":
            out.append(ch)
            i += 1
            break
        if ch == "$" and i + 1 < len(source) and source[i + 1] == "{":
            out.append("${")
            expr, i = _minify_js_segment(source, i + 2, stop_char="}")
            out.append(expr)
            if i < len(source) and source[i] == "}":
                out.append("}")
                i += 1
            continue
        out.append(ch)
        i += 1
    return "".join(out), i


def minify_js(js: str) -> str:
    minified, _ = _minify_js_segment(js, 0, None)
    return minified.strip()


def minify_svg(svg: str) -> str:
    svg = re.sub(r"<!--.*?-->", "", svg, flags=re.DOTALL)
    svg = re.sub(r">\s+<", "><", svg)
    svg = re.sub(r"\s{2,}", " ", svg)
    return svg.strip()


def minify_html(html: str) -> str:
    html = re.sub(r"<!--(?!\[if).*?-->", "", html, flags=re.DOTALL)
    html = re.sub(r">\s+<", "><", html)
    return html.strip()


def inline_styles(html: str, *, minify: bool = False, metrics: dict[str, float] | None = None) -> str:
    pattern = re.compile(
        r"<style([^>]*)\sdata-inline=['\"]([^'\"]+)['\"]([^>]*)>\s*</style>",
        re.IGNORECASE | re.DOTALL,
    )

    def repl(match: re.Match) -> str:
        attrs = (match.group(1) + match.group(3)).strip()
        attrs = f" {attrs}" if attrs else ""
        css_path = SRC / match.group(2)
        css = read_text(css_path).rstrip()
        if minify:
            t0 = time.perf_counter()
            css = minify_css(css)
            if metrics is not None:
                metrics["css"] = metrics.get("css", 0.0) + (time.perf_counter() - t0)
        return f"<style{attrs}>{css}</style>"

    return pattern.sub(repl, html)


def remove_dev_stylesheet(html: str) -> str:
    pattern = re.compile(
        r"<link[^>]*rel=['\"]stylesheet['\"][^>]*href=['\"]\./styles\.css['\"][^>]*>",
        re.IGNORECASE,
    )
    return pattern.sub("", html)


def inline_scripts(html: str, *, minify: bool = False, metrics: dict[str, float] | None = None) -> str:
    pattern = re.compile(
        r"<script([^>]*)\sdata-inline[^>]*></script>",
        re.IGNORECASE | re.DOTALL,
    )

    def repl(match: re.Match) -> str:
        tag = match.group(0)
        src_match = re.search(r"src=['\"]([^'\"]+)['\"]", tag, re.IGNORECASE)
        if not src_match:
            return tag
        type_match = re.search(r"type=['\"]([^'\"]+)['\"]", tag, re.IGNORECASE)
        script_type = f" type=\"{type_match.group(1)}\"" if type_match else ""
        src_path = SRC / src_match.group(1)
        content = read_text(src_path).rstrip()
        if minify:
            t0 = time.perf_counter()
            content = minify_js(content)
            if metrics is not None:
                metrics["js"] = metrics.get("js", 0.0) + (time.perf_counter() - t0)
        return f"<script{script_type}>\n{content}\n</script>"

    return pattern.sub(repl, html)


def inline_svg_sprite(html: str, *, minify: bool = False, metrics: dict[str, float] | None = None) -> str:
    pattern = re.compile(
        r"<section([^>]*)\sdata-inline=['\"]svg['\"]([^>]*)></section>",
        re.IGNORECASE | re.DOTALL,
    )

    def repl(match: re.Match) -> str:
        attrs = (match.group(1) + match.group(2)).strip()
        attrs = f" {attrs}" if attrs else ""
        svgs = []
        for svg_path in sorted(SVG_DIR.glob("*.svg")):
            svg = read_text(svg_path).strip()
            if minify:
                t0 = time.perf_counter()
                svg = minify_svg(svg)
                if metrics is not None:
                    metrics["svg"] = metrics.get("svg", 0.0) + (time.perf_counter() - t0)
            svgs.append(svg)
        sprite = "\n".join(svgs)
        return f"<section{attrs}>\n{sprite}\n</section>"

    return pattern.sub(repl, html)


def inline_assets(html: str) -> str:
    if not ASSETS.exists():
        return html
    for asset in sorted(ASSETS.iterdir()):
        if not asset.is_file():
            continue
        uri = data_uri(asset)
        html = html.replace(f"./assets/{asset.name}", uri)
    return html


def build_variant(out_name: str, *, minify: bool = False) -> tuple[pathlib.Path, float, dict[str, float]]:
    build_started = time.perf_counter()
    minify_metrics: dict[str, float] = {}
    html = read_text(TEMPLATE)
    html = inline_styles(html, minify=minify, metrics=minify_metrics)
    html = remove_dev_stylesheet(html)
    html = inline_svg_sprite(html, minify=minify, metrics=minify_metrics)
    html = inline_scripts(html, minify=minify, metrics=minify_metrics)
    html = inline_assets(html)
    if minify:
        t0 = time.perf_counter()
        html = minify_html(html)
        minify_metrics["html"] = minify_metrics.get("html", 0.0) + (time.perf_counter() - t0)

    DIST.mkdir(parents=True, exist_ok=True)
    out_path = DIST / out_name
    out_path.write_text(html, encoding="utf-8")
    elapsed = time.perf_counter() - build_started
    return out_path, elapsed, minify_metrics


def format_build_message(out_path: pathlib.Path, elapsed: float, *, minify: bool = False, metrics: dict[str, float] | None = None) -> str:
    message = f"Built {out_path}"
    if minify:
        message += " (minified)"
    message += f" in {format_elapsed(elapsed)}"
    if minify and metrics:
        parts = []
        for key in ("css", "svg", "js", "html"):
            if key in metrics:
                parts.append(f"{key}={format_elapsed(metrics[key])}")
        if parts:
            message += f" [minify: {', '.join(parts)}]"
    return message


def build(log_fn=None, *, dev: bool = False) -> None:
    total_started = time.perf_counter()
    outputs: list[tuple[pathlib.Path, float, bool, dict[str, float]]] = []
    outputs.append((*build_variant("player.html", minify=False), False))
    if not dev:
        outputs.append((*build_variant("player.min.html", minify=True), True))

    for out_path, elapsed, metrics, is_minified in outputs:
        message = format_build_message(out_path, elapsed, minify=is_minified, metrics=metrics)
        if log_fn:
            log_fn(message)
        else:
            print(message)

    total_elapsed = time.perf_counter() - total_started
    summary = f"Built {len(outputs)} output{'s' if len(outputs) != 1 else ''} in {format_elapsed(total_elapsed)}"
    if dev:
        summary += " (--dev)"
    if log_fn:
        log_fn(summary)
    else:
        print(summary)


def collect_sources() -> list[pathlib.Path]:
    paths = [TEMPLATE]
    for path in SRC.rglob("*"):
        if path.is_file():
            paths.append(path)
    paths.append(pathlib.Path(__file__))
    return paths


def snapshot(paths: list[pathlib.Path]) -> dict[pathlib.Path, int]:
    data = {}
    for path in paths:
        try:
            data[path] = path.stat().st_mtime_ns
        except FileNotFoundError:
            data[path] = 0
    return data


def watch(*, dev: bool = False) -> None:
    def log(message: str) -> None:
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"[{timestamp}] {message}")

    paths = collect_sources()
    prev = snapshot(paths)
    build(log_fn=log, dev=dev)
    log("Watching for changes... (Ctrl+C to stop)")
    while True:
        time.sleep(0.5)
        paths = collect_sources()
        curr = snapshot(paths)
        if curr != prev:
            changed = []
            for path in sorted(set(prev.keys()) | set(curr.keys())):
                if prev.get(path) != curr.get(path):
                    try:
                        changed.append(str(path.relative_to(ROOT)))
                    except ValueError:
                        changed.append(str(path))

            if changed:
                log(f"Change detected: {', '.join(changed)}")
            else:
                log("Change detected")

            prev = curr
            build(log_fn=log, dev=dev)


def main() -> None:
    parser = argparse.ArgumentParser(description="Build dist/player.html from src/")
    parser.add_argument("--watch", action="store_true", help="Rebuild on file changes")
    parser.add_argument("--dev", action="store_true", help="Skip building dist/player.min.html and only write dist/player.html")
    args = parser.parse_args()

    if args.watch:
        watch(dev=args.dev)
    else:
        build(dev=args.dev)


if __name__ == "__main__":
    main()
