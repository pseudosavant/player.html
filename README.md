# Video Player In HTML
## 💽 Player.html 💽
One file drop-in video player web app for using MP4 video files served using basic directory listing.

![player.html in action](https://user-images.githubusercontent.com/455424/94622509-317b8e00-0267-11eb-904a-ffd75fe644df.jpg)
![player.html on all of your devices](https://user-images.githubusercontent.com/455424/94621565-6981d180-0265-11eb-98da-c0400530ac1a.jpg)

# 👨‍💻  Language Used 👨‍💻 
* HTML
* CSS

#  ❗️📳 Supported Devices ❕📳
* 📺 T.V.
* 📱 Mobail
* 📟 Tablet 



### ❗️🌐 Supported Web Servers ❕🌐

* NGINX ([`autoindex`](https://nginx.org/en/docs/http/ngx_http_autoindex_module.html) on)
* Apache ([`mod_autoindex`](https://cwiki.apache.org/confluence/display/HTTPD/DirectoryListings))
* IIS (enable [`Directory Browsing`](https://docs.microsoft.com/en-us/iis/configuration/system.webserver/directorybrowse))

## 🧰 Usage 🧰
`player.html` is designed to be a drop-in video player that does not require any configuration or other files.

To use it, copy the [`./src/player.html`](src/player.html) file into a folder that is served over HTTP using the web server's folder listing functionality. `player.html` basically uses the folder listing as an API for enumerating the files and folders. It should work with almost any web server, but it has only been tested against NGINX, Apache, and IIS.

### ❗️ ❕ Supported features ❕ ❗️

* Only 1 file with zero external dependencies
* [`SVG images`](https://github.com/microsoft/fluentui-system-icons/) are inlined
* May be installed as a PWA (Progressive Web App) app. Dynamically generated inline data URI manifest file.
* Playback of `MP4`, `M4V`, `MOV`, `MKV`, `WEBM`, and `OGG` files using the browser video engine
* Support for loading SRT and VTT subtitles
* Shareable URL that will load `player.html` in the same folder location, and video position
* Custom video playback controls (fullscreen, play, pause, mute, etc)
* Progress bar with timestamp preview thumbnail on hover
* Video thumbnail generation, with concurrency configuration (default 1)*
* Thumbnail caching using `localStorage`
* Social media metadata (`og:\*`, `twitter:\*`)
* Video file metadata (bitrate, resolution, etc)
* Keyboard shortcuts (press `?` to see the list)
* Paste and Play: just do `CTRL+V` to play the video URL that you currently have in the clipboard
* Support for playing videos directly from ![onedrive](https://user-images.githubusercontent.com/455424/93652838-4cc6dd80-f9cb-11ea-8d8c-062705d5500e.png) **OneDrive** and ![gdrive](https://user-images.githubusercontent.com/455424/93652836-4c2e4700-f9cb-11ea-9a71-7325f745baf9.png) **Google Drive**. You **must supply the appropriate keys** in the `app.options.cloud` AND register your app with Microsoft and/or Google. Instructions are in the code. `player.html` also **must be served over HTTPS** for the Microsoft and Google auth flows to work. [Remix this Glitch](https://glitch.com/edit/#!/player-html-remix?path=src%2Fplayer.html%3A487%3A10) to easily check it out over HTTPS with your own API keys.

\* Be careful with concurrency. Increasing the setting above 1 does make it generate thumbnails much faster. But it is very easy for HTTP requests for generating thumbnails to saturate a connection enough that the main video gets starved for bandwidth. Especially if you browse into a folder with many dozens of videos in it.

## 📑 License 📑

* [MIT](./LICENSE)

&copy; 2020 Paul Ellis
