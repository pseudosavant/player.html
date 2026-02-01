# AGENTS.md

This repo is a single-file web app. The "source of truth" is `src/player.html`. There is no build step and no bundler.

## Project summary
- `player.html` is a drop-in audio/video player for HTTP directory listings.
- It treats the directory listing HTML as an API (via an iframe parser) and renders folders + media files as tiles.
- Everything (HTML, CSS, JS, SVG icons, PWA manifest) is inlined.

## Key files and folders
- `src/player.html`: The app. All HTML, CSS, JS, SVG icons live here.
- `README.md`: Usage and features overview.
- `assets/`: Only for docs/screenshots; not used at runtime.
- `videos/`: Sample media files.

## HTML structure (high level)
`<body class="no-subtitles is-stopped">`
- `.player-container`
  - `.media-container`
    - `<video.player>`
    - `.media-title`
    - `.fileinfo.modal` (metadata list)
    - `.help.modal` (keyboard shortcuts list)
    - `.subtitle-selection.modal`
    - `.settings.modal`
    - `.modal-background-overlay`
  - `.controls`
    - `.progress-bar` (buffer/progress)
    - `.trick-container` + `<video.trick>` (hover preview)
    - `.controls-settings` (info/settings buttons)
    - `.primary-buttons` (play/pause, seek, volume, fullscreen, pip, subtitles, playback rate)
    - `.controls-sources` (cloud/local file pickers)
    - `.current-timestamp`
- `.links` (folder + file tiles)
- `<footer>` (version link)
- `.xlinks` (inline SVG sprite sheet)

## CSS architecture
- Large `<style primary>` block at top of file.
- Heavy use of CSS custom properties for theme and sizing:
  - `--theme-hue`, `--theme-color`, `--tile-*`, `--progress-bar-*`, etc.
  - Light/dark values set via `data-color-scheme` and `prefers-color-scheme`.
- Layout is CSS Grid for page + controls, and flex/grid for tiles.
- UI state is driven by body/html classes:
  - Playback: `is-loaded`, `is-playing`, `is-paused`, `is-stopped`
  - Media: `is-audio`, `is-pip`
  - Capabilities: `no-volume`, `no-subtitles`
  - UX: `no-thumbnail-animation`, `fadeout` (controls autohide)
- SVG icons are embedded and referenced with `<use xlink:href="#svg-...">`.

## JavaScript modules (inline, in order)
Each `<script type="module">` sets `const global = window` and exports to `global` when needed.

1) Global config
   - Defines `window.app`:
     - `options.cloud` (OneDrive/GDrive credentials)
     - `options.thumbnails` (timestamps, size, mime, cache, resizeQuality, concurrency)
     - `options.updateRate` (timeupdate, trickHover)
     - `links`, `metadata` placeholders

2) Utilities
   - DOM helper `$()` (single element, jQuery-like methods)
   - `delay`, `throttle`
   - `storageStore/Retrieve/Remove`
   - `secondsToHMS`, `secondsToString`, `pad`, `addCommas`
   - Type helpers: `isNumber`, `isString`, `isBoolean`, `isUndefined`
   - CSS var helpers: `setCSSVariableString/Number`, `clearCSSVariable`, `getCSSVariable`
   - UTF-safe base64 helpers: `base64EncodeUTF`, `base64DecodeUTF`

3) PWA
   - Builds a data-URI manifest at runtime (icon comes from the inline favicon).
   - Adds file handlers for audio/video types.

4) Social metadata
   - Injects `og:*`, `twitter:*`, and MS tile metadata based on document title/description/icon.

5) Video thumbnail engine (video-thumbnail.js)
   - Generates data-URI thumbnails from a video URL.
   - Optional localStorage cache with prefix `video-thumbnail.js`.
   - Exports `window.videoThumbnail`.

6) File pickers (cloud)
   - OneDrive and Google Drive picker flows.
   - Only shown when HTTPS and keys are configured.
   - Exports `window.onedrive` and `window.gdrive`.

7) folder.api (directory listing parser)
   - Loads directory listing in an iframe.
   - Detects server type (nginx/apache/iis/deno) and parses DOM for links + metadata.
   - Exports `window.folderApiRequest`.

