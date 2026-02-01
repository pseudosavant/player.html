# player.html
One file drop-in audio and video player web app for using media files served using basic HTTP directory listing.

![player.html in action](https://user-images.githubusercontent.com/455424/140204106-eff3504d-64f0-4038-977b-52555dd96358.png)
![player.html on all of your devices](https://user-images.githubusercontent.com/455424/140200711-7a414217-63db-41b7-8f6e-8d00d7e9eb27.png)

## Usage
`player.html` is designed to be a drop-in audio and video player that does not require any configuration or other files.

To use it, build the single-file distributable and copy `./dist/player.html` into a folder that is served over HTTP using the web server's folder listing functionality. `player.html` uses the folder listing as an API for enumerating the files and folders. It should work with almost any web server, but it has only been tested against NGINX, Apache, and IIS.

### Build
The build inlines CSS, JS, SVGs, and assets into a single portable file.

```
uv run scripts/build.py
```

For continuous rebuilds while editing:

```
uv run scripts/build.py --watch
```

### Development
- `src/player.html` is the dev template (it references `src/styles.css`, `src/js/*`, and `src/svg/*`).
- `dist/player.html` is generated output; do not edit it by hand.

### Supported features

* Only 1 file with zero external dependencies
* [`SVG images`](https://github.com/microsoft/fluentui-system-icons/) are inlined
* May be installed as a PWA (Progressive Web App) app. Dynamically generated inline data URI manifest file.
* Playback of `MP4`, `M4V`, `MOV`, `MKV`, `WEBM`, `OGG`, `MP3`, `WAV`, `AAC`, `M4A` files using the browser media engine
* Support for loading external `SRT` and `VTT` subtitle files
* Shareable URL that will load `player.html` in the same folder location, and media position
* Custom media playback controls (fullscreen, play, pause, mute, etc, volume, playback rate)
* Picture-in-picture support
* Progress bar with timestamp preview thumbnail on hover
* Video thumbnails: [using prerendered thumbnail files](#thumbnails), or rendered on-the-fly in-browser
* Animated thumbnails**
* Thumbnail caching using `localStorage`, check cache size, clear cache
* Select your own custom theme color
* Social media metadata (`og:\*`, `twitter:\*`)
* Media file metadata (bitrate, resolution, etc)
* Keyboard shortcuts (press `?` to see the list)
* Paste and Play: just do `CTRL+V` to play the media URL that you currently have in the clipboard
* Support for playing media directly from ![onedrive](https://user-images.githubusercontent.com/455424/93652838-4cc6dd80-f9cb-11ea-8d8c-062705d5500e.png) **OneDrive** and ![gdrive](https://user-images.githubusercontent.com/455424/93652836-4c2e4700-f9cb-11ea-9a71-7325f745baf9.png) **Google Drive**. You **must supply the appropriate keys** in the `app.options.cloud` AND register your app with Microsoft and/or Google. Instructions are in the code. `player.html` also **must be served over HTTPS** for the Microsoft and Google auth flows to work. [Remix this Glitch](https://glitch.com/edit/#!/player-html-remix?path=src%2Fplayer.html%3A487%3A10) to easily check it out over HTTPS with your own API keys.

\* Be careful with concurrency. Increasing the setting above 1 does make it generate thumbnails much faster. But it is very easy for HTTP requests for generating thumbnails to saturate a connection enough that the main video gets starved for bandwidth. Especially if you browse into a folder with many dozens of videos in it.

\** Animated thumbnails can consume a lot of data. The experience may degrade on slower network connections

<a name="thumbnails"></a>
## Pre-rendered server-side thumbnails

`player.html` can use server-side thumbnails for any video that has one available. It will fall back to generating thumbnails in the browser otherwise. The server-side thumbnail files must follow the common filename convention of using the video file name, with the extension replaced with an image extension, in the same folder as the video. Note: The image files must be shown by your web server's directory browsing (may require mime-type adjustments on some servers) feature to show up in `player.html`.

### Naming example:

* Media filename: `myMedia.mp4`
* Matching thumbnail filename: `myMedia.jpg` 

### How to pre-render thumbnails

The easiest way to create thumbnails from video files is on the command-line with [`ffmpeg`](https://ffmpeg.org/). The following command will create a JPEG thumbnail (`myVideo.jpg`) from the video frame 5 seconds into `myVideo.mp4`: `ffmpeg -i myVideo.mp4 -ss 00:00:05.000 -vframes 1 myVideo.jpg`. Loop over folders of video files using your preferred shell (bash, cmd, powershell, etc) to process many videos.

### Supported thumbnail image formats/extensions
* GIF
* JPEG
* JPG
* PNG
* WEBP

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

&copy; 2024 Paul Ellis
