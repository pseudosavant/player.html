    const global = window;
    const $html = $('html');
    const $body = $('body');
    const $playerContainer = $('.player-container');
    const $progressBar = $('.progress-bar');
    const $player = $('.player');
    const $trick = $('.trick');
    const $fileinfo = $('.fileinfo');
    const $help = $('.help');
    const $settings = $('.settings');
    const $subtitles = $('.subtitle-selection');
    const $currentTimestamp = $('.current-timestamp');

    const getSupportedTypes = () => {
      const supported = {
        extensions: [],
        mime: []
      };

      const types = [
        { mime: 'video/mp4',        extensions: ['mp4', 'm4v', 'mov', '3gp'] },
        { mime: 'video/webm',       extensions: ['webm'] },
        { mime: 'video/x-matroska', extensions: ['mkv'] },
        { mime: 'video/matroska',   extensions: ['mkv'] },
        { mime: 'video/mp2t',       extensions: ['ts', 'mp2'] },
        { mime: 'video/x-msvideo',  extensions: ['avi'] },
        { mime: 'video/msvideo',    extensions: ['avi'] },
        { mime: 'video/avi',        extensions: ['avi'] },
        { mime: 'video/vnd.avi',    extensions: ['avi'] },
        { mime: 'video/x-ms-wmv',   extensions: ['wmv'] },
        { mime: 'video/x-ms-asf',   extensions: ['wmv'] },
        { mime: 'video/x-flv',      extensions: ['flv'] },
        { mime: 'audio/wav',        extensions: ['wav'] },
        { mime: 'audio/mpeg',       extensions: ['mp3'] },
        { mime: 'audio/aac',        extensions: ['aac'] },
        { mime: 'audio/m4a',        extensions: ['m4a'] },
        { mime: 'audio/ogg',        extensions: ['ogg'] }
      ];

      const v = document.createElement('video');
      types.forEach(type => {
        if (v.canPlayType(type.mime) !== '') {
          supported.extensions.push(...type.extensions);
          supported.mime.push(type.mime);
        }
      });

      return supported;
    }

    const isSupportedMimeType = (mime) => app.options.supportedTypes.mime.includes(mime);
    app.options.supportedTypes = getSupportedTypes();
    console.info(`Supported mime-types: ${app.options.supportedTypes.mime.join(', ')}`);

    const hashState = { location: '', media: '' };

    const urlToFolder = (url) => {
      if (isFolder(url)) return url;

      var pieces = url.split('/'); // Break the URL into pieces
      pieces.pop(); // Remove the last piece (the filename)
      return pieces.join('/') + '/'; // Put it back together with a trailing /
    }

    const isFile = (url) => {
      const parsed = new URL(url);
      const finalPosition = parsed.pathname.lastIndexOf('/') + 1;
      const finalPart = parsed.pathname.substring(finalPosition);
      const isFile = hasPeriod(finalPart) || isUppercase(finalPart)
      return isFile;
    }
    const isUppercase = (s) => !!s.match(/^[A-Z]+$/);
    const hasPeriod = (s) => s.indexOf('.') >= 0;
    const isFolder = (url) => !isFile(url);

    const urlToFilename = (url) => {
      const re = /\/{1}([^\/]+\.[\w\d]{2,4})$/;
      const parts = re.exec(url);
      return (parts && parts.length > 1 ? parts[1] : url);
    }

    const urlToLabel = (url) => {
      if (!isString(url)) return;

      const fragments = url.split('/');

      const label = removeFileExtension(
        decodeURIComponent(
          fragments[fragments.length - 1]
        )
      );

      const prefixRe = /^(the|a)(\s|%20)/i;
      const hasPrefix = prefixRe.test(label);

      if (hasPrefix) {
        const prefix = prefixRe.exec(label);
        const length = prefix[1].length + prefix[2].length;
        return `${label.substring(length)}, ${prefix[1]}`;
      } else {
        return label;
      }
    }

    const urlType = (url) => {
      if (isHiddenFileOrFolder(url)) {
        return 'hidden';
      } else if (url[url.length - 1] === '/') {
        return 'folder';
      } else if (isMedia(url) || isSubtitle(url)) {
        return 'file';
      } else {
        return 'unknown';
      }
    }

    const removeFileExtension = (s) => {
      const supportedMediaExtensions = app.options.supportedTypes.extensions.join('|');
      const re = new RegExp(`\\.+(${supportedMediaExtensions})+$`, 'i');
      return s.replace(re, '');
    }

    const sortFiles = (a, b) => {
      const labelA = urlToLabel(a.url);
      const labelB = urlToLabel(b.url);

      return labelA < labelB ? -1 : 1;
    }

    const isMedia = (haystack, fileExtensions) => {
      const supportedMediaExtensions = app.options.supportedTypes.extensions.join('|');
      const re = new RegExp(`\\.+(${supportedMediaExtensions})+$`, 'i');
      return re.test(haystack);
    };

    const isAudio = (url) => {
      const re = /(?:\/)((?:[^/])+\.(?:wav|mp3|aac|m4a|ogg))/gi
      return re.test(url);
    }

    const isImage = (url) => {
      const re = /(?:\/)((?:[^/])+\.(?:png|jpeg|jpg|gif|webp))/gi
      return re.test(url);
    }

    const isHiddenFileOrFolder = (url) => {
      const reHidden = /\/\..+$/i;
      return url.toString().match(reHidden);
    }

    const linksHash = (links) => {
      var output = '';
      if (links.files && links.files.length > 0) {
        output += links.files.reduce((acc, link) => acc + link.url, '')
      }

      if (links.folders && links.folders.length > 0) {
        output += links.folders.reduce((acc, link) => acc + link.url, '')
      }

      return output;
    }

    const createLinks = async (url) => {
      const targetUrl = url || window.location.href;
      const folder = urlToFolder(targetUrl);
      const links = await folderApiRequest(folder);

      const oldLinksHash = linksHash(app.links);
      const newLinksHash = linksHash(links);

      app.links = links;

      // Only show the links if they have changed
      if (oldLinksHash !== newLinksHash) showLinks(links);
    }

    const showLinks = async (links) => {
      var html = '';
      const folders = links.folders;
      const files = links.files;
      const base = getBaseLocation(window.location);

      folders.forEach((folder) => {
        const rawUrl = folder.url;
        const url = decodeURI(rawUrl).replace(base, '');
        const label = url;
        const optClasses = (folder.type === 'parent' ? 'parent' : '');

        html += createFolderTemplate(rawUrl, label, optClasses);
      });

      const removeUrlExtension = (url) => {
        const re = /^(.*)(?:\.\w+)$/i;
        const results = re.exec(url);

        if (!results || results.length === 0) return undefined;

        return results[1];
      }

      const findThumbnail = (mediaUrl, files) => {
        if (!Array.isArray(files)) return undefined;

        if (isAudio(mediaUrl)) {
          const audioIconUrl = './assets/audio-icon.svg';
          return {url: audioIconUrl};
        }

        const mediaPrefix = removeUrlExtension(mediaUrl);

        const thumbnails = files.filter((file) => isImage(file.url));
        const thumb = thumbnails.find((file) => {
          const filePrefix = removeUrlExtension(file.url);
          return mediaPrefix === filePrefix;
        });
        return thumb;
      }

      const subtitles = files.filter((file) => isSubtitle(file.url));
      populateSubtitles(subtitles);

      const medias = files.filter((file) => isMedia(file.url));
      medias.sort(sortFiles);

      medias.forEach((file) => {
        const rawUrl = file.url;
        const url = decodeURI(rawUrl).replace(base, '');
        const label = urlToLabel(url);
        const cssClasses = [];

        const preRenderedThumbnail = findThumbnail(file.url, links.files);
        const preRenderedThumbnailAvailable = preRenderedThumbnail && preRenderedThumbnail.url;
        const thumbnailUrl = (preRenderedThumbnailAvailable ? preRenderedThumbnail.url : '');

        if (preRenderedThumbnailAvailable) cssClasses.push('prerendered');
        if (rawUrl === $player.src) cssClasses.push('current');

        html += createFileTemplate(rawUrl, label, cssClasses.join(' '), thumbnailUrl);
      });

      $('.links').innerHTML = html;

      const $links = [...document.querySelectorAll('.file, .folder')];
      $links.forEach((link) => $(link).on('click', clickLink));

      populateThumbnails();
    }

    const clickLink = (e) => {
      e.preventDefault();

      // Find `a.file` or `a.folder` element. `e.target` can be children too instead.
      const getTargetEl = (e) => {
        const anchors = [...e.composedPath()].filter((el) => el.nodeName === 'A');
        const $anchors = anchors.map((el) => $(el));
        const $fileOrFolder = $anchors.filter(($el) => ($el.hasClass('file') || $el.hasClass('folder')));

        return $fileOrFolder[0];
      }

      const $el = getTargetEl(e);

      if ($el.hasClass('file')) actionPlay($el.href);
      if ($el.hasClass('folder')) {
        hashState.location = $el.href;
        clearThumbnailQueue();
        createLinks($el.href);
      }

      updateHash();
    }

    const createFileTemplate = (url, label, optionalClasses = '', preRenderedThumbnailUrl = '' ) => {
      const singleQuoteEscapeCode = '%27';
      const escapedUrl = url.replace(`'`, singleQuoteEscapeCode);
      const isAudioClass = (isAudio(url) ? 'audio-file' : '');

      return `<a href='${escapedUrl}' class='file ${isAudioClass} ${optionalClasses}' title='Play ${escapedUrl}' style='${(preRenderedThumbnailUrl ? '--image-url-0: url(' + preRenderedThumbnailUrl + ')': '')}' draggable='false'>
                <div class='title' draggable='false'>${label}</div>
                <div class='arrow' draggable='false'>
                  <svg><use xlink:href='#svg-play'/></svg>
                </div>
              </a>`;
    }

    const createFolderTemplate = (url, label, optionalClasses = '') => {
      const singleQuoteEscapeCode = '%27';
      const escapedUrl = url.replace(`'`, singleQuoteEscapeCode);

      return `<a href='${escapedUrl}' class='folder ${optionalClasses}' draggable='false' title='Navigate to ${escapedUrl}'>
                <div class='title' draggable='false'>
                  <svg class='icon'><use xlink:href='#svg-folder-arrow'/></svg><span class="label">${label}</span>
                </div>
                <div class='arrow' draggable='false'>
                  <svg class='open'><use xlink:href='#svg-folder-open'/></svg>
                  <svg class='closed'><use xlink:href='#svg-folder-closed'/></svg>
                </div>
              </a>`;
    }

    var thumbnailPromises = [];
    const populateThumbnails = async () => {
      const $files = [...document.querySelectorAll('.file')];
      const queue = [];

      $files.forEach(($file) => {
        const url = $file.href;
        thumbnailPromises.push({$file, url});
      });

      const concurrency = app.options.thumbnails.concurrency;

      for (let j = 0; j < thumbnailPromises.length; j + concurrency) {
        // If there are promises left shift the first one into the queue
        if (thumbnailPromises.length > 0) {
          let work = thumbnailPromises.shift();
          queue.push(setThumbnail(work.$file, work.url));
        }

        // If the queue is full/ready run all the promises
        if (queue.length >= concurrency) {
          const results = await Promise.all(queue);
          queue.length = 0; // clears array
        }
      }
    }

    const clearThumbnailQueue = () => { thumbnailPromises = []; }

    const getRelativePosition = () => $player.currentTime / $player.duration || 0;
    const getProgressBarWidth = () => $progressBar.offsetWidth;

    const getState = () => {
      const location = hashState.location;
      const media = getMediaUrl();
      const time = $player.currentTime;
      const state = { location, media, time }

      return state;
    }

    const getBaseLocation = (l) => l.protocol + '//' + l.host;
    const getMediaUrl = () => $player.src;

    const encodeHash = (hash) => encodeURIComponent(base64EncodeUTF(JSON.stringify(hash)));
    const decodeHash = (hash) => JSON.parse(base64DecodeUTF(decodeURIComponent(hash)));
    const getHash = () => {
      const urlHash = window.location.hash.substr(1);

      var hash = {};
      try {
        hash = decodeHash(urlHash);
      } catch (e) { }

      return hash;
    }

    const updateHash = () => {
      var url = new URL(location);
      url.hash = encodeHash(getState());
      history.replaceState(null, document.title, url);
    }

    const updateTitle = () => {
      const prefix = `player.html`
      const url = $player.src;

      if (!url) return document.title = prefix;

      const name = urlToLabel(url);
      const time = secondsToString($player.currentTime);
      const title = `${prefix} – ${name} (${time})`;

      return document.title = title;
    }

    const updateVersionNumber = () => {
      const version = document.querySelector('meta[name="version"]').getAttribute('content');
      const els = [...document.querySelectorAll('.version')];
      els.forEach((el) => el.innerText = `v${version}`);
    }

    const openFromCloud = (cloud) => {
      return async () => {
        var metadata;

        switch (cloud) {
          case 'onedrive':
            metadata = await onedrive();
            break;
          case 'gdrive':
            metadata = await gdrive();
            break;
        }

        return actionPlay(metadata.url);
      }
    }

    const actionPasteAndPlay = (e) => {
      e.preventDefault();

      const re = /^https?:\/\//i;
      const clipboard = e.clipboardData.getData('text');

      if (clipboard && re.test(clipboard)) {
        const url = clipboard;
        console.info(`Playing media from clipboard: ${clipboard}`);
        actionPlay(url);
      }
    }

    const resetPlayer = () => {
      resetFileinfo();
      clearSubtitles();
      updatePlaybackState('stop');
      $player.playbackRate = 1;
      $player.onerror = undefined;
      updatePlaybackRate();
      updateProgress();
    }

    const updatePlaybackState = (state) => {
      const states = {
        play: 'is-playing',
        pause: 'is-paused',
        stop: 'is-stopped'
      }

      const $el = $('body');

      Object.keys(states).forEach((key) => {
        if (state === key) {
          if (!$el.hasClass(states[key])) {
            $el.addClass(states[key]);
          }
        } else {
          $el.removeClass(states[key]);
        }
      });
    }

    const getRanges = () => {
      if ($player.buffered.length === 0) return [];

      var ranges = [];
        for (let i = 0; i < $player.buffered.length; i++) {
          const start = $player.buffered.start(i);
          const end   = $player.buffered.end(i);
          ranges.push({start, end})
        }
        return ranges;
    }

    const updateRanges = () => {
      const ranges = getRanges();
      const transparentGradient = 'linear-gradient(to right, transparent, transparent)';
      const gradient = (ranges.length > 0 ? rangesToGradient(ranges, $player.duration) : transparentGradient);

      // Only set if the gradient is different
      if ($progressBar.dataset.gradient !== gradient){
        $progressBar.dataset.gradient = gradient;
        $progressBar.style.backgroundImage = gradient;
      }
    }

    const rangesToGradient = (ranges, duration) => {
      const color = 'var(--progress-bar-buffer-color)';

      const gradient = ranges.reduce((acc, range) => {
        const relativeStart = `${(range.start / duration) * 100}%`;
        const relativeEnd   = `${(range.end   / duration) * 100}%`;

        return acc + `, transparent ${relativeStart}, ${color} ${relativeStart}, ${color} ${relativeEnd}, transparent ${relativeEnd}`;
      }, 'linear-gradient(to right') + ')';

      return gradient;
    }

    const actionPlay = (url) => {
      // Don't restart playback if it is the currently playing media
      if (url === $player.currentSrc && $player.src.length > 0) return;

      resetPlayer();

      // Being playback if there is a URL
      if (!!url) {
        console.info(`Loading media: ${url}`);
        $player.autoplay = true;

        $player.once('error', () => console.warn(`Unable to begin playback: ${url}`));
        $player.once('play', () => console.info(`Playback started: ${url}`));
        $player.once('loadedmetadata', () => updateDuration($player.duration));
        $player.src = $trick.src = hashState.media = url;
        $player.load();
        $body.addClass('is-loaded');

        $player.once('loadedmetadata', () => {
          if ($player.videoWidth === 0 && $player.videoHeight === 0) {
            $body.addClass('is-audio');
          } else {
            $body.removeClass('is-audio');
          }
        });

        document.querySelector('.media-title').innerText = urlToLabel(url);

        const scrollOpts = {
          behavior: 'smooth',
          block: 'center'
        }
        setTimeout(() => $player.scrollIntoView(scrollOpts), 16);

      } else { // Reset the player if no URL supplied
        updateDuration(0);

        unloadMediaSrc($player);
        unloadMediaSrc($trick);

        hashState.media = undefined;
        $body.removeClass('is-loaded');

        console.info(`Playback stopped`);
      }

      setCurrentMediaTile();
    }

    const checkFileHandlerOpen = () => {
      if ('launchQueue' in window) {
        window.launchQueue.setConsumer(async (launchParams) => {
          if (launchParams.files.length > 0) {
            const fileHandle = launchParams.files[0];
            const file = await fileHandle.getFile();
            const url = URL.createObjectURL(file);

            actionPlay(url);
          }
        });
      }
    };

    const unloadMediaSrc = (el) => {
      el.removeAttribute('src'); // Unset video, use `removeAttribute` instead of `src = undefined` to prevent 404s for `/video-thumbnail.js/src/undefined`
      el.load(); // Must invoke `load` to complete the `src` change
    }

    const populateSubtitles = async (subtitles) => {
      var html = '';

      if (subtitles.length === 0) {
        $body.addClass('no-subtitles');
        html = `<li class='subtitle-item modal-item'>No subtitles found in current folder</li>`;
      } else {
        $body.removeClass('no-subtitles');

        for (let i = 0; i < subtitles.length; i++) {
          const url = subtitles[i].url;
          const name = decodeURIComponent(urlToFilename(url));
          const duration = await getSubtitleDuration(url);
          const hms = secondsToString(duration);
          html += `<li class='subtitle-item modal-item' data-subtitle-url='${url}' title='${url}'>${name} (${hms})</li>`
        }
      }

      html += `<li class='subtitle-item modal-item disable-subtitles'>Turn off subtitles</li>`;

      $subtitles.html(html);

      const list = [...$subtitles.querySelectorAll('li')];
      list.forEach((li) => {
        const $li = $(li);
        $li.on('click', (e) => {
          e.preventDefault();

          if ($li.hasClass('disable-subtitles')) {
            clearSubtitles();
          } else {
            loadSubtitle(li.dataset.subtitleUrl);
          }
        });
      })
    }

    const loadSubtitle = async (url) => {
      clearSubtitles();

      if (isSRT(url)) {
        url = await srtToVtt(url);
      } else {
        url = await urlToObjectUrl(url, 'text/vtt');
      }

      getSubtitleDuration(url);

      const $track = $(`<track src='${url}' label='${url}' default>`);
      $player.append($track);
    }

    const clearSubtitles = () => {
      const tracks = [...document.querySelectorAll('track')];

      if (tracks) {
        tracks.forEach((track) => {
          $(track).remove();
        });
      }
    }

    const isSubtitle = (url) => url.toString().endsWith('.vtt') || url.toString().endsWith('.srt');

    const isSRT = (url) => {
      try {
        return url.endsWith('.srt');
      } catch (e) {
        return false;
      }
    }

    const srtToVtt = async (url) => {
      const re = /(\d{2}:\d{2}:\d{2}),(\d{3})/g;

      const srt = await fetch(url);
      const text = await srt.text();
      const converted = `WEBVTT\r\n\r\n${text.replace(re, "$1.$2")}`;

      const blob = new Blob([converted], {type: 'text/vtt'})
      return URL.createObjectURL(blob);
    }

    const getSubtitleDuration = async (url) => {
      const f = await fetch(url);
      const text = await f.text();

      const lines = text.split('--> ');
      const lastLinePosition = lines.length - 1;
      const lastLine = lines[lastLinePosition];

      const re = /(\d{2}):(\d{2}):(\d{2})\.(\d{3})/;
      const results = re.exec(lastLine);

      if (results) {
        const h = parseInt(results[1], 10);
        const m = parseInt(results[2], 10);
        const s = parseInt(results[3], 10);
        const ms = parseInt(results[4], 10);

        const seconds = h * 3600 + m * 60 + s + ms / 1000;
        return seconds;
      }

      return 0;
    }

    const urlToObjectUrl = async (url, type) => {
      const srt = await fetch(url);
      const blob = await srt.blob();

      if (type) {
        return URL.createObjectURL(blob.slice(0, blob.size, type));
      } else {
        return URL.createObjectURL(blob);
      }

    }

    const setCurrentMediaTile = () => {
      const $former = $('.links .current')
      if ($former && $former.classList) $former.classList.remove('current');

      const $current = $(`.file[href='${$player.src}']`);
      if ($current && $current.classList) $current.classList.add('current');
    }

    const actionPlayPause = () => {
      if ($player.src && $player.paused) {
        $player.play();
        updatePlaybackState('play');
      } else if (!$player.src) {
        updatePlaybackState('stop');
      } else {
        $player.pause();
        updatePlaybackState('pause');
      }
    }

    const actionVolume = () => {
      let volume = +$player.dataset.volume;
      if (volume === 3) {
        volume = 0;
      } else {
        volume += 1;
      }
      $player.dataset.volume = volume;

      const logVolume = (volume === 0 ? 0 : Math.pow(10, volume / 3) / 10);
      $player.volume = logVolume;
    }

    const updateVolume = () => {
      const $el = $('.primary-buttons');
      const levelPrefix = 'volume-';
      const levels = [0, 1, 2, 3];
      const currentLevel = +$player.dataset.volume;

      $player.muted = (currentLevel === 0);

      // Clear the existing level setting
      levels.forEach((level) => $el.removeClass(`${levelPrefix}${level}`));

      // Apply the new level setting
      $el.addClass(`${levelPrefix}${currentLevel}`);
    }

    const actionPlaybackRate = () => {
      const playbackRate = +$player.playbackRate;
      $player.playbackRate = (playbackRate >= 2 ? 0 : playbackRate + 0.25);
    }

    const updatePlaybackRate = () => {
      setCSSVariableString('--playback-rate', $player.playbackRate.toFixed(2), $('.btn-playback-rate'));

      const skipDuration = Math.abs(getSkipDuration());
      const replayDuration = Math.abs(getReplayDuration());
      const forwardTitle = (skipDuration > 1 ? `${skipDuration} seconds` : `1 frame`);
      const rewindTitle = (replayDuration > 1 ? `${replayDuration} seconds` : `1 frame`);
      $('.btn-fast-forward').title = `Go forward ${forwardTitle} [Right Arrow]`;
      $('.btn-rewind').title       = `Go back ${rewindTitle} [Left Arrow]`;
    }

    const actionStop = () => {
      actionPlay(); // Calling `actionPlay` with no source unsets the video
      updatePlaybackState('stop');
    }

    const getReplayDuration = () => {
      const framerate = (app.metadata.framerate ? app.metadata.framerate : 30);
      const frameDuration = 1 / framerate;
      const playbackRate = $player.playbackRate;
      const delta = 15;

      const val = -1 * (playbackRate === 0 ? frameDuration : delta * playbackRate);

      return val;
    }

    const getSkipDuration = () => {
      const framerate = (app.metadata.framerate ? app.metadata.framerate : 30);
      const frameDuration = 1 / framerate;
      const playbackRate = $player.playbackRate;
      const delta = 30;

      const val = (playbackRate === 0 ? frameDuration : delta * playbackRate);

      return val;
    }

    const actionReplay = () => seek(getReplayDuration());
    const actionSkip = () => seek(getSkipDuration());

    const seek = (delta) => {
      const newTime = $player.currentTime + delta;
      return $player.currentTime = minmax(0, newTime, $player.duration);
    }

    const updateVolumeSupport = () => {
      const volumeValueKey = 0.97846; // Just a random number
      $player.volume = volumeValueKey;

      // `video.volume` is read-only on iOS. It falsely returns the value you set it
      // to if you check it within the same loop cycle. setTimeout must be used to
      // delay the check until the next event loop cycle.
      setTimeout(() => {
        if ($player.volume !== volumeValueKey) {
          $body.addClass('no-volume');
        } else {
          $body.removeClass('no-volume');
        }
      }, 1);
    }

    /* Fullscreen */
    const actionFullscreenToggle = () => (isFullscreen() ? exitFullscreen() : requestFullscreen());
    const isFullscreen = () => !!document.fullscreenElement || !!document.webkitFullscreenElement;
    const updateFullscreenSupport = () => {
      const $el = $playerContainer;

      if (
        (document.fullscreenEnabled       && $el.requestFullscreen) ||
        (document.webkitSupportsFullscreen && $el.webkitRequestFullscreen) ||
        $player.webkitEnterFullscreen
      ) {
        $('.btn-fullscreen').addClass('enabled');
      }
    }

    const requestFullscreen = () => {
      const $el = $playerContainer;
      const requests = ['requestFullscreen', 'webkitRequestFullscreen', 'msRequestFullscreen'];
      if (prefixRun($el, requests)) return true;

      if ($player.webkitEnterFullscreen) return $player.webkitEnterFullscreen();
    }

    const exitFullscreen = () => {
      const $el = document;
      const exits = ['exitFullscreen', 'webkitExitFullscreen', 'msExitFullscreen'];
      if (prefixRun($el, exits)) return true;

      if ($player.webkitExitFullScreen) return $player.webkitExitFullScreen();
    }

    /* Picture-in-picture */
    const actionPIPToggle = () => (isPIP() ? exitPIP() : requestPIP());
    const isPIP = () => !!document.pictureInPictureElement;
    const isPIPSupported = () => !!document.pictureInPictureEnabled;
    const updatePIPSupport = () => { if (isPIPSupported()) $('.btn-pip').addClass('enabled'); };
    const requestPIP = async () => {
      if (isPIPSupported()) {
        await $player.requestPictureInPicture();
        $html.addClass('is-pip')
      } else {
        $html.removeClass('is-pip');
      }
    };
    const exitPIP = () => {
      if (isPIPSupported()) document.exitPictureInPicture();
      $html.removeClass('is-pip');
    };

    const prefixRun = ($el, methods) => {
      const supportedMethod = methods.find(method => $el[method]);
      if (typeof $el[supportedMethod] === 'function') return $el[supportedMethod]();

      return false;
    };


    var timeoutFadeout;
    $playerContainer.on('mousemove', async () => {
      const c = 'fadeout';
      $playerContainer.removeClass(c);

      clearTimeout(timeoutFadeout);
      timeoutFadeout = setTimeout(() => {
        $playerContainer.addClass(c);
      }, 3000);
    });

    /* Progress bar */
    const actionProgressBarSeek = (e) => {
      const relative = e.offsetX / getProgressBarWidth();
      $player.currentTime = $player.duration * relative;
    }

    const throttledUpdateHashAndTitle = throttle(() => {
      updateHash();
      updateTitle();
    }, app.options.updateRate.timeupdate * 25);

    const updateProgress = () => {
      const update = () => {
        updateRelativePosition(getRelativePosition());
        updateAbsolutePosition($player.currentTime);
        updateRanges();

        throttledUpdateHashAndTitle();
      }

      requestAnimationFrame(update);
    }

    const durationEl = $('.current-timestamp');
    const absolutePositionEl = durationEl;
    const relativePositionEl = $('.progress-bar');
    const trickPositionEl = $('.trick-container');

    const updateDuration              = (d) => setCSSVariableString('--duration',          secondsToString(d), durationEl);
    const updateAbsolutePosition      = (p) => setCSSVariableString('--absolute-position', secondsToString(p), absolutePositionEl);
    const updateRelativePosition      = (p) => setCSSVariableNumber('--relative-position', `${p * 100}%`, relativePositionEl);
    const updateTrickRelativePosition = (p) => setCSSVariableNumber('--trick-position'   , `${p * 100}%`, trickPositionEl);

    const progressBarTrickHover = (e) => {
      const relative = e.layerX / getProgressBarWidth();
      const absolute = relative * $player.duration;

      updateTrickRelativePosition(relative);

      if (absolute >= 0) trickSeek(absolute);
    }

    const trickSeek = (time) => {
      // Seek to whole seconds if the progress bar width in pixels is less
      // than the media duration. Improves trick seek performance.
      const width = getProgressBarWidth();
      const seekTime = ($trick.duration > width ? Math.floor(time) : time);

      if ($trick.readyState === 0) return;
      if (typeof $trick.fastSeek === 'function') return $trick.fastSeek(seekTime);

      return ($trick.currentTime = seekTime);
    }

    const syncTrickSrc = () => $trick.src = $player.src;

    const playFile = (file) => { if (file) return actionPlay(URL.createObjectURL(file)); };

    const actionOpenLocalFile = () => {
      const reader = new FileReader();
      const supportedTypes = app.options.supportedTypes.mime.join(',');
      const $input = $(`<input type="file" accept="${supportedTypes}"/>`);
      $input.on('change', () => playFile($input.files[0]));
      $input.click();
    }

    const actionDropLocalFile = (e) => {
      $playerContainer.removeClass('drop');
      e.preventDefault();
      const files = e.dataTransfer.files;
      if (files && files.length > 0) playFile(files[0]);
    }

    const setupDragAndDrop = () => {
      $playerContainer.on('dragenter', () => $playerContainer.addClass('drop'));
      $playerContainer.on('dragleave', (e) => {
        // Only remove `drop` class if the target is .player-container
        if (e.target === $playerContainer) $playerContainer.removeClass('drop');
      });
      $playerContainer.on('drop', actionDropLocalFile);
      $playerContainer.on('dragover', (e) => {
        e.dataTransfer.dropEffect = 'link';
        e.preventDefault();
      });
    }

    const setupControls = () => {
      setupPlayerEvents();
      setupPrimaryControls();
      setupModals();
      setupDragAndDrop();
      $body.on('paste', actionPasteAndPlay);
    }

    const setupPrimaryControls = () => {
      $('.btn-subtitles').on('click', () => toggleModal($subtitles));
      $('.btn-fileinfo').on('click', () => toggleModal($fileinfo));
      $('.btn-settings').on('click', () => toggleModal($settings));
      $('.btn-playback-rate').on('click', actionPlaybackRate);
      $('.btn-rewind').on('click', actionReplay);
      $('.btn-fast-forward').on('click', actionSkip);
      $('.btn-stop').on('click', actionStop);
      $('.btn-volume').on('click', actionVolume);
      delay(10, updateVolume);

      $('.btn-onedrive').on('click', openFromCloud('onedrive'));
      $('.btn-gdrive').on('click', openFromCloud('gdrive'));
      $('.btn-local-file').on('click', actionOpenLocalFile);

      $('.btn-play-pause').on('click', actionPlayPause);
      $('.btn-fullscreen').on('click', actionFullscreenToggle);
      updateFullscreenSupport();
      $('.btn-pip').on('click', actionPIPToggle);
      updatePIPSupport();
      updateVolumeSupport();
    }

    const setupModals = () => {
      $fileinfo.on('click', (e) => {
        // Only hide the fileinfo if the target element isn't `<span class="value"/>` so that you can copy value text
        const isValue = $(e.target).hasClass('value');
        if (!isValue) hideModals();
      });
      $help.on('click', hideModals);

      setupSettingsControls();
    }

    const setupSettingsControls = () => {
      const checkBoxes = [...document.querySelectorAll('.settings .modal-item')];
      checkBoxes.forEach((checkbox) => {
        $(checkbox).on('click', (e) => e.stopImmediatePropagation());
      });

      $('.modal-background-overlay').on('click', () => hideModals());
    }

    const setupPlayerEvents = () => {
      $player.on('loadedmetadata', updateFileinfo);
      $player.on('loadeddata', syncTrickSrc);
      $player.on('timeupdate', throttle(updateProgress, app.options.updateRate.timeupdate));
      $player.on('pause', () => updatePlaybackState('pause'));
      $player.on('play',  () => updatePlaybackState('play'));
      $player.on('ended', () => updatePlaybackState('stop'));
      $player.on('click', () => { if ($player.src.length > 0) actionPlayPause(); });
      $player.on('dblclick', actionFullscreenToggle);
      $player.on('volumechange', updateVolume);
      $player.on('ratechange', updatePlaybackRate);

      $progressBar.on('mousemove', throttle(progressBarTrickHover, app.options.updateRate.trickHover));
      $progressBar.on('click', actionProgressBarSeek);
    }

    const keyboardBroker = (e) => {
      // Don't handle keyboard combinations
      if (e.ctrlKey || e.altKey) return;

      switch (e.key) {
        case '0':
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9':
          e.preventDefault();
          const position = e.key / 10;
          $player.currentTime = $player.duration * position;
          break;
        case 'Backspace':
          e.preventDefault();
          const $firstLink = $('.links a');
          if ($firstLink) $firstLink.click();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          actionReplay();
          break;
        case 'ArrowRight':
          e.preventDefault();
          actionSkip();
          break;
        case ' ':
          e.preventDefault();
          actionPlayPause();
          break;
        case 'i':
          toggleModal($fileinfo);
          break;
        case '?':
        case 'F1':
          e.preventDefault();
          toggleModal($help);
          break;
        case 's':
          toggleModal($subtitles);
          break;
        case 'Escape':
          hideModals();
          break;
        case 'f':
          actionFullscreenToggle();
          break;
        case 'r':
          actionPlaybackRate();
          break;
        case 'ContextMenu':
          // preventDefault must be performed on the `contextmenu` event (below
          // switch statement), not the keydown event
          toggleModal($settings);
          break;
      }
      // Prevent default when pressing contextmenu key
      $html.on('contextmenu', (e) => e.preventDefault());
    }
    $body.on('keydown', keyboardBroker);

    const toggleModal = ($el) => {
      if ($el.hasClass('show')) {
        hideModals();
      } else if ($('.modal.show')) {
        hideModals();
        showModal($el);
      } else {
        showModal($el);
      }
    }

    const showModal = ($el) => {
      $el.addClass('show');
      $el.once('click', hideModals);
    }

    const hideModals = (e) => {
      if (e && $(e.target).hasClass('value')) return;

      const modals = [...document.querySelectorAll('.modal.show')];
      modals.forEach((el) => $(el).removeClass('show'));
    }

    const renderSettingsControls = (useDefaults) => {
      const keys = Object.keys(settings);
      const html = keys.reduce((acc, key) => {
        const setting = settings[key];
        const type = setting.type || 'checkbox';
        const value = (useDefaults && !isUndefined(setting.default) ? setting.default : setting.get());
        const checked = (value === true ? 'checked' : '');

        var valueAttribute = '';

        if (typeof value !== 'boolean') {
          if (setting.type === 'button') {
            valueAttribute = `value="${setting.buttonLabel}"`;
          } else if (setting.type === 'color') {
            valueAttribute = `value="${HSLToHex(value, 100, 50)}"`;
          } else {
            valueAttribute = `value="${value}"`;
          }
        }

        return `${acc}
          <li class='modal-item setting-item' title='${setting.desc}'><span class='key'>${setting.label}</span>
            <span class='desc'>
              <label><input type="${type}" class='setting-${key}' ${valueAttribute} ${checked}><span class="metadata"></span></label>
            </span>
          </li>`;
      }, '');

      const $modal = $('.modal.settings')
      $modal.html(html);

      keys.forEach((key) => {
        const setting = settings[key];
        const $el = $(`.setting-${key}`);

        const changeEvent = setting.event || 'click';

        $el.on(changeEvent, () => {
          if ($el.attr('type') === 'button') {
            setting.set();
          } else {
            setting.update();
          }
        });

        $el.on('click', (e) => e.stopImmediatePropagation()); // Don't close the modal for clicks on a settings control
        setting.update();
      });

      return html;
    }

    const retrieveSetting = (key) => {
      const val = storageRetrieve(`setting-${key}`);

      if (+val == val) { // number
        return +val;
      } else if (val === 'true') { // Boolean true
        return true;
      } else if (val === 'false') { // Boolean false
        return false;
      } else { // Fallback to value if present, undefined otherwise
        return val || undefined;
      }
    };
    const persistSetting = (key, value) => storageStore(`setting-${key}`, value);
    const clearSetting = (key) => storageRemove(`setting-${key}`);
    const enumerateSettings = () => Object.keys(localStorage).filter((key) => key.startsWith('setting-')).map((key) => key.replace('setting-', ''));
    const resetSettings = () => {
      const settings = enumerateSettings();
      settings.forEach((setting) => clearSetting(setting));
    }
    const checkIncorrectDefaultHue = () => {
      const settings = {};
      Object.keys(localStorage)
        .filter((key) => key.startsWith('setting-'))
        .forEach((key) => settings[key] = storageRetrieve(key));

      if (settings['setting-blur'] === 'false' &&
          settings['setting-thumbnailing'] === 'false' &&
          settings['setting-animate'] === 'false' &&
          settings['setting-transitions'] === 'false' &&
          settings['setting-hue'] == '0'
      ) {
        resetSettings();
      }
    };
    checkIncorrectDefaultHue();

    const settings = {
      hue: {
        label: 'Theme color',
        desc: 'Set the theme color for player.html',
        event: 'input',
        type: 'color',
        default: getCSSVariable('--default-hue'),
        get: () => (typeof retrieveSetting('hue') !== 'undefined' ? retrieveSetting('hue') : settings.hue.default),
        set: async (val) => {
          persistSetting('hue', val);
          await updateHue(val);
        },
        update: async () => {
          const $el = $('.setting-hue');
          const hex = $el.value;
          const hsl = hexToHSL(hex);
          await settings.hue.set(hsl.h);
        }
      },
      blur: {
        label: 'UI Blur Effects',
        desc: 'Enable/diable blur effects in the UI',
        event: 'change',
        default: true,
        get: () => typeof retrieveSetting('blur') !== 'undefined' ? retrieveSetting('blur') : settings.blur.default,
        set: (val) => persistSetting('blur', val),
        update: () => {
          const $el = $('.setting-blur');
          const val = $el.checked;
          settings.blur.set(val);
        }
      },
      transitions: {
        label: 'UI Transitions',
        desc: 'Enable/disable animated transitions in the UI',
        event: 'change',
        default: true,
        get: () => typeof retrieveSetting('transitions') !== 'undefined' ? retrieveSetting('transitions') : settings.transitions.default,
        set: (val) => persistSetting('transitions', val),
        update: () => {
          const $el = $('.setting-transitions');
          const val = $el.checked;
          settings.transitions.set(val);

          if (val) {
            try {
              delete $('html').dataset.transitions;
            } catch (e) {}
          } else {
            $('html').dataset['transitions'] = 'disabled';
          }
        }
      },
      thumbnailing: {
        label: 'Generate Thumbnails',
        desc: 'Generate thumbnails for video listings. It may use a lot of bandwidth, especially in large folders of videos. Turn off if it causes playback problems.',
        event: 'change',
        default: true,
        get: () => typeof retrieveSetting('thumbnailing') !== 'undefined' ? retrieveSetting('thumbnailing') : settings.thumbnailing.default,
        set: (val) => persistSetting('thumbnailing', val),
        update: () => {
          const $el = $('.setting-thumbnailing');
          const val = $el.checked;
          settings.thumbnailing.set(val);
        }
      },
      animate: {
        label: 'Animate Thumbnails',
        desc: 'Generate animated thumbnails. Disable this to save bandwidth and localStorage space.',
        event: 'change',
        default: true,
        get: () => typeof retrieveSetting('animate') !== 'undefined' ? retrieveSetting('animate') : settings.animate.default,
        set: (val) => persistSetting('animate', val),
        update: () => {
          const $el = $('.setting-animate');
          const val = $el.checked;
          settings.animate.set(val);

          if (val) {
            $html.removeClass('no-thumbnail-animation');
          } else {
            $html.addClass('no-thumbnail-animation');
          }
        }
      },
      cache: {
        label: 'Thumbnail cache',
        buttonLabel: 'Clear',
        desc: 'Amount of localStorage space in your browser that is being used to cache thumbnails',
        event: 'click',
        type: 'button',
        get: () => Math.floor(videoThumbnail.cacheSize() / 1024),
        set: () => {
          videoThumbnail.clearCache();
          settings.cache.update();
        },
        update: () => {
          const size = settings.cache.get();
          const formattedSize = addCommas(size);
          $('.setting-cache + .metadata').html(formattedSize);
        }
      },
      reset: {
        label: 'Reset to defaults',
        buttonLabel: 'Reset',
        desc: 'Reset all settings to their defaults',
        event: 'click',
        type: 'button',
        get: () => {},
        set: () => {
          resetSettings();
          renderSettingsControls(true);
        },
        update: () => {}
      },
    }

    const getHeaderData = async (url) => {
      const opts = {
        method: 'HEAD',
        mode: 'cors',
      }

      const responseHeaders = (h) => {
        const response = {};

        if (h.has('Content-Length')) response.size =     h.get('Content-Length');
        if (h.has('Content-Type'))   response.mimeType = h.get('Content-Type');
        if (h.has('Last-Modified'))  response.date =     h.get('Last-Modified');

        return response;
      }

      // Attempt with method = HEAD first
      try {
        const f = await fetch(url, opts);
        return responseHeaders(f.headers);
      } catch (e) {
        // Fallback on method = GET
        try {
          opts.method = 'GET';
          const f = await fetch(url, opts);
          return responseHeaders(f.headers);
        } catch (e) {
          console.warn(e);
          return {};
        }
      }
    }

    const getFramerate = async () => {
      const frame1 = await requestVideoFrame();

      // Wait a few extra frames to make estimate more accurate
      for (var i = 0; i < 10; i++) {
        const waitFrame = await requestVideoFrame();
      }

      const frame2 = await requestVideoFrame();

      const frames = frame2.metadata.presentedFrames - frame1.metadata.presentedFrames;
      const duration = (frame2.metadata.mediaTime - frame1.metadata.mediaTime);
      const fps = frames / duration;

      return fps;
    }

    const requestVideoFrame = () => {
      if (!supportsVideoFrameCallback()) return;

      const p = new Promise((resolve, reject) => {
        $player.requestVideoFrameCallback((now, metadata) => {
          resolve({now, metadata});
        });
      });

      return p;
    }

    const supportsVideoFrameCallback = () => 'requestVideoFrameCallback' in HTMLVideoElement.prototype;

    const updateFileinfo = async () => {
      const url = $player.currentSrc;
      const subtitles =   ($player.textTracks  && $player.textTracks.length  ? $player.textTracks.length  : 0);
      const audioTracks = ($player.audioTracks && $player.audioTracks.length ? $player.audioTracks.length : 1);

      const metadata = {
        name: urlToFilename(url),
        url: url,
        duration: $player.duration,
        width: $player.videoWidth,
        height: $player.videoHeight,
        subtitles: subtitles,
        audioTracks: audioTracks,
      };

      const headerData = await getHeaderData(url);
      if (headerData.size) metadata.bitrate = headerData.size / $player.duration;

      const headerKeys = Object.keys(headerData);
      headerKeys.forEach((k) => metadata[k] = headerData[k]);

      if (!isAudio(url) && supportsVideoFrameCallback()) metadata.framerate = await getFramerate($player);

      const mapping = {
        name: { name: 'Filename', format: (v) => decodeURIComponent(v)},
        url: 'URL',
        size: {name: 'Size', format: (v) => `${limitPrecision(v / 1024 / 1024, 1)}MB`},
        mimeType: 'Type',
        duration: {name: 'Duration (seconds)', format: (v) => limitPrecision(v, 2)},
        bitrate: {name: 'Bitrate', format: (v) => `${limitPrecision(v * 8 / 1024, 0)}kbps`},
        date: { name: 'Date', format: (d) => dateFormat(new Date(d))},
        framerate: {name: 'Estimated Framerate', format: (v) => `${limitPrecision(v, 3)}fps`},
        width: 'Width',
        height: 'Height',
        subtitles: 'Embedded Subtitles',
        audioTracks: 'Audio Tracks'
      }
      app.metadata = metadata;

      // Generate HTML for each fileinfo metadata item
      var html = '';
      const metadataKeys = Object.keys(metadata);
      metadataKeys.forEach((key) => {
        const map = mapping[key];
        const label = (typeof map === 'object' ? map.name : map);
        const value = (typeof map === 'object' && typeof map.format === 'function' ? map.format(metadata[key]) : metadata[key]);
        html += `<li class='fileinfo-item modal-item ${key}'><span class='key'>${label}</span><span class="value">${value}</span></li>`;
      });

      $fileinfo.html(html);
    }

    const dateFormat = (d) => {
      const formattedDate = Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric'
      }).format(d);
      return formattedDate;
    }

    const resetFileinfo = () => {
      $fileinfo.html('<li class="fileinfo-item modal-item">Metadata not yet loaded</li>');
      app.metadata = {};
    }
    $player.on('loadstart', resetFileinfo);

    const getSVGPoster = (hue) => {
      const h = (typeof hue === 'number' ? hue : getCSSVariable('--theme-hue'))
      const color = `hsl(${h}, 100%, 50%)`;

      const svg = `<?xml version='1.0' encoding='UTF-8' standalone='no'?>
        <svg  width='32' height='32' viewBox='9 7 32 33' version='1.1' xmlns='http://www.w3.org/2000/svg'>
          <path style='fill: ${color}' d='M 13.750134,8.4121203 38.167189,21.116929 c 1.592276,0.828502 2.211438,2.790929 1.382936,4.383205 -0.308051,0.592037 -0.790899,1.074885 -1.382936,1.382937 L 13.750134,39.58788 C 12.157858,40.416381 10.195431,39.797219 9.3669293,38.204943 9.125863,37.741644 9,37.227072 9,36.704809 V 11.295191 c 0,-1.7949254 1.455075,-3.25 3.25,-3.25 0.447654,0 0.889658,0.092471 1.298566,0.2706995 z m -1.153949,2.2177467 -0.110487,-0.04668 c -0.07579,-0.02509 -0.15535,-0.038 -0.235698,-0.038 -0.414214,0 -0.75,0.335786 -0.75,0.75 v 25.409618 c 0,0.120522 0.02904,0.23927 0.08468,0.346185 0.191193,0.367448 0.644061,0.510332 1.011509,0.319139 L 37.01324,24.665324 c 0.136624,-0.07109 0.24805,-0.182515 0.319139,-0.319139 0.191192,-0.367449 0.04831,-0.820316 -0.319139,-1.011509 z'/>
        </svg>`;

      const base64 = btoa(svg);
      return `data:image/svg+xml;base64,${base64}`;
    }

    const updatePlayerBackground = (hue) => {
      hue = (typeof hue === 'number' ? hue : retrieveSetting('hue'));
      const dataUri = getSVGPoster(hue);
      $player.style.backgroundImage = `url('${dataUri}')`;
    }

    const getThemeColorBaseHSL = () => {
      const themeColorBase = getCSSVariable('--theme-color-base')
        .split(',')
        .map((s) => s.replace('%', '').trim());
      const h = +themeColorBase[0];
      const s = +themeColorBase[1];
      const l = +themeColorBase[2];

      return {h,s,l};
    }

    const updateHue = async (val) => {
      const hue = (isUndefined(val) ? retrieveSetting('hue') : val);
      setCSSVariableNumber('--theme-hue', hue, $html);

      const baseColor = getThemeColorBaseHSL();
      const hex = HSLToHex(hue, baseColor.s, baseColor.l);

      const meta = $('meta[name="theme-color"]');

      if (meta) {
        meta.attr('content', hex);
      } else {
        $('head').append(`<meta name="theme-color" content="${hex}">`);
      }

      updatePlayerBackground();
    }

    const isPlaying = () => (
      $player.currentTime > 0 &&
      !$player.paused &&
      !$player.ended
    );

    const hasPreRenderedThumbnail = (node) => node.style.getPropertyValue('--image-url-0').length > ('url(http://)').length;

    const setThumbnail = async (node, url) => {
      if (hasPreRenderedThumbnail(node)) return;
      const thumbnailOpts = app.options.thumbnails;

      const timestamps = (retrieveSetting('animate') ? [...thumbnailOpts.timestamps] : [thumbnailOpts.timestamps[0]]);

      const opts = {
        size: thumbnailOpts.size,
        mime: {...thumbnailOpts.mime},
        shouldCache: thumbnailOpts.cache,
        timestamps: timestamps,
        cacheReadOnly: !thumbnailOpts.cache || isPlaying()
      }
      const thumbnails = await videoThumbnail(url, opts);
      settings.cache.update();

      if (thumbnails && thumbnails.length > 0) {
        thumbnails.forEach((thumbnail, i) => {
          if (thumbnail && thumbnail.URI && thumbnail.URI.length > 30) {
            node.style.setProperty(`--image-url-${i}`,`url('${thumbnail.URI}')`);
          }
        });

        return thumbnails[0];
      }
    }

    const createAnimationCSS = () => {
      const timestamps = [...app.options.thumbnails.timestamps];
      const n = (Array.isArray(timestamps) ? timestamps.length : 1);

      var animationRule = '@keyframes animateThumbnail {\r\n';
      const unit = (1 / (n - 1)) * 100;

      for (let i = 0; i < n; i++) {
        const percent = `${unit * i}%`;
        animationRule += `${percent} { background-image: var(--image-url-${i}); }\r\n`;
      }
      animationRule += '}';

      const style = $('style[primary]');
      style.sheet.insertRule(animationRule);

      setCSSVariableNumber('--thumbnail-timestamps', timestamps.length, $('html'));
    }

    const getTransitionDuration = () => {
      const styles = getComputedStyle($html);
      const rawDuration = styles.transitionDuration.toLowerCase();
      const reDuration = /([\d\.]+)(s|ms)+/;
      const parsed = reDuration.exec(rawDuration);

      const durationValue = parsed[1];
      const durationUnit = parsed[2];

      return (durationUnit === 's' ? durationValue * 1000 : durationValue);
    }

    // Third-party scripts
    // From: https://css-tricks.com/converting-color-spaces-in-javascript/
    const hexToHSL = (H) => {
        // Convert hex to RGB first
        let r = 0, g = 0, b = 0;
        if (H.length == 4) {
          r = "0x" + H[1] + H[1];
          g = "0x" + H[2] + H[2];
          b = "0x" + H[3] + H[3];
        } else if (H.length == 7) {
          r = "0x" + H[1] + H[2];
          g = "0x" + H[3] + H[4];
          b = "0x" + H[5] + H[6];
        }
        // Then to HSL
        r /= 255;
        g /= 255;
        b /= 255;
        let cmin = Math.min(r,g,b),
            cmax = Math.max(r,g,b),
            delta = cmax - cmin,
            h = 0,
            s = 0,
            l = 0;

        if (delta == 0)
          h = 0;
        else if (cmax == r)
          h = ((g - b) / delta) % 6;
        else if (cmax == g)
          h = (b - r) / delta + 2;
        else
          h = (r - g) / delta + 4;

        h = Math.round(h * 60);

        if (h < 0)
          h += 360;

        l = (cmax + cmin) / 2;
        s = delta == 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
        s = +(s * 100).toFixed(1);
        l = +(l * 100).toFixed(1);

        return { h, s, l};
      }

      // From: https://css-tricks.com/converting-color-spaces-in-javascript/
      const HSLToHex = (h, s, l) => {
        s /= 100;
        l /= 100;

        let c = (1 - Math.abs(2 * l - 1)) * s,
            x = c * (1 - Math.abs((h / 60) % 2 - 1)),
            m = l - c/2,
            r = 0,
            g = 0,
            b = 0;

        if (0 <= h && h < 60) {
          r = c; g = x; b = 0;
        } else if (60 <= h && h < 120) {
          r = x; g = c; b = 0;
        } else if (120 <= h && h < 180) {
          r = 0; g = c; b = x;
        } else if (180 <= h && h < 240) {
          r = 0; g = x; b = c;
        } else if (240 <= h && h < 300) {
          r = x; g = 0; b = c;
        } else if (300 <= h && h < 360) {
          r = c; g = 0; b = x;
        }
        // Having obtained RGB, convert channels to hex
        r = Math.round((r + m) * 255).toString(16);
        g = Math.round((g + m) * 255).toString(16);
        b = Math.round((b + m) * 255).toString(16);

        // Prepend 0s, if necessary
        if (r.length == 1)
          r = "0" + r;
        if (g.length == 1)
          g = "0" + g;
        if (b.length == 1)
          b = "0" + b;

        return "#" + r + g + b;
      }

    // main()
    const main = async () => {
      setupControls();
      renderSettingsControls();
      createAnimationCSS();
      updateVersionNumber();
      checkFileHandlerOpen();

      const hash = getHash();

      if (hash) {
        if (hash.media && hash.media.length > 1 && !hash.media.startsWith('blob:')) {
          $player.muted = true; /* Autoplay on load only works if it is muted */
          actionPlay(hash.media);
        }

        if (hash.time && hash.time > 0) $player.currentTime = hash.time;

        if (hash.location && hash.location.length > 1) {
          hashState.location = hash.location;
          createLinks(hash.location);
        } else {
          createLinks();
        }
      }

      $(window).on('popstate', (e) => {
        const hash = getHash();
        if (hash && hash.location && hash.location.length > 1) createLinks(hash.location)
      });
    }

    main();
  
