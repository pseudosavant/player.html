#!/usr/bin/env python3
"""
Populate missing video thumbnails in a folder (recursively).

Usage (with uv):
  uv run prerender-video-thumbnails.py [ROOT]

Behavior:
  - Walk all subfolders under ROOT (default: current working directory)
  - For each video file, only create a thumbnail if none exists
  - Thumbnails follow the naming convention: same basename, image extension
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path


VIDEO_EXTENSIONS = {
    ".mp4",
    ".m4v",
    ".mov",
    ".3gp",
    ".webm",
    ".mkv",
    ".ts",
    ".mp2",
    ".avi",
    ".wmv",
    ".flv",
    ".ogv",
}

THUMB_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}


def iter_video_files(root: Path):
    for folder, _, files in os.walk(root):
        for name in files:
            suffix = Path(name).suffix.lower()
            if suffix in VIDEO_EXTENSIONS:
                yield Path(folder) / name


def has_thumbnail(video_path: Path) -> bool:
    stem = video_path.stem
    for entry in video_path.parent.iterdir():
        if not entry.is_file():
            continue
        if entry.stem != stem:
            continue
        if entry.suffix.lower() in THUMB_EXTENSIONS:
            return True
    return False


def build_ffmpeg_cmd(
    video_path: Path,
    output_path: Path,
    seek_seconds: float,
    max_dim: int,
) -> list[str]:
    scale_filter = (
        f"scale='if(gt(iw,ih),min(iw,{max_dim}),-2):"
        f"if(gt(iw,ih),-2,min(ih,{max_dim}))'"
    )
    cmd = [
        "ffmpeg",
        "-hide_banner",
        "-loglevel",
        "error",
        "-ss",
        f"{seek_seconds:.3f}",
        "-i",
        str(video_path),
        "-vf",
        scale_filter,
        "-vframes",
        "1",
    ]
    if output_path.suffix.lower() in {".jpg", ".jpeg"}:
        cmd += ["-q:v", "2"]
    cmd.append(str(output_path))
    return cmd


def create_thumbnail(
    video_path: Path,
    output_ext: str,
    seek_seconds: float,
    max_dim: int,
) -> bool:
    output_path = video_path.with_suffix(f".{output_ext}")
    if output_path.exists():
        return False

    cmd = build_ffmpeg_cmd(video_path, output_path, seek_seconds, max_dim)
    try:
        subprocess.run(cmd, check=True)
        return True
    except subprocess.CalledProcessError as exc:
        print(f"Failed: {video_path} ({exc})", file=sys.stderr)
        return False


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Populate missing video thumbnails for a folder tree."
    )
    parser.add_argument(
        "root",
        nargs="?",
        default=".",
        help="Root folder to scan (default: current directory).",
    )
    parser.add_argument(
        "--ext",
        default="jpg",
        choices=sorted({e.lstrip('.') for e in THUMB_EXTENSIONS}),
        help="Thumbnail extension to create (default: jpg).",
    )
    parser.add_argument(
        "--seek",
        type=float,
        default=5.0,
        help="Seek time in seconds for thumbnail frame (default: 5.0).",
    )
    parser.add_argument(
        "--max-dim",
        type=int,
        default=512,
        help="Maximum output dimension (largest side) in pixels (default: 512).",
    )
    args = parser.parse_args()

    if shutil.which("ffmpeg") is None:
        print("Error: ffmpeg is not installed or not on PATH.", file=sys.stderr)
        return 2

    root = Path(args.root).resolve()
    if not root.exists():
        print(f"Error: root path not found: {root}", file=sys.stderr)
        return 2

    created = 0
    scanned = 0
    skipped = 0

    for video_path in iter_video_files(root):
        scanned += 1
        if has_thumbnail(video_path):
            skipped += 1
            continue
        if create_thumbnail(video_path, args.ext, args.seek, args.max_dim):
            created += 1
            print(f"Created: {video_path.with_suffix('.' + args.ext)}")

    print(f"Videos scanned: {scanned}")
    print(f"Thumbnails created: {created}")
    print(f"Skipped (already had thumbnail): {skipped}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
