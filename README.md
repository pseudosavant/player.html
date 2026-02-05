# player.html
Single-file audio + video player web app for media libraries served from basic HTTP directory listings (NGINX/Apache/IIS/etc).

It can be used as:
* A web player for folders of media on a server (NAS/home server/shared hosting).
* A local media player by installing it as a PWA (where supported).

![player.html in action](https://user-images.githubusercontent.com/455424/140204106-eff3504d-64f0-4038-977b-52555dd96358.png)
![player.html on all of your devices](https://user-images.githubusercontent.com/455424/140200711-7a414217-63db-41b7-8f6e-8d00d7e9eb27.png)

## What player.html can do
* Play videos with external subtitles (`.srt` / `.vtt`).
* Play audio (not just video) and use cover art thumbnails when available.
* Build playlists from folders/albums, reorder them, and loop playback.
* Import/export `.m3u` playlists and play `.m3u` playlists from the web (when CORS allows).
* Generate video thumbnails (pre-rendered server-side, or on-the-fly in the browser).
* Install as a PWA so it can behave like a local media player (launchable like an app; local file handling where supported).
* Play media from OneDrive / Google Drive (HTTPS + app keys required).
* Share a URL that resumes at the same folder + media + timestamp.

## Contents
* [Quick Start](#quick-start)
* [Features](#features)
* [Pre-rendered server-side thumbnails](#pre-rendered-server-side-thumbnails)
* [Installing ffmpeg](#installing-ffmpeg)
* [Supported browsers](#supported-browsers)
* [Supported web servers](#supported-web-servers)

## Quick Start
`player.html` is designed to be a drop-in audio and video player that does not require any configuration or other files.

### Build
The build inlines CSS, JS, SVGs, and assets into a single portable file.

```
uv run build.py
```

For continuous rebuilds while editing:

```
uv run build.py --watch
```

### Use As A Web Player (HTTP Directory Listing)
1) Copy `./dist/player.html` into a folder that is served over HTTP with directory listing enabled.
2) Browse to `player.html` in your browser.

`player.html` treats the directory listing HTML as an API for enumerating files/folders, so it works with simple web servers (see [Supported web servers](#supported-web-servers)).

### Use As A Local Media Player (PWA)
Serve `player.html` from `https://` (or `http://localhost`) and use your browser's "Install" option to install it as an app.

Once installed, it can be launched like a local media player. Some platforms also support opening local media files directly into the app (PWA file handlers).

### Development
* `src/player.html` is the dev template (it references `src/styles.css`, `src/js/*`, and `src/svg/*`).
* `dist/player.html` is generated output; do not edit it by hand.

## Features
### Core
* Single file (`dist/player.html`) with zero runtime dependencies.
* All CSS/JS/SVG/assets are inlined (portable drop-in file).

### Playback (Video)
* Video playback in the browser media engine (`MP4`, `M4V`, `MOV`, `MKV`, `WEBM`, `OGG`, etc).
* External subtitle support (`.srt` and `.vtt`).
* Picture-in-picture support.
* Playback controls: play/pause, seek, stop, volume, playback rate, fullscreen, PiP.
* Progress bar with timestamp preview thumbnail on hover/click/drag.

### Playback (Audio)
* Audio playback in the browser media engine (`MP3`, `WAV`, `AAC`, `M4A`, `MKA`, `OGG`, etc).
* Audio cover art thumbnails (sidecar art and embedded art, when available).

### Browsing & Library
* Uses folder listing pages as an API (no backend required).
* Folder + file tiles for fast navigation through large media libraries.

### Playlists
* Playlist panel: view, add, reorder, previous/next, and looping playback.
* Import/export `.m3u` playlists.
* Save/restore playlists via browser storage.

### Thumbnails
* Video thumbnails use pre-rendered server-side thumbnails when present (recommended for large libraries).
* Video thumbnails fall back to in-browser thumbnail generation otherwise.
* Animated thumbnails (optional).
* Thumbnail caching using `localStorage` (view cache size, clear cache).

### PWA & Sharing
* Installable as a PWA (inline generated manifest).
* Shareable URL that resumes `player.html` in the same folder, media item, and timestamp.
* Social metadata (`og:*`, `twitter:*`) for link previews.

### UI & Metadata
* Select your own theme color.
* Media file metadata (bitrate, resolution, etc).

### Keyboard & Convenience
* Keyboard shortcuts (press `?` in the app to see the list).
* Paste and Play: `CTRL+V` to play the URL currently in your clipboard.

### Cloud Sources
* Play media directly from OneDrive and Google Drive (requires HTTPS and valid app keys in `app.options.cloud`).

## Playlists

Open the playlist panel using the playlist button next to the file sources. From there you can:

* Add media from the file tiles using the add button
* Reorder items with the up/down controls
* Jump to previous/next track (buttons in the main controls or Page Up/Page Down)
* Toggle looping playback for the entire playlist
* Import `.m3u` playlists from a URL (requires CORS) or from a local file
* Export the current playlist as a `.m3u` file
* Save the playlist to browser localStorage and restore it later

Notes:

* Playlists are stored in memory only (they reset on refresh).
* Looping is enabled by default and repeats the playlist.
* Imported `.m3u` files can include relative URLs; they are resolved against the playlist URL (or the current page for local files).
* Saved playlists live in localStorage and are only restored on demand.

\* Be careful with concurrency. Increasing the setting above 1 does make it generate thumbnails much faster. But it is very easy for HTTP requests for generating thumbnails to saturate a connection enough that the main video gets starved for bandwidth. Especially if you browse into a folder with many dozens of videos in it. Thumbnails are generated lazily as tiles scroll into view to reduce bandwidth.

\** Animated thumbnails can consume a lot of data. The experience may degrade on slower network connections

## Pre-rendered server-side thumbnails

`player.html` can use server-side thumbnails for any video that has one available. It will fall back to generating thumbnails in the browser otherwise. The server-side thumbnail files must follow the common filename convention of using the video file name, with the extension replaced with an image extension, in the same folder as the video. Note: The image files must be shown by your web server's directory browsing (may require mime-type adjustments on some servers) feature to show up in `player.html`.

### Naming example:

* Media filename: `myMedia.mp4`
* Matching thumbnail filename: `myMedia.jpg` 

### Supported thumbnail image formats/extensions
* JPEG
* JPG
* PNG
* WEBP
* GIF

### How to pre-render thumbnails

#### Pre-render video thumbnails script

This repo includes `prerender-video-thumbnails.py`, which recursively generates **missing** thumbnails for all video files under a root folder. It never overwrites existing thumbnails.

What it does:

* Looks for videos by extension (e.g. `mp4`, `mkv`, `webm`, `mov`, etc).
* If a matching thumbnail already exists, it skips the video.
* Otherwise it generates a new image using `ffmpeg`.


Requires [ffmpeg](#ffmpeg) on your PATH.

Run it from the repo root:

```
uv run prerender-video-thumbnails.py [ROOT]
```

Examples:

```
uv run prerender-video-thumbnails.py
uv run prerender-video-thumbnails.py "C:\Media\Videos" --ext webp --seek 2.5 --max-dim 640
```

Options:

* `ROOT` - Root folder to scan (default: current directory)
* `--ext` - Thumbnail extension to create: `jpg`, `jpeg`, `png`, `gif`, `webp` (default: `jpg`)
* `--seek` - Seek time in seconds for the thumbnail frame (default: `5.0`)
* `--max-dim` - Maximum output dimension in pixels for the largest side (default: `512`)

#### Pre-render audio thumbnails script

This repo includes `prerender-audio-thumbnails.py`, which recursively creates **missing** `folder.jpg` sidecar files for audio folders. It scans each folder for embedded artwork and uses the first one it finds.

What it does:

* If a folder already has `folder.jpg`, it skips the folder.
* Otherwise it checks each audio file in the folder for embedded art.
* The first image it can extract becomes `folder.jpg`.

Requires [ffmpeg](#ffmpeg) on your PATH.

Run it from the repo root:

```
uv run prerender-audio-thumbnails.py [ROOT]
```

Examples:

```
uv run prerender-audio-thumbnails.py
uv run prerender-audio-thumbnails.py "C:\Media\Audio" --debug
```

Options:

* `ROOT` - Root folder to scan (default: current directory)
* `--debug` - Print ffmpeg debug output

<a id="ffmpeg"></a>
### Installing ffmpeg

The thumbnail scripts require `ffmpeg` to be available on your `PATH`.

Windows (winget):

```
winget install --id=Gyan.FFmpeg --exact
```

macOS (Homebrew):

```
brew install ffmpeg
```

Linux (package manager examples):

```
sudo apt install ffmpeg
```

## Supported browsers

The latest version of these browsers is supported:

* Edge (Chromium)
* Firefox
* Safari (Mac, iPadOS, iOS)
* Chrome

## Supported web servers

The latest version of these web servers (others may work as well):

* NGINX ([`autoindex`](https://nginx.org/en/docs/http/ngx_http_autoindex_module.html) on)
* Apache ([`mod_autoindex`](https://cwiki.apache.org/confluence/display/HTTPD/DirectoryListings))
* IIS (enable [`Directory Browsing`](https://docs.microsoft.com/en-us/iis/configuration/system.webserver/directorybrowse))

## Other

* `player.html` uses [folder.api](https://github.com/pseudosavant/folder.api) to consume HTTP directory listings like an API
* `player.html` uses [video-thumbnail.js](https://github.com/pseudosavant/video-thumbnail.js) to render thumbnails from video file URLs

## License

* [MIT](./LICENSE)

&copy; 2026 Paul Ellis
