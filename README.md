# player.html
Single-file audio + video player web app for media libraries served from basic HTTP directory listings (NGINX/Apache/IIS/etc).

It can be used as:
* A web player for folders of media on a server (NAS/home server/shared hosting).
* A local media player by installing it as a PWA (where supported).

![player.html in action](https://github.com/user-attachments/assets/7bc13981-52ad-4871-be0f-c0625ec565f2)
![player.html on all of your devices](https://github.com/user-attachments/assets/6a4771ca-50d0-4089-aed6-3f9a2c1570dd)

## What player.html can do
* Play videos with external subtitles (`.srt` / `.vtt`).
* Customize subtitle display (font, size, position hint, text color, and background color).
* Play audio (not just video) and use cover art thumbnails when available.
* Build playlists from folders/albums, reorder them, and loop playback.
* Import/export `.m3u` playlists and play `.m3u` playlists from the web (when CORS allows).
* Generate video thumbnails (pre-rendered server-side, or on-the-fly in the browser).
* Load default behavior from `player.html.json` and export your current configuration from the Settings modal.
* Install as a PWA so it can behave like a local media player (launchable like an app; local file handling where supported).
* Play media from OneDrive / Google Drive (HTTPS + app keys required).
* Share a URL that resumes at the same folder + media + timestamp.

## Contents
* [Quick Start](#quick-start)
* [Features](#features)
* [Feature requests](#feature-requests)
* [Pre-rendered server-side thumbnails](#pre-rendered-server-side-thumbnails)
* [Configuration file (`player.html.json`)](#configuration-file-playerhtmljson)
* [Installing ffmpeg](#installing-ffmpeg)
* [Supported browsers](#supported-browsers)
* [Supported web servers](#supported-web-servers)

## Quick Start
`player.html` is designed to be a drop-in audio and video player that does not require any configuration or other files.

### Use As A Web Player (HTTP Directory Listing)
1) Copy `./dist/player.html` into a folder that is served over HTTP with directory listing enabled.
2) Browse to `player.html` in your browser.

`player.html` treats the directory listing HTML as an API for enumerating files/folders, so it works with simple web servers (see [Supported web servers](#supported-web-servers)).

### Use As A Local Media Player (PWA)
Serve `player.html` from `https://` (or `http://localhost`) and use your browser's "Install" option to install it as an app.

Once installed, it can be launched like a local media player. Some platforms also support opening local media files directly into the app (PWA file handlers).

## Features
### Core
* Single file (`dist/player.html`) with zero runtime dependencies.
* All CSS/JS/SVG/assets are inlined (portable drop-in file).

### Playback (Video)
* Video playback in the browser media engine (`MP4`, `M4V`, `MOV`, `MKV`, `WEBM`, `OGG`, etc).
* External subtitle support (`.srt` and `.vtt`).
* Subtitle display settings in the subtitles modal: font, size, fallback vertical position, text color, and background color.
* Authored subtitle cue positioning is preserved. The subtitle position setting is only used as a fallback for cues without authored position.
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
* Settings can be configured by file (`player.html.json`) and exported from the UI. See [Configuration file (`player.html.json`)](#configuration-file-playerhtmljson).

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

## Configuration file (`player.html.json`)

`player.html` can load a configuration file named `player.html.json` from the same folder as `player.html`.

Priority order (highest to lowest):

* User settings saved in `localStorage` (`setting-*` keys)
* `player.html.json`
* Built-in defaults from `src/js/config.js`

`player.html.json` uses the same shape as `app.options`. You can create one by:

* Opening the Settings modal
* Clicking `Export settings file`
* Saving the downloaded `player.html.json` next to `player.html`

### Example

```json
{
  "settings": {
    "hue": 323,
    "auto-subtitles": false,
    "subtitle-font": "sans",
    "subtitle-size": "100%",
    "subtitle-position": "author",
    "subtitle-color": "#ffffff",
    "subtitle-background": "#000000",
    "thumbnailing": true,
    "animate": true
  },
  "thumbnails": {
    "timestamps": [0.005, 0.01, 0.015],
    "size": 320,
    "mime": { "type": "image/webp", "quality": 0.2 },
    "cache": true,
    "resizeQuality": "high",
    "concurrency": 1
  },
  "volumeExponent": 1.8
}
```

### Config options

User-facing display and subtitle defaults (most commonly customized):

* `settings.hue`: Theme hue (number)
* `settings.auto-subtitles`: Auto-load matching subtitle file (`true`/`false`)
* `settings.subtitle-font`: `sans`, `serif`, `mono`, `casual`
* `settings.subtitle-size`: `90%`, `100%`, `120%`, `140%`
* `settings.subtitle-position`: `author`, `90`, `75`, `60`, `35`, `20`
* `settings.subtitle-color`: Hex color (for example `#ffffff`)
* `settings.subtitle-background`: Hex color (for example `#000000`)
* `settings.blur`: Enable UI blur effects (`true`/`false`)
* `settings.transitions`: Enable UI transitions (`true`/`false`)
* `settings.thumbnailing`: Enable video thumbnail generation (`true`/`false`)
* `settings.animate`: Enable animated thumbnails (`true`/`false`)
* `settings.playlist-depth`: Folder depth used when adding folders to playlists (`1` to `3`)

Thumbnail timing and generation:

* `thumbnails.timestamps`: Relative capture positions for generated thumbnails (`0.0` to `1.0`)
* `thumbnails.size`: Max thumbnail width in px
* `thumbnails.mime.type`: Output image mime type (for example `image/webp`)
* `thumbnails.mime.quality`: Output quality (`0.0` to `1.0`)
* `thumbnails.cache`: Enable thumbnail cache in `localStorage` (`true`/`false`)
* `thumbnails.resizeQuality`: Canvas resize quality (`low`, `medium`, `high`)
* `thumbnails.concurrency`: Concurrent video thumbnail generation jobs

Audio thumbnail options:

* `audioThumbnails.concurrency`: Concurrent cover-art lookups
* `audioThumbnails.sidecarConcurrency`: Concurrent sidecar checks per audio file

Playback and UI timing:

* `volumeExponent`: Volume curve exponent
* `updateRate.timeupdate`: UI update throttle for media `timeupdate` events (ms)
* `updateRate.trickHover`: UI update throttle for trick-hover previews (ms)

Cloud source integration:

* `cloud.onedrive.clientId`
* `cloud.gdrive.developerKey`
* `cloud.gdrive.clientId`
* `cloud.gdrive.appId`

Diagnostics:

* `debug`: Enable non-error console logging (`true`/`false`)

Compatibility notes:

* `subtitles.*` keys are still accepted on load for compatibility, but `settings.*` is the canonical configuration surface for user-facing defaults.
* Runtime/browser-detected fields may appear in exported files. They are optional and are not required for a hand-authored config file.

## Feature requests

If you have an idea for `player.html`, please open a GitHub issue and label it as an enhancement.

Feature requests are preferred over pull requests.

The more detail you include, the easier it is to implement quickly and correctly. Helpful details include:

* What problem you are trying to solve
* What behavior you want
* Any UI/UX expectations
* Edge cases or compatibility concerns
* Example files/URLs/screenshots (if relevant)

A useful quality check before posting:

* Paste your issue draft into an AI/LLM and ask:
  * `Does this feature request for player.html have enough detail to clearly implement it? What other details should I consider adding?`
* Then paste your enhancement draft after that prompt and refine based on the feedback.

<a id="ffmpeg"></a>
## Installing ffmpeg

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

## Development
* `src/player.html` is the dev template (it references `src/styles.css`, `src/js/*`, and `src/svg/*`).
* `dist/player.html` is generated output; do not edit it by hand.

### Build
The build inlines CSS, JS, SVGs, and assets into a single portable file.

```
uv run build.py
```

For continuous rebuilds while editing:

```
uv run build.py --watch
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
