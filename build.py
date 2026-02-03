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


def inline_styles(html: str) -> str:
    pattern = re.compile(
        r"<style([^>]*)\sdata-inline=['\"]([^'\"]+)['\"]([^>]*)>\s*</style>",
        re.IGNORECASE | re.DOTALL,
    )

    def repl(match: re.Match) -> str:
        attrs = (match.group(1) + match.group(3)).strip()
        attrs = f" {attrs}" if attrs else ""
        css_path = SRC / match.group(2)
        css = read_text(css_path).rstrip()
        return f"<style{attrs}>{css}</style>"

    return pattern.sub(repl, html)


def remove_dev_stylesheet(html: str) -> str:
    pattern = re.compile(
        r"<link[^>]*rel=['\"]stylesheet['\"][^>]*href=['\"]\./styles\.css['\"][^>]*>",
        re.IGNORECASE,
    )
    return pattern.sub("", html)


def inline_scripts(html: str) -> str:
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
        return f"<script{script_type}>\n{content}\n</script>"

    return pattern.sub(repl, html)


def inline_svg_sprite(html: str) -> str:
    pattern = re.compile(
        r"<section([^>]*)\sdata-inline=['\"]svg['\"]([^>]*)></section>",
        re.IGNORECASE | re.DOTALL,
    )

    def repl(match: re.Match) -> str:
        attrs = (match.group(1) + match.group(2)).strip()
        attrs = f" {attrs}" if attrs else ""
        svgs = []
        for svg_path in sorted(SVG_DIR.glob("*.svg")):
            svgs.append(read_text(svg_path).strip())
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


def build(log_fn=None) -> None:
    html = read_text(TEMPLATE)
    html = inline_styles(html)
    html = remove_dev_stylesheet(html)
    html = inline_svg_sprite(html)
    html = inline_scripts(html)
    html = inline_assets(html)

    DIST.mkdir(parents=True, exist_ok=True)
    out_path = DIST / "player.html"
    out_path.write_text(html, encoding="utf-8")
    message = f"Built {out_path}"
    if log_fn:
        log_fn(message)
    else:
        print(message)


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


def watch() -> None:
    def log(message: str) -> None:
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"[{timestamp}] {message}")

    paths = collect_sources()
    prev = snapshot(paths)
    build(log_fn=log)
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
            build(log_fn=log)


def main() -> None:
    parser = argparse.ArgumentParser(description="Build dist/player.html from src/")
    parser.add_argument("--watch", action="store_true", help="Rebuild on file changes")
    args = parser.parse_args()

    if args.watch:
        watch()
    else:
        build()


if __name__ == "__main__":
    main()
