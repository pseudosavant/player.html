#!/usr/bin/env python3
"""
Populate missing audio folder sidecar thumbnails (folder.jpg) recursively.

Usage (with uv):
  uv run prerender-audio-thumbnails.py [ROOT]

Behavior:
  - Walk all subfolders under ROOT (default: current working directory)
  - If a folder already has folder.jpg, skip it (do not update)
  - Otherwise, scan audio files in that folder for embedded artwork
  - Use the first embedded artwork found to create folder.jpg
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


AUDIO_EXTENSIONS = {
    ".mp3",
    ".m4a",
    ".aac",
    ".flac",
    ".wav",
    ".ogg",
    ".oga",
    ".opus",
    ".aiff",
    ".aif",
    ".wma",
    ".alac",
    ".mka",
}


def iter_audio_files(folder: Path) -> list[Path]:
    files: list[Path] = []
    for entry in folder.iterdir():
        if entry.is_file() and entry.suffix.lower() in AUDIO_EXTENSIONS:
            files.append(entry)
    return sorted(files)


def run_ffmpeg(cmd: list[str], debug: bool) -> subprocess.CompletedProcess:
    if debug:
        print(f"[debug] ffmpeg: {' '.join(cmd)}", file=sys.stderr)
    return subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)


def extract_cover_to_jpg(
    audio_path: Path,
    target_path: Path,
    ffmpeg: str,
    debug: bool = False,
) -> bool:
    with tempfile.TemporaryDirectory() as tmp:
        tmp_out = Path(tmp) / "cover.jpg"

        # Preferred: extract attached picture as a video stream.
        cmd = [
            ffmpeg,
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            str(audio_path),
            "-map",
            "0:v:0",
            "-frames:v",
            "1",
            "-q:v",
            "2",
            str(tmp_out),
        ]
        result = run_ffmpeg(cmd, debug)
        if result.returncode == 0 and tmp_out.exists() and tmp_out.stat().st_size > 0:
            shutil.move(str(tmp_out), target_path)
            return True
        if debug and result.stderr:
            msg = result.stderr.decode(errors="ignore").strip()
            if msg:
                print(f"[debug] ffmpeg map extract failed: {msg}", file=sys.stderr)

        # Fallback for Matroska attachments.
        if audio_path.suffix.lower() in {".mka", ".mkv"}:
            attachment_path = Path(tmp) / "attachment.bin"
            cmd = [
                ffmpeg,
                "-hide_banner",
                "-loglevel",
                "error",
                "-dump_attachment:t:0",
                str(attachment_path),
                "-i",
                str(audio_path),
            ]
            result = run_ffmpeg(cmd, debug)
            if result.returncode == 0 and attachment_path.exists():
                if attachment_path.stat().st_size > 0:
                    cmd = [
                        ffmpeg,
                        "-hide_banner",
                        "-loglevel",
                        "error",
                        "-i",
                        str(attachment_path),
                        "-frames:v",
                        "1",
                        "-q:v",
                        "2",
                        str(tmp_out),
                    ]
                    result = run_ffmpeg(cmd, debug)
                    if (
                        result.returncode == 0
                        and tmp_out.exists()
                        and tmp_out.stat().st_size > 0
                    ):
                        shutil.move(str(tmp_out), target_path)
                        return True
            if debug and result.stderr:
                msg = result.stderr.decode(errors="ignore").strip()
                if msg:
                    print(
                        f"[debug] ffmpeg attachment extract failed: {msg}",
                        file=sys.stderr,
                    )

    return False


def process_folder(folder: Path, ffmpeg: str, debug: bool = False) -> bool:
    """
    Returns True if folder.jpg was created.
    """
    target = folder / "folder.jpg"
    if target.exists():
        return False

    for audio_path in iter_audio_files(folder):
        if extract_cover_to_jpg(audio_path, target, ffmpeg, debug=debug):
            return True
    return False


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Populate missing audio folder.jpg from embedded artwork."
    )
    parser.add_argument(
        "root",
        nargs="?",
        default=".",
        help="Root folder to scan (default: current directory).",
    )
    parser.add_argument(
        "--debug",
        action="store_true",
        help="Print ffmpeg debug output.",
    )
    args = parser.parse_args()

    ffmpeg = shutil.which("ffmpeg")
    if ffmpeg is None:
        print("Error: ffmpeg is not installed or not on PATH.", file=sys.stderr)
        return 2

    root = Path(args.root).resolve()
    if not root.exists():
        print(f"Error: root path not found: {root}", file=sys.stderr)
        return 2

    created = 0
    scanned = 0
    for folder, _, _ in os.walk(root):
        folder_path = Path(folder)
        scanned += 1
        if process_folder(folder_path, ffmpeg, debug=args.debug):
            created += 1
            print(f"Created: {folder_path / 'folder.jpg'}")

    print(f"Scanned folders: {scanned}")
    print(f"Created folder.jpg: {created}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