8) App code
   - Core player UI/behavior:
     - Supported media types computed from `video.canPlayType`.
     - Directory listing -> tiles + thumbnails.
     - Playback controls (play/pause, seek, stop, volume, fullscreen, PiP).
     - Progress bar + trickplay hover.
     - Subtitles (SRT -> VTT conversion, track injection).
     - Settings modal, persistence via localStorage.
     - Shareable hash state (location, media, time).
     - Theme color updates (`--theme-hue`) + poster background.
     - File metadata modal (HEAD/GET headers, bitrate, fps).
   - Initializes in `main()` at end of file.

## Data flow and state
- `app.links` holds parsed folder/file lists from `folderApiRequest`.
- `app.metadata` is updated on `loadedmetadata` and used for info modal + seek deltas.
- `hashState` tracks `{ location, media }`, serialized into `location.hash` via base64 JSON.
- `updateHash()` runs during playback to keep shareable URLs current.

## Settings and persistence
Settings are stored in localStorage as `setting-*`.
- `setting-hue` (number, theme hue)
- `setting-blur` (boolean)
- `setting-transitions` (boolean)
- `setting-thumbnailing` (boolean)
- `setting-animate` (boolean)
- `setting-cache` (derived only; not persisted)
- `setting-reset` (action only)

Examples (localStorage key/value)
- `setting-hue` -> `"323"` (stored as string, parsed to number)
- `setting-blur` -> `"true"` or `"false"`
- `setting-transitions` -> `"true"` or `"false"`
- `setting-thumbnailing` -> `"true"` or `"false"`
- `setting-animate` -> `"true"` or `"false"`

Thumbnail cache:
- LocalStorage keys start with `video-thumbnail.js-<timestamp>-...`
- `videoThumbnail.cacheSize()` and `videoThumbnail.clearCache()` manage it.
- Example key: `video-thumbnail.js-1700000000000-12.34-320|webp|0.01|https://example.com/video.mp4`


## Conventions and patterns
- Single file only: new features should remain inside `src/player.html`.
- Avoid external dependencies; embed assets (SVG, manifest) inline.
- Reuse `$()` helper and existing utility functions instead of new helpers.
- Keep UI state in CSS classes (`is-*`, `no-*`) and CSS variables.
- Prefer `setCSSVariableString/Number` for UI text/metrics shown via CSS.
- Use `const global = window` and attach cross-module APIs to `global` when needed.
- Use `throttle` for UI updates tied to media events.
- Keep DOM templates as template literals in the app module.

## External integrations
- OneDrive and Google Drive scripts are loaded via `<script defer>` tags.
- Cloud pickers require HTTPS and valid app keys in `app.options.cloud`.

## Common edit locations
- New controls or modals: edit HTML in `src/player.html` body and CSS in the primary style block.
- New settings: add entry to `settings` object in the app module, and update CSS/behavior accordingly.
- Media support: adjust supported types in `getSupportedTypes()` and related regexes.
- Hash/share behavior: update `getState()`, `updateHash()`, `getHash()`.

## How to extend (checklist)
- Add a control button:
  - Add `<button>` in `.controls` (HTML).
  - Add icon in `.xlinks` SVG sprite (if needed).
  - Wire handler in `setupPrimaryControls()` and update CSS for states.
- Add a new setting:
  - Add a `settings.<key>` entry (label/desc/default/get/set/update).
  - If it changes styling, add a class or CSS var and apply it in CSS.
  - Persist via `persistSetting()` and read via `retrieveSetting()`.
- Add a new tile detail:
  - Extend metadata parsing in `folder.api` or `getHeaderData()`.
  - Update `createFileTemplate()` or tile rendering to show it.
- Add a new media type:
  - Update `getSupportedTypes()` list.
  - Update regexes in `isMedia()` and `removeFileExtension()`.
  - Update file handler list in the PWA manifest (if needed).

## Notes for agents
- Do not introduce a build step or split files unless explicitly requested.
- Maintain existing style and naming (camelCase in JS, kebab-case in CSS classes).
- Keep changes compatible with browsers listed in README.
