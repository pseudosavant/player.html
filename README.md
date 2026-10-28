# player.html
Single-file audio + video player web app for media libraries served from basic HTTP directory listings (NGINX/Apache/IIS/etc). Try it live on GitHub Pages: [pseudosavant.github.io/player.html/player.html](https://pseudosavant.github.io/player.html/player.html).

It can be used as:
* A web player for folders of media on a server (NAS/home server/shared hosting).
* A local media player by installing it as a PWA (where supported).

![player.html in action](https://github.com/user-attachments/assets/5e4ccd1a-6c8b-44d2-aaf6-32e92b79e315)
![player.html for video](https://github.com/user-attachments/assets/701ae4a9-b465-4a04-b453-2b2b68a76cf5)
![player.html for music](https://github.com/user-attachments/assets/ae5c990e-71b2-4b64-b594-8fa3baec02e8)

## What player.html can do
* Play videos with external subtitles (`.srt` / `.vtt`).
* Customize subtitle display (font, size, position hint, text color, background color, and optional text-shadow mode).
* Play audio (not just video) and use cover art thumbnails when available.
* Build playlists from folders/albums, reorder them, and loop playback.
* Import/export `.m3u` playlists and play `.m3u` playlists from the web (when CORS allows).
* Generate video thumbnails (pre-rendered server-side, or on-the-fly in the browser).
* Client-side search across indexed media filenames from the current library root.
* Continue playing from a library tab, with sorting, playback filters, and tile or list views.
* Choose from 17 interface languages automatically from browser preferences or explicitly in Settings, with right-to-left support for Arabic, Persian, and Hebrew.
* Open a local folder as a browsable media source in browsers that support the File System Access API, with file-picker fallback elsewhere.
* Load default behavior from `player.html.json`, and optionally host a static `manifest.json` for PWA install metadata.
* Upload a custom player poster image (or set one in `player.html.json`) with sensible precedence and export support.
* Install as a PWA so it can behave like a local media player (launchable like an app; local file handling where supported).
* Play media from OneDrive / Google Drive (HTTPS + app keys required).
* Open a folder or media URL from the sources bar (same-origin or CORS required for folder browsing).
* Share a URL that resumes at the same library root + folder + search + playlist + media + timestamp + subtitle selection.

## Contents
* [Quick Start](#quick-start)
* [Features](#features)
* [Feature requests](#feature-requests)
* [Pre-rendered server-side thumbnails](#pre-rendered-server-side-thumbnails)
* [Configuration and PWA manifest (`player.html.json` + `manifest.json`)](#configuration-and-pwa-manifest-playerhtmljson--manifestjson)
* [Languages](#languages)
* [Advanced deployment patterns](#advanced-deployment-patterns)
* [Installing ffmpeg](#installing-ffmpeg)
* [Supported browsers](#supported-browsers)
* [Supported web servers](#supported-web-servers)

## Quick Start
`player.html` is designed to be a drop-in audio and video player that does not require any configuration or other files.

### Use As A Web Player (HTTP Directory Listing)
1) Copy `./dist/player.html` or `./dist/player.min.html` into a folder that is served over HTTP with directory listing enabled.
2) Browse to `player.html` in your browser.

`player.html` treats the directory listing HTML as an API for enumerating files/folders, so it works with simple web servers (see [Supported web servers](#supported-web-servers)).

### Use As A Local Media Player (PWA)
Serve `player.html` from `https://` (or `http://localhost`) and use your browser's "Install" option to install it as an app.

Once installed, it can be launched like a local media player. Some platforms also support opening local media files directly into the app (PWA file handlers).

If you are customizing a hosted deployment, the usual pairing is:

* `player.html.json` for player behavior and default library location
* `manifest.json` for install-time app metadata such as name, icons, colors, `start_url`, and `scope`

## Features
### Core
* Single-file distributables (`dist/player.html` and `dist/player.min.html`) with zero runtime dependencies.
* All CSS/JS/SVG/assets are inlined (portable drop-in file).

### Playback (Video)
* Video playback in the browser media engine (`MP4`, `M4V`, `MOV`, `MKV`, `WEBM`, `OGG`, etc).
* External subtitle support (`.srt` and `.vtt`).
* Subtitle display settings in the subtitles modal: font, size, fallback vertical position, text color, background color, and optional text-shadow background mode.
* Authored subtitle cue positioning is preserved. The subtitle position setting is only used as a fallback for cues without authored position.
* Transcript search for the loaded subtitle file, with timestamped results that jump playback to matching cues.
* Picture-in-picture support.
* Playback controls: play/pause, seek, stop, volume, playback rate, fullscreen, PiP.
* Progress bar with timestamp preview thumbnail on hover/click/drag.

### Playback (Audio)
* Audio playback in the browser media engine (`MP3`, `WAV`, `AAC`, `M4A`, `MKA`, `OGG`, etc).
* Audio cover art thumbnails (sidecar art and embedded art, when available).

### Browsing & Library
* Uses folder listing pages as an API (no backend required).
* Switch between folder and file tiles and a compact list view. The browser remembers your view and sort choices.
* Sort filenames naturally, or sort by modified date, size, or recent playback. Unknown dates and sizes stay at the end.
* Combine audio/video filters with played, unplayed, or in-progress filters. Folder navigation stays available while filtering. Searches show matching media and folders, with a result count only while searching.
* Continue playing shows unfinished media from the current library root, ordered by recent playback by default. It shares the library area instead of adding a separate shelf above the folders.
* Switching between Library and Continue playing does not scroll the page or restore a saved tab position. Disabling playback history hides Continue playing and disables progress filtering.
* List rows show filenames and playback status alongside the add-to-playlist action. Switching views preserves loaded thumbnails.
* Optional client-side search that indexes media filenames from the current root, supports multi-term matching, and caches the index in `sessionStorage` for the session.
* Opening a folder clears the current search after the folder loads. If library search is disabled, Continue playing still supports searching its entries. Returning to Library clears that query so folders stay visible.
* If folder navigations overlap, only the latest request can update the displayed folder, playback, and search root.

### Playlists
* Playlist panel: view, add, reorder, previous/next, and looping playback.
* Import/export `.m3u` playlists.
* Shareable state in the URL hash (restores library root, folder, search, playlist, media, timestamp, and subtitle selection).
* Adding a local folder to a playlist respects the configured folder depth. Back and Forward preserve local folder access within the current page session.
* Automatic queue advancement stops after all available entries fail, even when looping is enabled. A manual playback attempt can retry failed entries.

### Thumbnails
* Video thumbnails use pre-rendered server-side thumbnails when present (recommended for large libraries).
* Video thumbnails fall back to in-browser thumbnail generation otherwise.
* Animated thumbnails (optional).
* Thumbnail caching using IndexedDB (view cache size, clear cache).
* Thumbnail cache size is calculated while Settings is open. Cache eviction uses an index instead of loading every cached image.

### PWA & Sharing
* Installable as a PWA (generated manifest by default, or hosted `manifest.json` if present).
* Shareable URL that resumes `player.html` in the same library root, folder, search, playlist, media item, timestamp, and subtitle selection.
* Direct media URL launcher for easy generated links without building the full encoded `#dr=` share-state value.
* Local folder browsing via `showDirectoryPicker()` where supported; browsers without folder access fall back to opening one local media file with `<input type="file">`.
* Optional Wake Lock support to prevent screen sleep while media is playing.
* Optional playback history that remembers recent media positions and completion status.
* Standard page metadata (`title`, `description`) plus favicon and PWA manifest support.

#### Direct media URL links

If you want to generate simple links into your own `player.html` instance, append `#url=<media-url>` instead of constructing the full encoded `#dr=` state value.

Example:

```
https://example.com/player.html#url=https://example.com/videos/example.webm
```

For this repository served locally:

```
http://localhost:8080/dist/player.html#url=http://localhost:8080/videos/webm-big-buck-bunny_trailer.webm
```

The player loads and attempts to play the media URL, then best-effort browses the containing folder so the file browser is populated. Folder browsing requires same-origin access or CORS support. If the media URL contains characters such as `#` or `&`, URL-encode the media URL before appending it.

### UI & Metadata
* Select your own theme color with hue+saturation theming (including grayscale themes at `saturation: 0`).
* Set a custom player poster image from Settings (`Upload`) or by config (`settings.poster-image`).
* Media file metadata (bitrate, resolution, etc).
* Settings can be configured by file (`player.html.json`) and exported from the UI. PWA install metadata can also be exported as `manifest.json`. See [Configuration and PWA manifest (`player.html.json` + `manifest.json`)](#configuration-and-pwa-manifest-playerhtmljson--manifestjson).

### Custom Branding
Use `player.html` with your own look and branding:
* Theme color via hue+saturation controls
* Custom poster/icon image via upload or config (`settings.poster-image`)

![player.html with custom branding (theme color + custom poster/icon)](https://github.com/user-attachments/assets/ad0cacd6-5c66-4553-b42d-c02e781edfd1)

### Keyboard & Convenience
* Keyboard shortcuts (press `?` in the app to see the list).
* Paste and Play: `CTRL+V` to play the URL currently in your clipboard.
* Screenshot capture: `Shift+S`, or use `File metadata` modal -> `Actions` -> `Take screenshot`.

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

* The current folder/playlist/media/timestamp/subtitle selection are encoded in the URL hash for shareable links and refresh restore.
* Looping is enabled by default and repeats the playlist.
* Imported `.m3u` files can include relative URLs; they are resolved against the playlist URL (or the current page for local files).
* Saved playlists in localStorage are optional and restored only on demand.

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

## Configuration and PWA manifest (`player.html.json` + `manifest.json`)

`player.html` can load a configuration file named `player.html.json` from the same folder as `player.html`.

You can rename `player.html` (for example to `index.html`) and still keep the config filename as `player.html.json`.
This lets you host the player at a folder root while starting in a sub-folder media library.

`player.html` also generates a manifest in-memory by default for PWA installs. If you host a real `manifest.json` next to `player.html`, the page will use that instead. This is useful when you want to control install metadata such as:

* App name and short name
* Icons
* Theme/background colors
* `start_url`
* `scope`

In practice:

* Use `player.html.json` for player behavior and defaults
* Use `manifest.json` for install-time PWA metadata and branding

Priority order (highest to lowest):

* User settings saved in `localStorage` (`setting-*` keys)
* `player.html.json`
* Built-in defaults from `src/js/config.js`

`player.html.json` uses the same shape as `app.options`. You can create one by:

* Opening the Settings modal
* Clicking `Export settings file`
* Saving the downloaded `player.html.json` next to `player.html`

You can create a starter `manifest.json` by:

* Opening the Settings modal
* Clicking `Export manifest.json`
* Saving the downloaded `manifest.json` next to `player.html`

Notes:

* If hosted `manifest.json` is present, it is preferred over the generated inline manifest.
* If hosted `manifest.json` is not present, `player.html` falls back to its generated inline manifest automatically.
* `player.html.json` is the right place to set `startLocation` and other player defaults.
* `manifest.json` is the right place to set install/app metadata. It is intentionally separate from shareable URL hash state.
* The exported `manifest.json` is a starter. For a hosted deployment, you will often want to replace `name`, `short_name`, colors, and icon URLs with your own values.

### Example

```json
{
  "settings": {
    "hue": 323,
    "saturation": 100,
    "auto-subtitles": false,
    "subtitle-font": "sans",
    "subtitle-size": "100%",
    "subtitle-position": "author",
    "subtitle-color": "#ffffff",
    "subtitle-background": "#000000",
    "subtitle-shadow": false,
    "wake-lock": true,
    "watch-history": true,
    "thumbnailing": true,
    "animate": true,
    "search-depth": 3
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

### Example `manifest.json`

```json
{
  "short_name": "player.html",
  "name": "player.html",
  "description": "Drop player.html in a folder of video and audio files and play them on the web",
  "background_color": "#FFFFFF",
  "theme_color": "#ff0099",
  "color": "#ff0099",
  "icons": [
    {
      "src": "./icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ],
  "display": "standalone",
  "start_url": "./player.html",
  "scope": "./",
  "file_handlers": [
    {
      "action": "./player.html",
      "accept": {
        "audio/*": [".mp3", ".wav", ".aac", ".m4a", ".mka", ".ogg"],
        "video/*": [".mp4", ".mov", ".webm", ".mkv"]
      }
    }
  ]
}
```

### Config options

User-facing display and subtitle defaults (most commonly customized):

* `defaultLanguage`: Language to use when none of the browser's preferred languages are supported. Defaults to `en`. See [Languages](#languages) for supported locale codes. This does not override a supported browser language or an explicit user choice.
* `settings.hue`: Theme hue (number)
* `settings.saturation`: Theme saturation from `0` to `100` (use `0` for grayscale themes)
* The Theme color picker in Settings updates `settings.hue` and `settings.saturation` together.
* `settings.auto-subtitles`: Auto-load matching subtitle file (`true`/`false`)
* `settings.subtitle-font`: `sans`, `serif`, `mono`, `casual`
* `settings.subtitle-size`: Percentage string. Presets in UI: `50%`, `75%`, `100%`, `150%`, `200%`. Arbitrary percentages are accepted (clamped to `25%`-`400%`).
* `settings.subtitle-position`: `author`, `90`, `75`, `60`, `35`, `20`
* `settings.subtitle-color`: Hex color (for example `#ffffff`)
* `settings.subtitle-background`: Hex color (for example `#000000`)
* `settings.subtitle-shadow`: `true` uses transparent cue backgrounds with offset text shadow based on `settings.subtitle-background`; `false` uses solid cue background
* `settings.poster-image`: Optional custom player poster image URL. Supports relative URL, absolute URL, or data URI.
* `settings.wake-lock`: Prevent screen sleep while media is playing, when supported (`true`/`false`)
* `settings.watch-history`: Remember recent playback positions and completion status in IndexedDB (`true`/`false`)
* `settings.blur`: Enable UI blur effects (`true`/`false`)
* `settings.transitions`: Enable UI transitions (`true`/`false`)
* `settings.thumbnailing`: Enable video thumbnail generation (`true`/`false`)
* `settings.animate`: Enable animated thumbnails (`true`/`false`)
* `settings.playlist-depth`: Folder depth used when adding folders to playlists (`1` to `3`)
* `settings.search-depth`: Client-side library search depth (`0` disables indexing and hides search in Library, `1` indexes the current folder only, higher values recurse deeper up to `6`). Continue playing can still search its history entries when this is `0`.

Poster image behavior:

* Precedence is:
  * user `localStorage` value (`setting-poster-image`) from uploaded custom poster
  * `player.html.json` value (`settings.poster-image`)
  * built-in generated fallback poster
* Uploaded raster images are resized to fit within `1920x1080` and encoded as WebP when supported (PNG fallback).
* Uploaded SVG files are preserved as SVG data URIs (not rasterized).
* Exported `player.html.json` includes `settings.poster-image` (including uploaded data URI values).

Thumbnail timing and generation:

* `thumbnails.timestamps`: Relative capture positions for generated thumbnails (`0.0` to `1.0`)
* `thumbnails.size`: Max thumbnail width in px
* `thumbnails.mime.type`: Output image mime type (for example `image/webp`)
* `thumbnails.mime.quality`: Output quality (`0.0` to `1.0`)
* `thumbnails.cache`: Enable thumbnail cache in IndexedDB (`true`/`false`). Generated video thumbnails are stored as image `Blob`s and materialized as temporary object URLs when tiles render.
* `thumbnails.resizeQuality`: Canvas resize quality (`low`, `medium`, `high`)
* `thumbnails.concurrency`: Concurrent video thumbnail generation jobs

Audio thumbnail options:

* `audioThumbnails.concurrency`: Concurrent cover-art lookups
* `audioThumbnails.sidecarConcurrency`: Concurrent sidecar checks per audio file

Playback and UI timing:

* `startLocation`: Optional initial folder/media URL. Relative paths resolve from the page URL.
  * Useful for `index.html` + `player.html.json` deployments where media lives in a sub-folder like `videos/`.
  * Can also point at a different server URL when that target has both directory browsing and CORS enabled.
  * Exported configs rewrite same-origin absolute `startLocation` values to root-relative paths so they stay portable across host/domain/port changes.
* `volumeExponent`: Volume curve exponent
* `updateRate.timeupdate`: UI update throttle for media `timeupdate` events (ms)
* `updateRate.trickHover`: UI update throttle for trick-hover previews (ms)

Cloud source integration:

* `cloud.onedrive.clientId`
* `cloud.gdrive.developerKey`
* `cloud.gdrive.clientId`
* `cloud.gdrive.appId`

Cloud buttons are hidden unless the player is served over HTTPS and all required values for that provider are nonempty strings. OneDrive requires its client ID. Google Drive requires its developer key, client ID, and app ID.

After `player.html.json` loads, configured providers load their SDK scripts during startup. Unconfigured providers make no SDK requests. Library loading and playback do not wait for these scripts. Each cloud button stays disabled until its SDK is ready. Script failures and timeouts leave that provider disabled without affecting the rest of the player. Authentication still starts only when the user opens a cloud picker. The existing SDK versions and authentication flows are unchanged.

Diagnostics:

* `debug`: Enable non-error console logging (`true`/`false`)

Compatibility notes:

* `subtitles.*` keys are still accepted on load for compatibility, but `settings.*` is the canonical configuration surface for user-facing defaults.
* Runtime/browser-detected fields may appear in exported files. They are optional and are not required for a hand-authored config file.

## Languages

Settings > Interface > Language defaults to Automatic. A chosen language is saved as `setting-language` in localStorage and takes priority over browser preferences. Choosing Automatic returns to browser-based selection. Changes apply immediately without restarting playback or clearing the queue, subtitles, or local folder access.

The following 17 interface languages are included:

| Language | Locale | Direction |
| --- | --- | --- |
| English | `en` | Left to right |
| Spanish | `es` | Left to right |
| French | `fr` | Left to right |
| German | `de` | Left to right |
| Portuguese | `pt` | Left to right |
| Japanese | `ja` | Left to right |
| Simplified Chinese | `zh-Hans` | Left to right |
| Traditional Chinese | `zh-Hant` | Left to right |
| Hindi | `hi` | Left to right |
| Arabic | `ar` | Right to left |
| Italian | `it` | Left to right |
| Korean | `ko` | Left to right |
| Dutch | `nl` | Left to right |
| Polish | `pl` | Left to right |
| Persian | `fa` | Right to left |
| Hebrew | `he` | Right to left |
| Turkish | `tr` | Left to right |

Automatic selection checks `navigator.languages` in preference order, with `navigator.language` as a fallback. The first supported language wins. Regional variants match their supported base language, such as `fr-CA` to `fr` and `pt-BR` or `pt-PT` to `pt`. Explicitly requested scripts must match the supported writing system. Chinese matching distinguishes both scripts. `zh-CN`, `zh-SG`, and `zh-Hans` match Simplified Chinese. `zh-TW`, `zh-HK`, `zh-MO`, and `zh-Hant` match Traditional Chinese. Explicit script tags take priority over region hints. The configured fallback applies if none of the preferred languages match.

If none of the browser's preferred languages match, `defaultLanguage` in `player.html.json` supplies the fallback. Unsupported configuration values fall back to English. For example, this uses Simplified Chinese for unsupported browser languages while still honoring English browser preferences and explicit user choices:

```json
{
  "defaultLanguage": "zh-Hans"
}
```

Language is a personal preference, not a forced site setting. Exported configuration retains `defaultLanguage` but does not export the user's language choice as `settings.language`. Filenames, URLs, subtitle contents, provider names, and technical identifiers remain unchanged. Browser-native dialogs and controls use the browser's own language.

### Right-to-left layout

Arabic, Persian, and Hebrew set the page language and direction together. Library columns, connected buttons, modal placement, close buttons, and inline spacing follow the reading direction. Filename and transcript text keep their own direction. URLs and technical metadata are isolated from surrounding text, and interpolated values use Unicode bidi isolation so timestamps and provider names do not reorder the sentence.

The seek bar, playback transport, and timestamps remain left to right. Pointer seeking and arrow-key behavior retain their normal chronological meaning. Video images and authored subtitle text are not mirrored or translated. Switching back to a left-to-right language restores the corresponding layout without reloading media.

### Translation catalogs

See the [localization guide](LOCALIZATION.md) for the product glossary, tone, locale conventions, and linguistic review checklist.

Source catalogs live in `src/locales/<locale>.json`. Each contains locale metadata and 322 stable message keys. The build validates matching keys, plural fallbacks, and interpolation placeholders, then embeds compact UTF-8 JSON directly in both HTML outputs. No translation requests are made at runtime. At startup, only English and the active language are parsed. Other catalogs are parsed on first use and cached for later switches. Missing individual messages fall back to English.

Static labels and attributes use explicit `data-i18n` bindings. Dynamic messages use `i18n.t(key, params)`. Plural forms use `Intl.PluralRules`. Displayed numbers, dates, and filename ordering use the selected locale through `Intl`. Translation text is inserted as text or escaped before HTML interpolation, never executed as markup.

The 17 source catalogs total 370,059 bytes, or 335,919 bytes as compact inline JSON. The complete builds measure as follows, using gzip level 9 and Brotli quality 11:

| Build | Raw bytes | Gzip bytes | Brotli bytes |
| --- | ---: | ---: | ---: |
| `player.html` | 903,802 | 209,747 | 171,337 |
| `player.min.html` | 783,538 | 194,966 | 161,283 |

When introduced, the 17-language localization and RTL changes added about 80 KiB gzipped to the minified build. The build totals above also reflect subsequent dependency updates. Gzip and Brotli reuse repeated keys across the inline catalogs, so the complete HTML compresses better than the sum of independently compressed locale files. Actual transfer size depends on the web server's compression configuration.

## Advanced deployment patterns

Use `startLocation` to control the initial folder or media URL opened by the player.

1. `index.html` at root, media in `videos/` sub-folder:

```text
/index.html
/player.html.json
/videos/           (directory browsing enabled)
```

`player.html.json`:

```json
{
  "startLocation": "videos/"
}
```

2. Player on one server, media on another server:

```json
{
  "startLocation": "https://media.example.com/videos/"
}
```

Requirements for cross-server `startLocation`:

* The target URL must expose a directory listing that `player.html` can parse.
* The target server must allow CORS for folder/media requests.

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

### Example: Remux MKV (H.264 + AC3) to MP4 without transcoding

If your source is already `H.264` video + `AC3` audio, you can often remux to MP4 for broad playback compatibility while keeping the original quality.

Remuxing (`-c copy`) is a container change, not a re-encode. For copied streams it is lossless and typically much faster than transcoding.

This command:
* Copies video/audio/subtitle streams without re-encoding
* Copies chapters
* Moves MP4 metadata to the front (`faststart`) for better web playback

```
ffmpeg -i "input.mkv" -map 0 -c copy -map_chapters 0 -movflags +faststart "output.mp4"
```

### Example: Remux H.264 video and convert audio to AC3

If your source audio is something less broadly supported in browsers/devices (for example `DTS` or `EAC3`), you can keep the original H.264 video stream and only transcode audio to AC3:

This keeps video remuxed/lossless (`-c:v copy`) and only re-encodes audio.

```
ffmpeg -i "input.mkv" -map 0 -c:v copy -c:a ac3 -b:a 640k -map_chapters 0 -movflags +faststart "output.mp4"
```

## Development
* `src/player.html` is the dev template (it references `src/styles.css`, `src/js/*`, and `src/svg/*`).
* `dist/player.html` and `dist/player.min.html` are generated output; do not edit them by hand.

### Build
The build inlines CSS, JS, SVGs, and assets into portable single-file outputs.

```
uv run build.py
```

By default this writes:

* `dist/player.html` (unminified)
* `dist/player.min.html` (minified)

For a dev-only build that skips minification:

```
uv run build.py --dev
```

For continuous rebuilds while editing:

```
uv run build.py --watch
```

You can combine watch mode with dev mode:

```
uv run build.py --watch --dev
```

### Browser Tests

After building, run `node --test tests/*.test.cjs` with Playwright available to Node. The tests use installed Chrome on Windows and Playwright Chromium elsewhere. Directory listings and local folder handles are fixtures. The cache regression tests start their own local HTTP servers to exercise the real browser cache, including an old iframe listing after a fetch failure. HTTP directory browsing, search indexing, and folder-to-playlist traversal use fetch with `cache: 'no-store'`. Failed requests do not fall back to potentially cached iframe listings. Local folders continue to use file system handles. The suite does not need an external media server or access to personal files.

Toggle regression tests exercise both generated builds across device scale factors, CSS zoom levels, font sizes, narrow and desktop viewports, and LTR/RTL locales. They verify symmetric thumb insets, configurable track heights, Turkish label widths, native keyboard behavior, visible focus, and reduced motion. Geometry checks allow subpixel layout rounding rather than requiring identical physical pixels on every display.

On Windows, pinch-zoom pixel tests also require installed Microsoft Edge and an interactive desktop session. They launch an isolated Edge window offscreen with its headed renderer, since headless rendering does not reproduce the rounding issue. At 125% display scaling and 4x pinch magnification, screenshot checks verify equal 2px toggle gaps in both states and at fractional vertical positions. These Edge-specific tests are skipped on other platforms. Toggle centering remains CSS-only and does not track device pixel ratio in application code.

## Supported browsers

The latest version of these browsers is supported:

* Edge (Chromium)
* Firefox
* Safari (Mac, iPadOS, iOS)
* Chrome

Modern browser/device media stacks have improved significantly. In practice, many current platforms now handle `5.1 AC3 / Dolby Digital` playback out of the box.

Real-world compatibility can still vary by OS version, hardware decoder, browser version, and how audio is routed, but `MP4 + H.264 + AC3` has worked well across iPhone/iOS Safari, Chrome/Edge, Roku devices, and Xbox in testing.

## Supported web servers

The latest version of these web servers (others may work as well):

* NGINX ([`autoindex`](https://nginx.org/en/docs/http/ngx_http_autoindex_module.html) on)
* Apache ([`mod_autoindex`](https://cwiki.apache.org/confluence/display/HTTPD/DirectoryListings))
* IIS (enable [`Directory Browsing`](https://docs.microsoft.com/en-us/iis/configuration/system.webserver/directorybrowse))

## Other

* `player.html` uses [folder.api 3.0.0](https://github.com/pseudosavant/folder.api/tree/3.0.0) to consume HTTP directory listings like an API. HTTP directory requests remain fetch-only with `cache: 'no-store'`. The library limits each listing response to 4 MiB by default, measured after HTTP decompression. This limit does not apply to media files.
* `player.html` uses [video-thumbnail.js](https://github.com/pseudosavant/video-thumbnail.js) to render thumbnails from video file URLs
* `player.html` uses [audio-thumbnail.js](https://github.com/pseudosavant/audio-thumbnail.js/) to render thumbnails from audio file URLs

## License

* [MIT](./LICENSE)

&copy; 2026 Paul Ellis
