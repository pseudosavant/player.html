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
    const $playlist = $('.playlist');
    const $currentTimestamp = $('.current-timestamp');

    const isDebug = () => !!(app && app.options && app.options.debug);
    const logInfo = (...args) => { if (isDebug()) console.info(...args); }

    const escapeHtml = (value) => {
      if (value === null || typeof value === 'undefined') return '';
      const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      };
      return String(value).replace(/[&<>"']/g, (c) => map[c]);
    }

    const escapeAttr = (value) => escapeHtml(value);

    const escapeCssUrl = (value) => {
      if (value === null || typeof value === 'undefined') return '';
      return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    }

    const setAriaPressed = (selector, pressed) => {
      const $el = $(selector);
      if ($el) $el.attr('aria-pressed', pressed ? 'true' : 'false');
    }

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
        { mime: 'audio/mp4',        extensions: ['m4a'] },
        { mime: 'audio/ogg',        extensions: ['ogg'] },
        { mime: 'audio/x-matroska', extensions: ['mka'] },
        { mime: 'audio/matroska',   extensions: ['mka'] }
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

    app.options.supportedTypes = getSupportedTypes();
    logInfo(`Supported mime-types: ${app.options.supportedTypes.mime.join(', ')}`);

    const hashState = { location: '', media: '', subtitle: '' };
    app.playlist = [];
    app.playlistIndex = -1;
    app.playlistLoop = true;
    const playlistStorageKey = 'playlist-saved';

    const urlToFolder = (url) => {
      if (isFolder(url)) return url;

      var pieces = url.split('/'); // Break the URL into pieces
      pieces.pop(); // Remove the last piece (the filename)
      return pieces.join('/') + '/'; // Put it back together with a trailing /
    }

    const getParentFolder = (url) => {
      try {
        const base = urlToFolder(url);
        const parentUrl = new URL('../', base).toString();
        return (parentUrl === base ? undefined : parentUrl);
      } catch (e) {
        return undefined;
      }
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

    const removeFileExtension = (s) => {
      const supportedMediaExtensions = app.options.supportedTypes.extensions.join('|');
      const re = new RegExp(`\\.+(${supportedMediaExtensions})+$`, 'i');
      return s.replace(re, '');
    }

    const stripUrlExtension = (url) => {
      if (!isString(url)) return '';
      const clean = url.split('#')[0].split('?')[0];
      const match = /^(.*)(?:\.[^./]+)$/.exec(clean);
      return match ? match[1] : clean;
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
      const re = /(?:\/)((?:[^/])+\.(?:wav|mp3|aac|m4a|mka|ogg))/gi
      return re.test(url);
    }

    const isImage = (url) => {
      const re = /(?:\/)((?:[^/])+\.(?:png|jpeg|jpg|gif|webp))/gi
      return re.test(url);
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
      hashState.location = folder;
      const links = await folderApiRequest(folder);

      if (Array.isArray(links.folders)) {
        links.folders = links.folders.filter((item) => !(item && item.role === 'self'));
      }

      const parentUrl = getParentFolder(folder);
      if (parentUrl && Array.isArray(links.folders)) {
        const hasParent = links.folders.some((item) => (
          item &&
          (item.role === 'parent' || item.type === 'parent' || item.url === parentUrl || item.url === '../')
        ));
        if (!hasParent) {
          links.folders.unshift({ url: parentUrl, role: 'parent', name: 'Parent' });
        }
      }

      const oldLinksHash = linksHash(app.links);
      const newLinksHash = linksHash(links);

      app.links = links;

      // Only show the links if they have changed
      if (oldLinksHash !== newLinksHash) showLinks(links);
    }
    const createLinksSafe = async (url) => {
      try {
        await createLinks(url);
      } catch (e) {
        console.warn('Unable to load folder links', e);
      }
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
        const optClasses = ((folder.role || folder.type) === 'parent' ? 'parent' : '');

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
      if (!$el) return;

      const eventPath = (e.composedPath ? e.composedPath() : [e.target]);
      const addButtonClicked = eventPath.some((el) => el.classList && el.classList.contains('btn-add-to-playlist'));
      if (addButtonClicked && $el) {
        e.stopImmediatePropagation();
        if ($el.hasClass('file')) {
          addToPlaylist($el.href, isPlaybackStopped());
        } else if ($el.hasClass('folder')) {
          addFolderToPlaylist($el.href, { shouldPlay: isPlaybackStopped() });
        }
        return;
      }

      if ($el.hasClass('file')) setPlaylistFromUrl($el.href, true);
      if ($el.hasClass('folder')) {
        hashState.location = $el.href;
        clearThumbnailQueue();
        createLinks($el.href);
        updateHash({ push: true });
        return;
      }

      updateHash();
    }

    const createFileTemplate = (url, label, optionalClasses = '', preRenderedThumbnailUrl = '' ) => {
      const escapedUrl = escapeAttr(url);
      const safeLabel = escapeHtml(label);
      const safeTitle = escapeAttr(`Play ${url}`);
      const styleValue = preRenderedThumbnailUrl
        ? `--image-url-0: url('${escapeCssUrl(preRenderedThumbnailUrl)}')`
        : '';
      const safeStyle = escapeAttr(styleValue);
      const isAudioClass = (isAudio(url) ? 'audio-file' : '');

      return `<a href='${escapedUrl}' class='file ${isAudioClass} ${optionalClasses}' title='${safeTitle}' style='${safeStyle}' draggable='false'>
                <div class='title' draggable='false'>
                  <span class='label'>${safeLabel}</span>
                  <button class='btn-add-to-playlist' type='button' title='Add to playlist' aria-label='Add to playlist'>
                    <svg><use xlink:href='#svg-playlist-add'/></svg>
                  </button>
                </div>
                <div class='arrow' draggable='false'>
                  <svg><use xlink:href='#svg-play'/></svg>
                </div>
              </a>`;
    }

    const createFolderTemplate = (url, label, optionalClasses = '') => {
      const escapedUrl = escapeAttr(url);
      const safeLabel = escapeHtml(label);
      const safeTitle = escapeAttr(`Navigate to ${url}`);
      const isParent = optionalClasses.split(' ').includes('parent');
      const addButton = (isParent ? '' : `
                  <button class='btn-add-to-playlist' type='button' title='Add folder to playlist' aria-label='Add folder to playlist'>
                    <svg><use xlink:href='#svg-playlist-add'/></svg>
                  </button>`);

      return `<a href='${escapedUrl}' class='folder ${optionalClasses}' draggable='false' title='${safeTitle}'>
                <div class='title' draggable='false'>
                  <span class='folder-label'>
                    <svg class='icon'><use xlink:href='#svg-folder-arrow'/></svg>
                    <span class="label">${safeLabel}</span>
                  </span>
                  ${addButton}
                </div>
                <div class='arrow' draggable='false'>
                  <svg class='open'><use xlink:href='#svg-folder-open'/></svg>
                  <svg class='closed'><use xlink:href='#svg-folder-closed'/></svg>
                </div>
              </a>`;
    }

    const playlistItemFromUrl = (url) => {
      const label = urlToLabel(url);
      return { url, label: (label ? label : urlToFilename(url)) };
    }

    const updatePlaylistLoop = () => {
      if (app.playlistLoop) {
        $body.removeClass('playlist-loop-off');
      } else {
        $body.addClass('playlist-loop-off');
      }
      setAriaPressed('.btn-loop', app.playlistLoop);
    }

    const togglePlaylistLoop = () => {
      app.playlistLoop = !app.playlistLoop;
      updatePlaylistLoop();
    }

    const getPlaylistCurrentIndex = () => {
      if (!Array.isArray(app.playlist) || app.playlist.length === 0) return -1;
      if (
        app.playlistIndex >= 0 &&
        app.playlistIndex < app.playlist.length &&
        (!$player.src || app.playlist[app.playlistIndex].url === $player.src)
      ) {
        return app.playlistIndex;
      }
      if (!$player.src) return -1;
      return app.playlist.findIndex((item) => item.url === $player.src);
    }

    const syncPlaylistCurrent = () => {
      const index = getPlaylistCurrentIndex();
      app.playlistIndex = index;
      renderPlaylist();
    }

    const setPlaylistFromItem = (item, shouldPlay = true) => {
      if (!item || !item.url) return;
      app.playlist = [item];
      app.playlistIndex = 0;
      renderPlaylist();
      if (shouldPlay) actionPlay(item.url);
    }

    const setPlaylistFromUrl = (url, shouldPlay = true) => {
      if (!url) return;
      setPlaylistFromItem(playlistItemFromUrl(url), shouldPlay);
    }

    const setPlaylistFromUrls = (urls) => {
      app.playlist = (Array.isArray(urls) ? urls.map(playlistItemFromUrl) : []);
      app.playlistIndex = app.playlist.findIndex((item) => item.url === $player.src);
      renderPlaylist();
    }

    const getMediaUrlsFromLinks = (links) => {
      if (!links || !Array.isArray(links.files)) return [];
      const medias = links.files.filter((file) => isMedia(file.url));
      medias.sort(sortFiles);
      return medias.map((file) => file.url);
    }

    const isAbortError = (e) => {
      if (!e) return false;
      if (e.name === 'AbortError' || e.code === 20) return true;
      if (isString(e) && e.includes('BodyStreamBuffer was aborted')) return true;
      if (isString(e?.message) && e.message.includes('BodyStreamBuffer was aborted')) return true;
      return false;
    }

    const normalizePlaylistFolderDepth = (value, fallback = 2) => {
      const parsed = parseInt(value, 10);
      if (!Number.isFinite(parsed)) return fallback;
      return Math.min(3, Math.max(1, Math.floor(parsed)));
    }
    const getPlaylistFolderDepthDefault = () => normalizePlaylistFolderDepth(getOptionSettingDefault('playlist-depth', 2), 2);
    const getPlaylistFolderDepth = () => normalizePlaylistFolderDepth(retrieveSetting('playlist-depth'), getPlaylistFolderDepthDefault());

    const playerConfigFilename = 'player.html.json';

    const isObjectRecord = (value) => (value && typeof value === 'object' && !Array.isArray(value));
    const getOptionSettingsDefaults = () => (
      isObjectRecord(app && app.options && app.options.settings)
        ? app.options.settings
        : {}
    );
    const getOptionSettingDefault = (key, fallback) => {
      const defaults = getOptionSettingsDefaults();
      if (Object.prototype.hasOwnProperty.call(defaults, key)) return defaults[key];
      return fallback;
    }
    const normalizeBooleanSetting = (value, fallback) => {
      if (value === true || value === false) return value;
      if (value === 'true') return true;
      if (value === 'false') return false;
      return fallback;
    }
    const normalizeNumberSetting = (value, fallback) => {
      const parsed = Number(value);
      return (Number.isFinite(parsed) ? parsed : fallback);
    }
    const deepMergeObjects = (target, source) => {
      if (!isObjectRecord(target) || !isObjectRecord(source)) return target;
      Object.keys(source).forEach((key) => {
        const src = source[key];
        const dst = target[key];
        if (isObjectRecord(src) && isObjectRecord(dst)) {
          deepMergeObjects(dst, src);
        } else {
          target[key] = src;
        }
      });
      return target;
    }
    const deepCloneValue = (value) => {
      if (Array.isArray(value)) return value.map((item) => deepCloneValue(item));
      if (isObjectRecord(value)) {
        const clone = {};
        Object.keys(value).forEach((key) => clone[key] = deepCloneValue(value[key]));
        return clone;
      }
      return value;
    }
    const normalizeConfigSubtitleSettings = (source) => {
      if (!isObjectRecord(source)) return source;
      if (!isObjectRecord(source.settings)) source.settings = {};

      const subtitles = (isObjectRecord(source.subtitles) ? source.subtitles : null);
      if (!subtitles) return source;

      if (Object.prototype.hasOwnProperty.call(subtitles, 'autoMatch') && typeof source.settings['auto-subtitles'] === 'undefined') {
        source.settings['auto-subtitles'] = subtitles.autoMatch;
      }
      if (Object.prototype.hasOwnProperty.call(subtitles, 'font') && typeof source.settings['subtitle-font'] === 'undefined') {
        source.settings['subtitle-font'] = subtitles.font;
      }
      if (Object.prototype.hasOwnProperty.call(subtitles, 'size') && typeof source.settings['subtitle-size'] === 'undefined') {
        source.settings['subtitle-size'] = subtitles.size;
      }
      if (Object.prototype.hasOwnProperty.call(subtitles, 'position') && typeof source.settings['subtitle-position'] === 'undefined') {
        source.settings['subtitle-position'] = subtitles.position;
      }
      if (Object.prototype.hasOwnProperty.call(subtitles, 'color') && typeof source.settings['subtitle-color'] === 'undefined') {
        source.settings['subtitle-color'] = subtitles.color;
      }
      if (Object.prototype.hasOwnProperty.call(subtitles, 'background') && typeof source.settings['subtitle-background'] === 'undefined') {
        source.settings['subtitle-background'] = subtitles.background;
      }

      return source;
    }
    const applyPlayerConfigObject = (config) => {
      if (!isObjectRecord(config)) return false;
      const source = normalizeConfigSubtitleSettings(
        isObjectRecord(config.options) ? config.options : config
      );
      if (!isObjectRecord(source)) return false;
      deepMergeObjects(app.options, source);
      if (!isObjectRecord(app.options.settings)) app.options.settings = {};
      return true;
    }
    const loadPlayerConfig = async () => {
      try {
        const response = await fetch(playerConfigFilename, { cache: 'no-store' });
        if (!response || !response.ok) return false;
        const text = await response.text();
        if (!text || !text.trim()) return false;
        let parsed;
        try {
          parsed = JSON.parse(text);
        } catch (e) {
          console.warn(`Unable to parse ${playerConfigFilename}`, e);
          return false;
        }
        return applyPlayerConfigObject(parsed);
      } catch (e) {
        return false;
      }
    }
    const downloadJSON = (filename, data) => {
      const json = `${JSON.stringify(data, null, 2)}\n`;
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const $a = $('<a>');
      $a.attr('href', url);
      $a.attr('download', filename);
      $('body').append($a);
      $a.click();
      $($a).remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    const subtitleFontFallback = 'sans';
    const subtitleSizeFallback = '100%';
    const subtitlePositionFallback = 'author';
    const subtitleColorFallback = '#ffffff';
    const subtitleBackgroundFallback = '#000000';

    const subtitleFontOptions = [
      { value: 'sans', label: 'Sans' },
      { value: 'serif', label: 'Serif' },
      { value: 'mono', label: 'Monospace' },
      { value: 'casual', label: 'Casual' }
    ];
    const subtitleSizeOptions = [
      { value: '50%', label: '50%' },
      { value: '75%', label: '75%' },
      { value: '100%', label: '100%' },
      { value: '150%', label: '150%' },
      { value: '200%', label: '200%' }
    ];
    const subtitlePositionOptions = [
      { value: 'author', label: 'Author default' },
      { value: 90, label: 'Bottom' },
      { value: 75, label: 'Lower-middle' },
      { value: 60, label: 'Middle' },
      { value: 35, label: 'Upper-middle' },
      { value: 20, label: 'Top' }
    ];

    const subtitleFontValues = subtitleFontOptions.map((opt) => opt.value);
    const subtitleSizeValues = subtitleSizeOptions.map((opt) => opt.value);
    const subtitleSizeMinPercent = 25;
    const subtitleSizeMaxPercent = 400;
    const subtitleSizeLegacyMap = {
      small: '75%',
      medium: '100%',
      large: '100%',
      xlarge: '150%',
      '90%': '75%',
      '120%': '100%',
      '140%': '150%'
    };
    const subtitlePositionValues = subtitlePositionOptions
      .map((opt) => opt.value)
      .filter((value) => value !== 'author');

    const normalizeSubtitleFont = (value, fallback = subtitleFontFallback) => {
      const normalized = String(value || '').toLowerCase();
      return (subtitleFontValues.includes(normalized) ? normalized : fallback);
    }
    const normalizeSubtitleSize = (value, fallback = subtitleSizeFallback) => {
      const normalized = String(value || '').trim().toLowerCase();
      if (Object.prototype.hasOwnProperty.call(subtitleSizeLegacyMap, normalized)) {
        return subtitleSizeLegacyMap[normalized];
      }
      if (subtitleSizeValues.includes(normalized)) return normalized;

      const match = normalized.match(/^(\d+(?:\.\d+)?)%$/);
      if (!match) return fallback;

      const parsed = parseFloat(match[1]);
      if (!Number.isFinite(parsed)) return fallback;

      const clamped = Math.max(subtitleSizeMinPercent, Math.min(subtitleSizeMaxPercent, parsed));
      const rounded = Math.round(clamped * 100) / 100;
      return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded}%`;
    }
    const normalizeSubtitlePosition = (value, fallback = subtitlePositionFallback) => {
      const normalized = String(value || '').toLowerCase();
      if (normalized === 'author') return 'author';
      const parsed = parseFloat(value);
      if (!Number.isFinite(parsed)) return fallback;
      return (subtitlePositionValues.includes(parsed) ? parsed : fallback);
    }
    const normalizeSubtitleColor = (value, fallback = subtitleColorFallback) => {
      const str = String(value || '').trim();
      if (/^#[0-9a-f]{6}$/i.test(str) || /^#[0-9a-f]{3}$/i.test(str)) return str;
      return fallback;
    }
    const getOptionSubtitleDefault = (subtitleKey, settingKey, fallback) => {
      const fromSettings = getOptionSettingDefault(settingKey, undefined);
      if (typeof fromSettings !== 'undefined') return fromSettings;
      if (
        app &&
        app.options &&
        isObjectRecord(app.options.subtitles) &&
        Object.prototype.hasOwnProperty.call(app.options.subtitles, subtitleKey)
      ) {
        return app.options.subtitles[subtitleKey];
      }
      return fallback;
    }
    const getSubtitleFontDefault = () => normalizeSubtitleFont(
      getOptionSubtitleDefault('font', 'subtitle-font', subtitleFontFallback),
      subtitleFontFallback
    );
    const getSubtitleSizeDefault = () => normalizeSubtitleSize(
      getOptionSubtitleDefault('size', 'subtitle-size', subtitleSizeFallback),
      subtitleSizeFallback
    );
    const getSubtitlePositionDefault = () => normalizeSubtitlePosition(
      getOptionSubtitleDefault('position', 'subtitle-position', subtitlePositionFallback),
      subtitlePositionFallback
    );
    const getSubtitleColorDefault = () => normalizeSubtitleColor(
      getOptionSubtitleDefault('color', 'subtitle-color', subtitleColorFallback),
      subtitleColorFallback
    );
    const getSubtitleBackgroundDefault = () => normalizeSubtitleColor(
      getOptionSubtitleDefault('background', 'subtitle-background', subtitleBackgroundFallback),
      subtitleBackgroundFallback
    );
    const subtitleFontToFamily = (value) => {
      switch (normalizeSubtitleFont(value)) {
        case 'serif':
          return "Georgia, 'Times New Roman', serif";
        case 'mono':
          return "'Courier New', Consolas, monospace";
        case 'casual':
          return "'Trebuchet MS', 'Segoe UI', Arial, sans-serif";
        default:
          return "system-ui, 'Segoe UI', Calibri, Arial, Helvetica, sans-serif";
      }
    }
    const subtitleSizeToScale = (value) => parseFloat(normalizeSubtitleSize(value, subtitleSizeFallback)) / 100;

    const addPlaylistItems = (urls, shouldPlay = false) => {
      if (!Array.isArray(urls)) return;
      const items = urls
        .filter((url) => isString(url) && url.length > 0)
        .map(playlistItemFromUrl)
        .filter((item) => item && item.url);
      if (items.length === 0) return;
      app.playlist.push(...items);
      if (shouldPlay) {
        actionPlay(items[0].url);
      } else {
        renderPlaylist();
      }
    }

    const isPlaybackStopped = () => (!$player.src || $player.src.length === 0 || $body.hasClass('is-stopped'));

    const addToPlaylist = (url, shouldPlay = false) => {
      if (!url) return;
      addPlaylistItems([url], shouldPlay);
    }

    const addFolderToPlaylist = async (url, opts = {}) => {
      if (!url) return;
      const shouldPlay = !!opts.shouldPlay;
      const depth = (Number.isFinite(opts.depth) ? opts.depth : getPlaylistFolderDepth());
      const maxDepth = Math.max(0, normalizePlaylistFolderDepth(depth) - 1);

      try {
        const links = await folderApiRequest(urlToFolder(url), { maxDepth });
        const urls = getMediaUrlsFromLinks(links);
        addPlaylistItems(urls, shouldPlay);
      } catch (e) {
        console.warn('Unable to add folder to playlist', e);
      }
    }

    const addCurrentFolderToPlaylist = () => {
      const depth = getPlaylistFolderDepth();
      if (depth <= 1) {
        const urls = getMediaUrlsFromLinks(app.links);
        addPlaylistItems(urls, isPlaybackStopped());
        return;
      }
      const baseUrl = (hashState.location && hashState.location.length > 0)
        ? hashState.location
        : window.location.href;
      addFolderToPlaylist(baseUrl, { shouldPlay: isPlaybackStopped(), depth });
    }

    const hasMultiPlaylist = () => Array.isArray(app.playlist) && app.playlist.length > 1;

    const updatePlaylistMultiState = () => {
      if (hasMultiPlaylist()) {
        $body.addClass('playlist-multiple');
      } else {
        $body.removeClass('playlist-multiple');
      }
    }

    const clearPlaylist = () => {
      app.playlist = [];
      app.playlistIndex = -1;
      renderPlaylist();
    }

    const playPlaylistIndex = (index) => {
      if (!Array.isArray(app.playlist) || app.playlist.length === 0) return;
      if (index < 0 || index >= app.playlist.length) return;
      app.playlistIndex = index;
      actionPlay(app.playlist[index].url);
      renderPlaylist();
    }

    const advancePlaylist = (reason) => {
      if (!Array.isArray(app.playlist) || app.playlist.length === 0) return;

      const currentIndex = getPlaylistCurrentIndex();
      if (currentIndex < 0) return;

      var nextIndex = currentIndex + 1;

      if (nextIndex >= app.playlist.length) {
        if (!app.playlistLoop) {
          if (reason === 'error') actionStop();
          return;
        }
        nextIndex = 0;
      }

      if (nextIndex === currentIndex) {
        if (reason === 'ended' && app.playlistLoop) {
          playPlaylistIndex(nextIndex);
        } else if (reason === 'error') {
          actionStop();
        }
        return;
      }

      playPlaylistIndex(nextIndex);
    }

    const playNextTrack = () => {
      if (!hasMultiPlaylist()) return;
      const currentIndex = getPlaylistCurrentIndex();
      if (currentIndex < 0) return;
      var nextIndex = currentIndex + 1;
      if (nextIndex >= app.playlist.length) {
        if (!app.playlistLoop) return;
        nextIndex = 0;
      }
      playPlaylistIndex(nextIndex);
    }

    const playPreviousTrack = () => {
      if (!hasMultiPlaylist()) return;
      const currentIndex = getPlaylistCurrentIndex();
      if (currentIndex < 0) return;
      var prevIndex = currentIndex - 1;
      if (prevIndex < 0) {
        if (!app.playlistLoop) return;
        prevIndex = app.playlist.length - 1;
      }
      playPlaylistIndex(prevIndex);
    }

    const removePlaylistItem = (index) => {
      if (!Array.isArray(app.playlist) || app.playlist.length === 0) return;
      if (index < 0 || index >= app.playlist.length) return;

      const wasCurrent = index === app.playlistIndex;
      app.playlist.splice(index, 1);

      if (app.playlist.length === 0) {
        app.playlistIndex = -1;
        actionStop();
        renderPlaylist();
        return;
      }

      if (wasCurrent) {
        const nextIndex = (index >= app.playlist.length ? 0 : index);
        app.playlistIndex = nextIndex;
        if (!app.playlistLoop && index >= app.playlist.length) {
          actionStop();
        } else {
          actionPlay(app.playlist[nextIndex].url);
        }
      } else if (index < app.playlistIndex) {
        app.playlistIndex -= 1;
      }

      renderPlaylist();
    }

    const swapPlaylistItems = (from, to) => {
      if (!Array.isArray(app.playlist) || app.playlist.length === 0) return;
      if (to < 0 || to >= app.playlist.length) return;

      const items = app.playlist;
      const swap = items[from];
      items[from] = items[to];
      items[to] = swap;

      if (app.playlistIndex === from) {
        app.playlistIndex = to;
      } else if (app.playlistIndex === to) {
        app.playlistIndex = from;
      }

      renderPlaylist();
    }

    const parseM3U = (text, baseUrl) => {
      if (!text) return [];
      const lines = text.split(/\r?\n/);
      const urls = [];

      lines.forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        try {
          const resolved = new URL(trimmed, baseUrl).toString();
          urls.push(resolved);
        } catch (e) { }
      });

      return urls;
    }

    const importPlaylistFromUrl = async () => {
      const input = prompt('Enter an M3U URL');
      if (!input) return;

      var url;
      try {
        url = new URL(input, window.location.href).toString();
      } catch (e) {
        console.warn('Invalid playlist URL');
        return;
      }

      try {
        const res = await fetch(url);
        const text = await res.text();
        const urls = parseM3U(text, url);
        setPlaylistFromUrls(urls);
      } catch (e) {
        console.warn('Unable to import playlist', e);
      }
    }

    const importPlaylistFromFile = () => {
      const $input = $(`<input type="file" accept=".m3u,.m3u8,text/plain"/>`);
      $input.on('change', async () => {
        const file = $input.files[0];
        if (!file) return;
        const text = await file.text();
        const base = urlToFolder(window.location.href);
        const urls = parseM3U(text, base);
        setPlaylistFromUrls(urls);
      });
      $input.click();
    }

    const exportPlaylist = () => {
      if (!Array.isArray(app.playlist) || app.playlist.length === 0) return;
      const lines = ['#EXTM3U', ...app.playlist.map((item) => item.url)];
      const blob = new Blob([lines.join('\n')], { type: 'audio/x-mpegurl' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'playlist.m3u';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 0);
    }

    const savePlaylistToStorage = () => {
      if (!Array.isArray(app.playlist) || app.playlist.length === 0) {
        storageRemove(playlistStorageKey);
        return;
      }
      const urls = app.playlist.map((item) => item.url);
      storageStore(playlistStorageKey, JSON.stringify(urls));
    }

    const getPlaylistState = () => {
      if (!Array.isArray(app.playlist) || app.playlist.length === 0) return undefined;
      const urls = app.playlist
        .map((item) => item.url)
        .filter((url) => isString(url));
      if (urls.length === 0) return undefined;
      const index = getPlaylistCurrentIndex();
      return { urls, index };
    }

    const applyPlaylistState = (payload) => {
      const urls = (payload && Array.isArray(payload.urls) ? payload.urls : []);
      const filtered = urls.filter((url) => isString(url));
      if (filtered.length === 0) return false;
      app.playlist = filtered.map(playlistItemFromUrl);
      const index = (Number.isFinite(payload.index) ? payload.index : -1);
      app.playlistIndex = (index >= 0 && index < app.playlist.length ? index : -1);
      renderPlaylist();
      return true;
    }

    const restorePlaylistFromStorage = () => {
      const saved = storageRetrieve(playlistStorageKey);
      if (!saved) return;
      try {
        const urls = JSON.parse(saved);
        if (!Array.isArray(urls)) return;
        const filtered = urls.filter((url) => isString(url));
        if (filtered.length === 0) return;
        setPlaylistFromUrls(filtered);
      } catch (e) {
        console.warn('Unable to restore playlist', e);
      }
    }

    const renderPlaylist = () => {
      if (!$playlist) return;
      const currentIndex = getPlaylistCurrentIndex();
      app.playlistIndex = currentIndex;
      updatePlaylistMultiState();

      var html = `
        <li class='modal-item playlist-controls'>
          <button class='btn-playlist-import-url' type='button' title='Import playlist from URL (requires CORS support)'>
            <svg><use xlink:href='#svg-import'/></svg>
            <span>Import URL</span>
          </button>
          <button class='btn-playlist-import-file' type='button' title='Import playlist file'>
            <svg><use xlink:href='#svg-import'/></svg>
            <span>Import File</span>
          </button>
          <button class='btn-playlist-restore' type='button' title='Restore playlist from localStorage'>
            <svg><use xlink:href='#svg-import'/></svg>
            <span>Restore</span>
          </button>
          <button class='btn-playlist-save' type='button' title='Save playlist to localStorage'>
            <svg><use xlink:href='#svg-save'/></svg>
            <span>Save</span>
          </button>
          <button class='btn-playlist-export' type='button' title='Export playlist'>
            <svg><use xlink:href='#svg-download'/></svg>
            <span>Export</span>
          </button>
          <button class='btn-playlist-add-folder' type='button' title='Add all files from current folder view'>
            <svg><use xlink:href='#svg-playlist-add'/></svg>
            <span>Add All</span>
          </button>
          <button class='btn-playlist-clear' type='button' title='Clear playlist'>Clear</button>
        </li>
      `;

      if (!Array.isArray(app.playlist) || app.playlist.length === 0) {
        html += `<li class='modal-item playlist-empty'>Playlist is empty</li>`;
      } else {
        app.playlist.forEach((item, index) => {
          const isCurrent = (index === currentIndex ? 'current' : '');
          const safeTitle = escapeAttr(item.url);
          const safeLabel = escapeHtml(item.label);
          html += `
            <li class='modal-item playlist-item ${isCurrent}' data-index='${index}' title='${safeTitle}'>
              <span class='playlist-label'>${safeLabel}</span>
              <span class='playlist-actions'>
                <button class='btn-playlist-up' type='button' title='Move up' aria-label='Move up'><svg><use xlink:href='#svg-caret-up'/></svg></button>
                <button class='btn-playlist-down' type='button' title='Move down' aria-label='Move down'><svg><use xlink:href='#svg-caret-down'/></svg></button>
                <button class='btn-playlist-remove' type='button' title='Remove from playlist' aria-label='Remove from playlist'><svg><use xlink:href='#svg-playlist-remove'/></svg></button>
              </span>
            </li>
          `;
        });
      }

      $playlist.html(html);

      const stopClose = (e) => e.stopImmediatePropagation();

      const importUrlButton = $playlist.querySelector('.btn-playlist-import-url');
      if (importUrlButton) {
        importUrlButton.addEventListener('click', (e) => {
          stopClose(e);
          importPlaylistFromUrl();
        });
      }

      const importFileButton = $playlist.querySelector('.btn-playlist-import-file');
      if (importFileButton) {
        importFileButton.addEventListener('click', (e) => {
          stopClose(e);
          importPlaylistFromFile();
        });
      }

      const exportButton = $playlist.querySelector('.btn-playlist-export');
      if (exportButton) {
        exportButton.addEventListener('click', (e) => {
          stopClose(e);
          exportPlaylist();
        });
      }

      const addFolderButton = $playlist.querySelector('.btn-playlist-add-folder');
      if (addFolderButton) {
        addFolderButton.addEventListener('click', (e) => {
          stopClose(e);
          addCurrentFolderToPlaylist();
        });
      }

      const restoreButton = $playlist.querySelector('.btn-playlist-restore');
      if (restoreButton) {
        restoreButton.addEventListener('click', (e) => {
          stopClose(e);
          restorePlaylistFromStorage();
        });
      }

      const saveButton = $playlist.querySelector('.btn-playlist-save');
      if (saveButton) {
        saveButton.addEventListener('click', (e) => {
          stopClose(e);
          savePlaylistToStorage();
        });
      }

      const clearButton = $playlist.querySelector('.btn-playlist-clear');
      if (clearButton) {
        clearButton.addEventListener('click', (e) => {
          stopClose(e);
          clearPlaylist();
        });
      }

      const items = [...$playlist.querySelectorAll('.playlist-item')];
      items.forEach((item) => {
        item.addEventListener('click', (e) => {
          stopClose(e);
          const index = parseInt(item.dataset.index, 10);
          playPlaylistIndex(index);
        });

        const up = item.querySelector('.btn-playlist-up');
        if (up) up.addEventListener('click', (e) => {
          stopClose(e);
          const index = parseInt(item.dataset.index, 10);
          swapPlaylistItems(index, index - 1);
        });

        const down = item.querySelector('.btn-playlist-down');
        if (down) down.addEventListener('click', (e) => {
          stopClose(e);
          const index = parseInt(item.dataset.index, 10);
          swapPlaylistItems(index, index + 1);
        });

        const remove = item.querySelector('.btn-playlist-remove');
        if (remove) remove.addEventListener('click', (e) => {
          stopClose(e);
          const index = parseInt(item.dataset.index, 10);
          removePlaylistItem(index);
        });
      });
    }

    var audioThumbnailQueue = [];
    var videoThumbnailQueue = [];
    var audioThumbnailProcessing = false;
    var videoThumbnailProcessing = false;
    var thumbnailObserver;
    const populateThumbnails = async () => {
      if (retrieveSetting('thumbnailing') === false) return;
      const $files = [...document.querySelectorAll('.file')];
      setupThumbnailObserver($files);
    }

    const enqueueThumbnail = ($file) => {
      if (!$file) return;
      if ($file.dataset.thumbnailQueued === 'true' || $file.dataset.thumbnailDone === 'true') return;
      if (hasPreRenderedThumbnail($file)) {
        $file.dataset.thumbnailDone = 'true';
        return;
      }

      $file.dataset.thumbnailQueued = 'true';
      if (isAudio($file.href)) {
        audioThumbnailQueue.push({$file, url: $file.href});
      } else {
        videoThumbnailQueue.push({$file, url: $file.href});
      }
      processThumbnailQueue();
    }

    const processThumbnailQueue = () => {
      processVideoThumbnailQueue();
      processAudioThumbnailQueue();
    }

    const processVideoThumbnailQueue = async () => {
      if (videoThumbnailProcessing) return;
      videoThumbnailProcessing = true;
      const concurrency = Math.max(1, app.options.thumbnails.concurrency || 1);

      while (videoThumbnailQueue.length > 0) {
        const batch = videoThumbnailQueue.splice(0, concurrency);
        await Promise.all(batch.map(async (work) => {
          await setThumbnail(work.$file, work.url);
          work.$file.dataset.thumbnailDone = 'true';
        }));
      }

      videoThumbnailProcessing = false;
    }

    const processAudioThumbnailQueue = async () => {
      if (audioThumbnailProcessing) return;
      audioThumbnailProcessing = true;
      const audioOpts = app.options.audioThumbnails || {};
      const concurrency = Math.max(1, audioOpts.concurrency || 1);

      while (audioThumbnailQueue.length > 0) {
        const batch = audioThumbnailQueue.splice(0, concurrency);
        await Promise.all(batch.map(async (work) => {
          await setThumbnail(work.$file, work.url);
          work.$file.dataset.thumbnailDone = 'true';
        }));
      }

      audioThumbnailProcessing = false;
    }

    const setupThumbnailObserver = ($files) => {
      if (thumbnailObserver) thumbnailObserver.disconnect();

      if (!('IntersectionObserver' in window)) {
        $files.forEach(enqueueThumbnail);
        return;
      }

      thumbnailObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting && entry.intersectionRatio === 0) return;
          const $file = entry.target;
          if (thumbnailObserver) thumbnailObserver.unobserve($file);
          enqueueThumbnail($file);
        });
      }, { root: null, rootMargin: '200px 0px', threshold: 0.1 });

      $files.forEach(($file) => {
        if ($file.dataset.thumbnailQueued === 'true' || $file.dataset.thumbnailDone === 'true') return;
        if (hasPreRenderedThumbnail($file)) {
          $file.dataset.thumbnailDone = 'true';
          return;
        }
        thumbnailObserver.observe($file);
      });
    }

    const clearThumbnailQueue = () => {
      audioThumbnailQueue = [];
      videoThumbnailQueue = [];
      if (thumbnailObserver) thumbnailObserver.disconnect();
    }

    const getMediaDuration = () => {
      const duration = $player.duration;
      if (Number.isFinite(duration)) return duration;
      if ($player.seekable && $player.seekable.length > 0) {
        return $player.seekable.end($player.seekable.length - 1);
      }
      return 0;
    }

    const getRelativePosition = () => $player.currentTime / getMediaDuration() || 0;
    const getProgressBarWidth = () => $progressBar.offsetWidth;
    const updateProgressBarAria = () => {
      const duration = getMediaDuration();
      const current = (Number.isFinite($player.currentTime) ? $player.currentTime : 0);
      const max = (duration && Number.isFinite(duration) ? duration : 0);
      $progressBar.attr('aria-valuemin', '0');
      $progressBar.attr('aria-valuemax', `${Math.floor(max)}`);
      $progressBar.attr('aria-valuenow', `${Math.floor(current)}`);
      $progressBar.attr('aria-valuetext', `${secondsToString(current)} of ${secondsToString(max)}`);
      $progressBar.attr('aria-disabled', max > 0 ? 'false' : 'true');
    }

    const getState = () => {
      const location = hashState.location;
      const media = getMediaUrl();
      const time = $player.currentTime;
      const playlist = getPlaylistState();
      const state = { location, media, time };
      if (hashState.subtitle) state.subtitle = hashState.subtitle;
      if (playlist) state.playlist = playlist;

      return state;
    }

    const getBaseLocation = (l) => l.protocol + '//' + l.host;
    const getMediaUrl = () => $player.src;

    const compressedHashPrefix = 'dr=';

    const bytesToBase64 = (bytes) => {
      var binary = '';
      const chunkSize = 0x8000;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
      }
      return btoa(binary);
    }
    const base64ToBytes = (base64) => {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return bytes;
    }
    const base64ToBase64Url = (base64) => base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    const base64UrlToBase64 = (base64url) => {
      const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
      const padding = base64.length % 4;
      if (padding === 0) return base64;
      return `${base64}${'='.repeat(4 - padding)}`;
    }
    const compressStringDeflateRaw = async (str) => {
      if (typeof CompressionStream !== 'function') return undefined;
      const inputBytes = new TextEncoder().encode(str);
      const stream = new Blob([inputBytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
      const compressed = new Uint8Array(await new Response(stream).arrayBuffer());
      return base64ToBase64Url(bytesToBase64(compressed));
    }
    const decompressStringDeflateRaw = async (base64url) => {
      if (typeof DecompressionStream !== 'function') {
        throw new Error('Unable to decode compressed hash: DecompressionStream not supported');
      }
      const compressed = base64ToBytes(base64UrlToBase64(base64url));
      const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      const decompressed = new Uint8Array(await new Response(stream).arrayBuffer());
      return new TextDecoder().decode(decompressed);
    }

    const encodeHashLegacy = (hash) => encodeURIComponent(base64EncodeUTF(JSON.stringify(hash)));
    const decodeHashLegacy = (hash) => JSON.parse(base64DecodeUTF(decodeURIComponent(hash)));
    const encodeHash = async (hash) => {
      const json = JSON.stringify(hash);
      try {
        const compressed = await compressStringDeflateRaw(json);
        if (compressed && compressed.length > 0) return `${compressedHashPrefix}${compressed}`;
      } catch (e) {
        console.warn('Unable to compress hash state, falling back to legacy encoding', e);
      }
      return encodeHashLegacy(hash);
    }
    const decodeHash = async (hash) => {
      if (hash && hash.startsWith(compressedHashPrefix)) {
        const compressed = hash.substring(compressedHashPrefix.length);
        const json = await decompressStringDeflateRaw(compressed);
        return JSON.parse(json);
      }
      return decodeHashLegacy(hash);
    }
    const getHash = async () => {
      const urlHash = window.location.hash.substr(1);
      if (!urlHash || urlHash.length === 0) return {};

      var hash = {};
      try {
        hash = await decodeHash(urlHash);
      } catch (e) {
        console.warn('Unable to decode hash state', e);
      }

      return hash;
    }

    let hashWriteQueue = Promise.resolve();
    const updateHash = (opts = {}) => {
      const state = getState();
      hashWriteQueue = hashWriteQueue
        .then(async () => {
          const encoded = await encodeHash(state);
          var url = new URL(location);
          url.hash = encoded;
          if (opts.push) {
            history.pushState(null, document.title, url);
          } else {
            history.replaceState(null, document.title, url);
          }
        })
        .catch((e) => console.warn('Unable to update hash state', e));
    }

    const updateTitle = () => {
      const prefix = `player.html`
      const url = $player.src;

      if (!url) return document.title = prefix;

      const name = urlToLabel(url);
      const time = secondsToString($player.currentTime);
      const title = `${prefix} - ${name} (${time})`;

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

        if (!metadata || !metadata.url) return;
        const label = (metadata.name ? removeFileExtension(metadata.name) : urlToLabel(metadata.url));
        const item = { url: metadata.url, label: (label ? label : urlToFilename(metadata.url)) };
        return setPlaylistFromItem(item, true);
      }
    }

    const actionPasteAndPlay = (e) => {
      e.preventDefault();

      const re = /^https?:\/\//i;
      const clipboard = e.clipboardData.getData('text');

      if (clipboard && re.test(clipboard)) {
        const url = clipboard;
        logInfo(`Playing media from clipboard: ${clipboard}`);
        setPlaylistFromUrl(url, true);
      }
    }

    const resetPlayer = () => {
      resetFileinfo();
      clearSubtitles();
      resetAutoSubtitleState();
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

      setAriaPressed('.btn-play-pause', state === 'play');
      if (state === 'stop') resetPlayerBackground();
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

    const actionPlay = (url, opts = {}) => {
      const shouldAutoplay = (opts.autoplay !== false);

      // Don't restart playback if it is the currently playing media
      if (url === $player.currentSrc && $player.src.length > 0) return;

      resetPlayer();

      // Being playback if there is a URL
      if (!!url) {
        logInfo(`Loading media: ${url}`);
        $player.autoplay = shouldAutoplay;

        $player.once('error', () => {
          console.warn(`Unable to begin playback: ${url}`);
          advancePlaylist('error');
        });
        $player.once('play', () => logInfo(`Playback started: ${url}`));
        $player.once('loadedmetadata', () => updateDuration($player.duration));
        $player.src = $trick.src = hashState.media = url;
        $player.load();
        $body.addClass('is-loaded');

        $player.once('loadedmetadata', () => {
          if ($player.videoWidth === 0 && $player.videoHeight === 0) {
            $body.addClass('is-audio');
            if (!$player.paused) schedulePlayerArtworkBackground(url);
          } else {
            $body.removeClass('is-audio');
            resetPlayerBackground();
          }
        });

        document.querySelector('.media-title').innerText = urlToLabel(url);

        const scrollOpts = {
          behavior: 'smooth',
          block: 'center'
        }
        setTimeout(() => $player.scrollIntoView(scrollOpts), 16);

        if (!shouldAutoplay) updatePlaybackState('pause');

      } else { // Reset the player if no URL supplied
        updateDuration(0);

        unloadMediaSrc($player);
        unloadMediaSrc($trick);

        hashState.media = undefined;
        $body.removeClass('is-loaded');

        resetPlayerBackground();
        logInfo(`Playback stopped`);
      }

      syncPlaylistCurrent();
      setCurrentMediaTile();
    }

    const checkFileHandlerOpen = () => {
      if ('launchQueue' in window) {
        window.launchQueue.setConsumer(async (launchParams) => {
          if (launchParams.files.length > 0) {
            const fileHandle = launchParams.files[0];
            const file = await fileHandle.getFile();
            const url = URL.createObjectURL(file);

            const label = (file.name ? removeFileExtension(file.name) : urlToLabel(url));
            setPlaylistFromItem({ url, label: (label ? label : urlToFilename(url)) }, true);
          }
        });
      }
    };

    const unloadMediaSrc = (el) => {
      el.removeAttribute('src'); // Unset video, use `removeAttribute` instead of `src = undefined` to prevent 404s for `/video-thumbnail.js/src/undefined`
      el.load(); // Must invoke `load` to complete the `src` change
    }

    const subtitleDurationCache = new Map();
    const autoPositionedSubtitleCues = new WeakSet();
    let autoSubtitleAttemptedFor = '';
    let autoSubtitlePlaybackStartedFor = '';

    const getAutoSubtitleDefault = () => {
      const fromSettings = getOptionSettingDefault('auto-subtitles', undefined);
      if (typeof fromSettings !== 'undefined') return normalizeBooleanSetting(fromSettings, false);
      if (app && app.options && app.options.subtitles && typeof app.options.subtitles.autoMatch !== 'undefined') {
        return normalizeBooleanSetting(app.options.subtitles.autoMatch, false);
      }
      return false;
    }

    const shouldAutoLoadMatchingSubtitles = () => {
      const stored = retrieveSetting('auto-subtitles');
      if (typeof stored !== 'undefined') return stored;
      return getAutoSubtitleDefault();
    }

    const isSubtitleTrackKind = (kind) => kind === 'subtitles' || kind === 'captions';

    const getSubtitlePositionPreference = () => {
      return normalizeSubtitlePosition(retrieveSetting('subtitle-position'), getSubtitlePositionDefault());
    }

    const applySubtitleStyleSettings = () => {
      const font = normalizeSubtitleFont(retrieveSetting('subtitle-font'), getSubtitleFontDefault());
      const size = normalizeSubtitleSize(retrieveSetting('subtitle-size'), getSubtitleSizeDefault());
      const color = normalizeSubtitleColor(retrieveSetting('subtitle-color'), getSubtitleColorDefault());
      const background = normalizeSubtitleColor(retrieveSetting('subtitle-background'), getSubtitleBackgroundDefault());

      setCSSVariableNumber('--subtitle-font-family', subtitleFontToFamily(font), $html);
      setCSSVariableNumber('--subtitle-size-scale', subtitleSizeToScale(size), $html);
      setCSSVariableNumber('--subtitle-color', color, $html);
      setCSSVariableNumber('--subtitle-background-color', background, $html);
    }

    const applySubtitlePositionToCue = (cue, preferredLine) => {
      if (!cue || typeof cue.line === 'undefined') return;

      if (preferredLine === 'author') {
        if (autoPositionedSubtitleCues.has(cue)) {
          try {
            cue.line = 'auto';
            cue.snapToLines = true;
          } catch (e) {}
          autoPositionedSubtitleCues.delete(cue);
        }
        return;
      }

      const hasAuthorPosition = (cue.line !== 'auto' && !autoPositionedSubtitleCues.has(cue));
      if (hasAuthorPosition) return;

      try {
        cue.snapToLines = false;
        cue.line = preferredLine;
        autoPositionedSubtitleCues.add(cue);
      } catch (e) {}
    }

    const applySubtitlePositionToTrack = (textTrack, preferredLine) => {
      if (!textTrack || !isSubtitleTrackKind(textTrack.kind)) return;
      const cues = textTrack.cues;
      if (!cues || !cues.length) return;
      for (let i = 0; i < cues.length; i++) {
        applySubtitlePositionToCue(cues[i], preferredLine);
      }
    }

    const applySubtitlePositionPreference = () => {
      const textTracks = $player ? $player.textTracks : null;
      if (!textTracks || !textTracks.length) return;
      const preferredLine = getSubtitlePositionPreference();
      for (let i = 0; i < textTracks.length; i++) {
        applySubtitlePositionToTrack(textTracks[i], preferredLine);
      }
    }

    const resetAutoSubtitleState = () => {
      autoSubtitleAttemptedFor = '';
      autoSubtitlePlaybackStartedFor = '';
    }

    const markAutoSubtitlePlaybackStarted = () => {
      const mediaUrl = $player.currentSrc || $player.src;
      if (mediaUrl) autoSubtitlePlaybackStartedFor = mediaUrl;
    }

    const getMatchingSubtitleUrl = (mediaUrl) => {
      if (!mediaUrl || !Array.isArray(app.links.files)) return null;
      if (isAudio(mediaUrl)) return null;
      const mediaBase = stripUrlExtension(mediaUrl);
      if (!mediaBase) return null;

      const candidates = app.links.files.filter((file) => file && file.url && isSubtitle(file.url));
      const matches = candidates.filter((file) => stripUrlExtension(file.url) === mediaBase);
      if (!matches.length) return null;

      const vtt = matches.find((file) => file.url && file.url.toLowerCase().endsWith('.vtt'));
      return (vtt || matches[0]).url;
    }

    const maybeAutoLoadSubtitles = () => {
      if (!shouldAutoLoadMatchingSubtitles()) return;

      const mediaUrl = $player.currentSrc || $player.src;
      if (!mediaUrl) return;
      if (autoSubtitlePlaybackStartedFor !== mediaUrl) return;
      if (!Array.isArray(app.links.files)) return;
      if (autoSubtitleAttemptedFor === mediaUrl) return;

      autoSubtitleAttemptedFor = mediaUrl;

      if (hasSubtitleTracks()) return;

      const subtitleUrl = getMatchingSubtitleUrl(mediaUrl);
      if (!subtitleUrl) return;

      loadSubtitle(subtitleUrl);
    }

    const hasSubtitleTracks = () => {
      const trackElements = $player ? $player.querySelectorAll('track') : null;
      if (trackElements && trackElements.length > 0) return true;

      const textTracks = $player ? $player.textTracks : null;
      if (!textTracks || !textTracks.length) return false;
      for (let i = 0; i < textTracks.length; i++) {
        const kind = textTracks[i].kind;
        if (isSubtitleTrackKind(kind)) return true;
      }
      return false;
    }

    const createDisableSubtitlesItem = () => {
      const $toggle = $(`<li class='subtitle-item modal-item disable-subtitles'>Turn off subtitles</li>`);
      $toggle.on('click', (e) => {
        e.preventDefault();
        clearSubtitles({ updateHash: true });
      });
      return $toggle;
    }

    const updateSubtitleToggleVisibility = () => {
      if (!$subtitles) return;
      const hasTracks = hasSubtitleTracks();
      const existing = $subtitles.querySelector('.disable-subtitles');
      const settingsStart = $subtitles.querySelector('.subtitle-settings-heading, .subtitle-setting-item');
      if (hasTracks) {
        if (!existing) {
          const $toggle = createDisableSubtitlesItem();
          if (settingsStart) {
            $subtitles.insertBefore($toggle, settingsStart);
          } else {
            $subtitles.append($toggle);
          }
        } else if (settingsStart) {
          $subtitles.insertBefore(existing, settingsStart);
        }
      } else if (existing) {
        $(existing).remove();
      }
    }

    const disableAllTextTracks = () => {
      const textTracks = $player ? $player.textTracks : null;
      if (!textTracks || !textTracks.length) return;
      for (let i = 0; i < textTracks.length; i++) {
        const kind = textTracks[i].kind;
        if (isSubtitleTrackKind(kind)) {
          textTracks[i].mode = 'disabled';
        }
      }
    }

    const enableLatestSubtitleTrack = () => {
      const textTracks = $player ? $player.textTracks : null;
      if (!textTracks || !textTracks.length) return false;
      let lastIndex = -1;
      for (let i = 0; i < textTracks.length; i++) {
        const kind = textTracks[i].kind;
        if (isSubtitleTrackKind(kind)) lastIndex = i;
      }
      if (lastIndex < 0) return false;
      for (let i = 0; i < textTracks.length; i++) {
        const kind = textTracks[i].kind;
        if (isSubtitleTrackKind(kind)) {
          textTracks[i].mode = (i === lastIndex ? 'showing' : 'disabled');
        }
      }
      return true;
    }

    const ensureSubtitleTrackEnabled = () => {
      if (enableLatestSubtitleTrack()) return;
      setTimeout(() => enableLatestSubtitleTrack(), 0);
    }

    const getSubtitleDurationCached = async (url) => {
      const cached = subtitleDurationCache.get(url);
      if (typeof cached === 'number') return cached;
      if (cached && typeof cached.then === 'function') return cached;

      const promise = getSubtitleDuration(url)
        .then((duration) => {
          subtitleDurationCache.set(url, duration);
          return duration;
        })
        .catch((e) => {
          console.warn('Unable to read subtitle duration', e);
          subtitleDurationCache.delete(url);
          return 0;
        });

      subtitleDurationCache.set(url, promise);
      return promise;
    }

    const updateSubtitleDurations = () => {
      const items = [...$subtitles.querySelectorAll('li[data-subtitle-url]')];
      items.forEach(async (li) => {
        const $li = $(li);
        if ($li.hasClass('disable-subtitles')) return;
        if (li.dataset.subtitleDurationReady === 'true') return;
        const url = li.dataset.subtitleUrl;
        if (!url) return;
        const duration = await getSubtitleDurationCached(url);
        const name = li.dataset.subtitleName ? decodeURIComponent(li.dataset.subtitleName) : li.textContent;
        li.textContent = `${name} (${secondsToString(duration)})`;
        li.dataset.subtitleDurationReady = 'true';
      });
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
          const safeUrl = escapeAttr(url);
          const safeName = escapeHtml(name);
          const encodedName = encodeURIComponent(name);
          html += `<li class='subtitle-item modal-item' data-subtitle-url='${safeUrl}' data-subtitle-name='${encodedName}' title='${safeUrl}'>${safeName}</li>`
        }
      }

      $subtitles.html(html);

      const list = [...$subtitles.querySelectorAll('li[data-subtitle-url]')];
      list.forEach((li) => {
        const $li = $(li);
        $li.on('click', (e) => {
          e.preventDefault();

          loadSubtitle(li.dataset.subtitleUrl);
        });
      })

      renderSubtitleSettingsControls();
      updateSubtitleToggleVisibility();
      maybeAutoLoadSubtitles();
    }

    const loadSubtitle = async (url) => {
      const selectedSubtitleUrl = url;
      clearSubtitles();

      if (isSRT(url)) {
        url = await srtToVtt(url);
      } else {
        url = await urlToObjectUrl(url, 'text/vtt');
      }

      getSubtitleDurationCached(url);

      const $track = $(`<track src='${url}' label='${url}' default>`);
      $track.on('load', applySubtitlePositionPreference);
      $player.append($track);
      hashState.subtitle = selectedSubtitleUrl;
      ensureSubtitleTrackEnabled();
      applySubtitlePositionPreference();
      setTimeout(applySubtitlePositionPreference, 0);
      updateSubtitleToggleVisibility();
      setAriaPressed('.btn-subtitles', true);
      updateHash();
    }

    const clearSubtitles = (opts = {}) => {
      disableAllTextTracks();
      const tracks = [...document.querySelectorAll('track')];

      if (tracks) {
        tracks.forEach((track) => {
          if (track.track && isSubtitleTrackKind(track.track.kind)) {
            track.track.mode = 'disabled';
          }
          $(track).remove();
        });
      }
      hashState.subtitle = undefined;
      updateSubtitleToggleVisibility();
      setAriaPressed('.btn-subtitles', false);
      if (opts.updateHash) updateHash();
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

      const re = /(\d{2}):(\d{2}):(\d{2})[.,](\d{3})/g;
      let lastMatch;
      let match;

      while ((match = re.exec(text)) !== null) {
        lastMatch = match;
      }

      if (lastMatch) {
        const h = parseInt(lastMatch[1], 10);
        const m = parseInt(lastMatch[2], 10);
        const s = parseInt(lastMatch[3], 10);
        const ms = parseInt(lastMatch[4], 10);

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

      const maxVolumeStep = 3;
      const uiValue = (volume === 0 ? 0 : (volume / maxVolumeStep)); // 0..1
      const exponent = (typeof app.options.volumeExponent === 'number' ? app.options.volumeExponent : 1.8);
      $player.volume = (uiValue === 0 ? 0 : Math.pow(uiValue, exponent));
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
      const duration = getMediaDuration();
      const newTime = $player.currentTime + delta;
      if (!duration) return $player.currentTime = Math.max(0, newTime);
      return $player.currentTime = minmax(0, newTime, duration);
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
    const updateFullscreenAria = () => setAriaPressed('.btn-fullscreen', isFullscreen());
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
        setAriaPressed('.btn-pip', true);
      } else {
        $html.removeClass('is-pip');
        setAriaPressed('.btn-pip', false);
      }
    };
    const exitPIP = () => {
      if (isPIPSupported()) document.exitPictureInPicture();
      $html.removeClass('is-pip');
      setAriaPressed('.btn-pip', false);
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
    const getProgressBarRelative = (e) => {
      const rect = $progressBar.getBoundingClientRect();
      if (!rect.width) return 0;
      const point = (e.touches && e.touches.length ? e.touches[0].clientX : e.clientX);
      if (isUndefined(point)) return 0;
      const raw = (point - rect.left) / rect.width;
      return minmax(0, raw, 1);
    }

    const actionProgressBarSeek = (e) => {
      const relative = getProgressBarRelative(e);
      $player.currentTime = getMediaDuration() * relative;
    }

    let isProgressDragging = false;
    const progressDragStart = (e) => {
      isProgressDragging = true;
      if (e.pointerId && $progressBar.setPointerCapture) {
        $progressBar.setPointerCapture(e.pointerId);
      }
      actionProgressBarSeek(e);
      e.preventDefault();
    }

    const progressDragMove = (e) => {
      if (!isProgressDragging) return;
      actionProgressBarSeek(e);
      e.preventDefault();
    }

    const progressDragEnd = (e) => {
      if (!isProgressDragging) return;
      isProgressDragging = false;
      actionProgressBarSeek(e);
      if (e.pointerId && $progressBar.releasePointerCapture) {
        try { $progressBar.releasePointerCapture(e.pointerId); } catch (err) {}
      }
      e.preventDefault();
    }

    const progressKeyStep = (delta) => {
      if (!getMediaDuration()) return;
      $player.currentTime = minmax(0, $player.currentTime + delta, getMediaDuration());
      updateProgress();
    }

    const progressKeyHandler = (e) => {
      if (getMediaDuration() <= 0) return;
      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowDown':
          e.preventDefault();
          progressKeyStep(-5);
          break;
        case 'ArrowRight':
        case 'ArrowUp':
          e.preventDefault();
          progressKeyStep(5);
          break;
        case 'PageUp':
          e.preventDefault();
          progressKeyStep(-30);
          break;
        case 'PageDown':
          e.preventDefault();
          progressKeyStep(30);
          break;
        case 'Home':
          e.preventDefault();
          $player.currentTime = 0;
          updateProgress();
          break;
        case 'End':
          e.preventDefault();
          $player.currentTime = getMediaDuration();
          updateProgress();
          break;
      }
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
        updateProgressBarAria();

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
      const relative = getProgressBarRelative(e);
      const absolute = relative * getMediaDuration();

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

    const playFile = (file) => {
      if (!file) return;
      const url = URL.createObjectURL(file);
      const label = (file.name ? removeFileExtension(file.name) : urlToLabel(url));
      return setPlaylistFromItem({ url, label: (label ? label : urlToFilename(url)) }, true);
    };

    const actionOpenLocalFile = () => {
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
      updatePlaylistLoop();
      renderPlaylist();
    }

    const setupPrimaryControls = () => {
      $('.btn-subtitles').on('click', () => toggleModal($subtitles));
      $('.btn-fileinfo').on('click', () => toggleModal($fileinfo));
      $('.btn-playlist').on('click', () => toggleModal($playlist));
      $('.btn-settings').on('click', () => toggleModal($settings));
      $('.btn-playback-rate').on('click', actionPlaybackRate);
      $('.btn-rewind').on('click', actionReplay);
      $('.btn-fast-forward').on('click', actionSkip);
      $('.btn-stop').on('click', actionStop);
      $('.btn-previous').on('click', playPreviousTrack);
      $('.btn-next').on('click', playNextTrack);
      $('.btn-loop').on('click', togglePlaylistLoop);
      $('.btn-volume').on('click', actionVolume);
      delay(10, updateVolume);

      $('.btn-onedrive').on('click', openFromCloud('onedrive'));
      $('.btn-gdrive').on('click', openFromCloud('gdrive'));
      $('.btn-local-file').on('click', actionOpenLocalFile);

      $('.btn-play-pause').on('click', actionPlayPause);
      $('.btn-fullscreen').on('click', actionFullscreenToggle);
      updateFullscreenSupport();
      updateFullscreenAria();
      document.addEventListener('fullscreenchange', updateFullscreenAria);
      document.addEventListener('webkitfullscreenchange', updateFullscreenAria);
      $('.btn-pip').on('click', actionPIPToggle);
      updatePIPSupport();
      updateVolumeSupport();
      setAriaPressed('.btn-subtitles', false);
    }

    const setupModals = () => {
      $fileinfo.on('click', (e) => {
        // Only hide the fileinfo if the target element isn't `<span class="value"/>` so that you can copy value text
        const isValue = $(e.target).hasClass('value');
        if (!isValue) hideModals();
      });
      $help.on('click', hideModals);
      $playlist.on('click', (e) => e.stopImmediatePropagation());

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
      $player.on('loadedmetadata', () => {
        updateFileinfo();
        updateSubtitleToggleVisibility();
        applySubtitlePositionPreference();
        setTimeout(applySubtitlePositionPreference, 0);
      });
      $player.on('loadeddata', syncTrickSrc);
      $player.on('timeupdate', throttle(updateProgress, app.options.updateRate.timeupdate));
      $player.on('pause', () => updatePlaybackState('pause'));
      $player.on('play',  () => {
        updatePlaybackState('play');
        markAutoSubtitlePlaybackStarted();
        if ($body.hasClass('is-audio')) schedulePlayerArtworkBackground($player.currentSrc);
        maybeAutoLoadSubtitles();
      });
      $player.on('ended', () => {
        updatePlaybackState('stop');
        advancePlaylist('ended');
      });
      $player.on('click', () => { if ($player.src.length > 0) actionPlayPause(); });
      $player.on('dblclick', actionFullscreenToggle);
      $player.on('volumechange', updateVolume);
      $player.on('ratechange', updatePlaybackRate);

      $progressBar.on('mousemove', throttle(progressBarTrickHover, app.options.updateRate.trickHover));
      if (window.PointerEvent) {
        $progressBar.on('pointerdown', progressDragStart);
        $progressBar.on('pointermove', progressDragMove);
        $progressBar.on('pointerup', progressDragEnd);
        $progressBar.on('pointercancel', progressDragEnd);
      } else {
        $progressBar.on('mousedown', (e) => {
          progressDragStart(e);
          const move = (ev) => progressDragMove(ev);
          const end = (ev) => {
            progressDragEnd(ev);
            window.removeEventListener('mousemove', move);
            window.removeEventListener('mouseup', end);
          };
          window.addEventListener('mousemove', move);
          window.addEventListener('mouseup', end);
        });
        $progressBar.on('touchstart', (e) => {
          progressDragStart(e);
          const move = (ev) => progressDragMove(ev);
          const end = (ev) => {
            progressDragEnd(ev);
            window.removeEventListener('touchmove', move);
            window.removeEventListener('touchend', end);
            window.removeEventListener('touchcancel', end);
          };
          window.addEventListener('touchmove', move, { passive: false });
          window.addEventListener('touchend', end);
          window.addEventListener('touchcancel', end);
        });
      }
      $progressBar.on('keydown', progressKeyHandler);

      if ($player.textTracks && $player.textTracks.addEventListener) {
        $player.textTracks.addEventListener('addtrack', () => {
          setTimeout(applySubtitlePositionPreference, 0);
        });
      }
    }

    const keyboardBroker = (e) => {
      // Don't handle keyboard combinations
      if (e.ctrlKey || e.altKey) return;
      const target = e.target;
      if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
      if (target && target.classList && target.classList.contains('progress-bar')) return;
      if (document.querySelector('.modal.show') && e.key !== 'Escape') return;

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
        case 'PageUp':
          e.preventDefault();
          playPreviousTrack();
          break;
        case 'PageDown':
          e.preventDefault();
          playNextTrack();
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
    }
    window.addEventListener('keydown', keyboardBroker);
    $html.on('contextmenu', (e) => e.preventDefault());

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
      if ($el === $subtitles) updateSubtitleDurations();
      $el.once('click', hideModals);
    }

    const hideModals = (e) => {
      if (e && $(e.target).hasClass('value')) return;

      const modals = [...document.querySelectorAll('.modal.show')];
      modals.forEach((el) => $(el).removeClass('show'));
    }

    const subtitlePersistedSettingKeys = [
      'auto-subtitles',
      'subtitle-font',
      'subtitle-size',
      'subtitle-position',
      'subtitle-color',
      'subtitle-background'
    ];
    const subtitleSettingKeys = new Set([
      ...subtitlePersistedSettingKeys,
      'subtitle-reset'
    ]);
    const isSubtitleSetting = (key) => subtitleSettingKeys.has(key);

    const renderSettingRows = (keys, useDefaults, itemClass = 'setting-item') => {
      return keys.reduce((acc, key) => {
        const setting = settings[key];
        const type = setting.type || 'checkbox';
        const value = (useDefaults && !isUndefined(setting.default) ? setting.default : setting.get());
        const isCheckbox = (type === 'checkbox');
        const isSelect = (type === 'select');
        const checked = (isCheckbox && value === true ? 'checked' : '');
        const attrs = (setting.attrs ? ` ${setting.attrs}` : '');

        var valueAttribute = '';

        if (typeof value !== 'boolean' && !isSelect) {
          if (setting.type === 'button') {
            valueAttribute = `value="${setting.buttonLabel}"`;
          } else if (setting.type === 'color') {
            if (typeof value === 'number') {
              valueAttribute = `value="${HSLToHex(value, 100, 50)}"`;
            } else {
              const fallback = (isString(setting.default) ? setting.default : '#ffffff');
              valueAttribute = `value="${escapeAttr(normalizeSubtitleColor(value, fallback))}"`;
            }
          } else {
            valueAttribute = `value="${escapeAttr(value)}"`;
          }
        }

        const control = (isSelect
          ? (() => {
              const hasSelectedOption = (setting.options || []).some((opt) => {
                const optValue = (opt && typeof opt === 'object' ? opt.value : opt);
                return String(value) === String(optValue);
              });
              const customOption = (!hasSelectedOption && key === 'subtitle-size')
                ? `<option value="${escapeAttr(value)}" selected>${escapeHtml(value)}</option>`
                : '';
              const options = customOption + (setting.options || [])
                .map((opt) => {
                  const optValue = (opt && typeof opt === 'object' ? opt.value : opt);
                  const optLabel = (opt && typeof opt === 'object' ? opt.label : opt);
                  const safeValue = escapeAttr(optValue);
                  const safeLabel = escapeHtml(optLabel);
                  const selected = (String(value) === String(optValue) ? ' selected' : '');
                  return `<option value="${safeValue}"${selected}>${safeLabel}</option>`;
                })
                .join('');
              return `<select class='setting-${key}'${attrs}>${options}</select>`;
            })()
          : `<input type="${type}" class='setting-${key}' ${valueAttribute} ${checked}${attrs}>`
        );

        return `${acc}
          <li class='modal-item ${itemClass}' title='${setting.desc}'><span class='key'>${setting.label}</span>
            <span class='desc'>
              <label>${control}<span class="metadata"></span></label>
            </span>
          </li>`;
      }, '');
    }

    const bindSettingControls = (keys) => {
      const updateWithoutPersisting = (setting) => {
        suppressSettingPersistence = true;
        try {
          setting.update();
        } finally {
          suppressSettingPersistence = false;
        }
      }

      keys.forEach((key) => {
        const setting = settings[key];
        const $el = $(`.setting-${key}`);
        if (!$el) return;
        const $item = $el.closest('.modal-item');
        if ($item) $($item).on('click', (e) => e.stopImmediatePropagation());

        const changeEvent = setting.event || 'click';

        $el.on(changeEvent, () => {
          if ($el.attr('type') === 'button') {
            setting.set();
          } else {
            setting.update();
          }
        });

        $el.on('click', (e) => e.stopImmediatePropagation()); // Don't close the modal for clicks on a settings control
        updateWithoutPersisting(setting);
      });
    }

    const renderSettingsControls = (useDefaults) => {
      refreshSettingDefaultsFromOptions();
      const keys = Object.keys(settings).filter((key) => !isSubtitleSetting(key));
      const html = renderSettingRows(keys, useDefaults, 'setting-item');
      $settings.html(html);
      bindSettingControls(keys);
      return html;
    }

    const renderSubtitleSettingsControls = (useDefaults) => {
      if (!$subtitles) return '';
      refreshSettingDefaultsFromOptions();
      const keys = Object.keys(settings).filter((key) => isSubtitleSetting(key));
      const rows = renderSettingRows(keys, useDefaults, 'setting-item subtitle-setting-item');
      const html = `<li class='modal-item subtitle-section-heading subtitle-settings-heading'>Subtitle display settings</li>${rows}`;
      const old = [...$subtitles.querySelectorAll('.subtitle-settings-heading, .subtitle-setting-item')];
      old.forEach((el) => $(el).remove());
      $subtitles.insertAdjacentHTML('beforeend', html);
      bindSettingControls(keys);
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
    let suppressSettingPersistence = false;
    const persistSetting = (key, value) => {
      if (suppressSettingPersistence) return;
      storageStore(`setting-${key}`, value);
    }
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
        default: normalizeNumberSetting(getOptionSettingDefault('hue', getCSSVariable('--default-hue')), getCSSVariable('--default-hue')),
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
        default: normalizeBooleanSetting(getOptionSettingDefault('blur', true), true),
        get: () => typeof retrieveSetting('blur') !== 'undefined' ? retrieveSetting('blur') : settings.blur.default,
        set: (val) => persistSetting('blur', val),
        update: () => {
          const $el = $('.setting-blur');
          const val = $el.checked;
          settings.blur.set(val);

          if (val) {
            try {
              delete $('html').dataset.blur;
            } catch (e) {}
          } else {
            $('html').dataset.blur = 'disabled';
          }
        }
      },
      transitions: {
        label: 'UI Transitions',
        desc: 'Enable/disable animated transitions in the UI',
        event: 'change',
        default: normalizeBooleanSetting(getOptionSettingDefault('transitions', true), true),
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
      'auto-subtitles': {
        label: 'Auto-load matching subtitles',
        desc: 'Automatically load a subtitle file that shares the video filename (e.g. .vtt or .srt).',
        event: 'change',
        default: getAutoSubtitleDefault(),
        get: () => typeof retrieveSetting('auto-subtitles') !== 'undefined' ? retrieveSetting('auto-subtitles') : settings['auto-subtitles'].default,
        set: (val) => persistSetting('auto-subtitles', val),
        update: () => {
          const $el = $('.setting-auto-subtitles');
          const val = $el.checked;
          settings['auto-subtitles'].set(val);
          if (val) {
            autoSubtitleAttemptedFor = '';
            maybeAutoLoadSubtitles();
          }
        }
      },
      'subtitle-font': {
        label: 'Subtitle font',
        desc: 'Set subtitle font family.',
        event: 'change',
        type: 'select',
        options: subtitleFontOptions,
        default: getSubtitleFontDefault(),
        get: () => normalizeSubtitleFont(retrieveSetting('subtitle-font'), settings['subtitle-font'].default),
        set: (val) => persistSetting('subtitle-font', normalizeSubtitleFont(val)),
        update: () => {
          const $el = $('.setting-subtitle-font');
          const val = normalizeSubtitleFont($el.value);
          $el.value = val;
          settings['subtitle-font'].set(val);
          applySubtitleStyleSettings();
        }
      },
      'subtitle-size': {
        label: 'Subtitle size',
        desc: 'Set subtitle font size.',
        event: 'change',
        type: 'select',
        options: subtitleSizeOptions,
        default: getSubtitleSizeDefault(),
        get: () => normalizeSubtitleSize(retrieveSetting('subtitle-size'), settings['subtitle-size'].default),
        set: (val) => persistSetting('subtitle-size', normalizeSubtitleSize(val)),
        update: () => {
          const $el = $('.setting-subtitle-size');
          const val = normalizeSubtitleSize($el.value);
          $el.value = val;
          settings['subtitle-size'].set(val);
          applySubtitleStyleSettings();
        }
      },
      'subtitle-position': {
        label: 'Subtitle position',
        desc: 'Fallback vertical position used only when cues have no authored line setting.',
        event: 'change',
        type: 'select',
        options: subtitlePositionOptions,
        default: getSubtitlePositionDefault(),
        get: () => normalizeSubtitlePosition(retrieveSetting('subtitle-position'), settings['subtitle-position'].default),
        set: (val) => persistSetting('subtitle-position', normalizeSubtitlePosition(val)),
        update: () => {
          const $el = $('.setting-subtitle-position');
          const val = normalizeSubtitlePosition($el.value);
          $el.value = String(val);
          settings['subtitle-position'].set(val);
          applySubtitlePositionPreference();
        }
      },
      'subtitle-color': {
        label: 'Subtitle color',
        desc: 'Set subtitle text color.',
        event: 'input',
        type: 'color',
        default: getSubtitleColorDefault(),
        get: () => normalizeSubtitleColor(retrieveSetting('subtitle-color'), settings['subtitle-color'].default),
        set: (val) => persistSetting('subtitle-color', normalizeSubtitleColor(val, settings['subtitle-color'].default)),
        update: () => {
          const $el = $('.setting-subtitle-color');
          const val = normalizeSubtitleColor($el.value, settings['subtitle-color'].default);
          $el.value = val;
          settings['subtitle-color'].set(val);
          applySubtitleStyleSettings();
        }
      },
      'subtitle-background': {
        label: 'Subtitle background',
        desc: 'Set subtitle background color.',
        event: 'input',
        type: 'color',
        default: getSubtitleBackgroundDefault(),
        get: () => normalizeSubtitleColor(retrieveSetting('subtitle-background'), settings['subtitle-background'].default),
        set: (val) => persistSetting('subtitle-background', normalizeSubtitleColor(val, settings['subtitle-background'].default)),
        update: () => {
          const $el = $('.setting-subtitle-background');
          const val = normalizeSubtitleColor($el.value, settings['subtitle-background'].default);
          $el.value = val;
          settings['subtitle-background'].set(val);
          applySubtitleStyleSettings();
        }
      },
      'subtitle-reset': {
        label: 'Reset subtitle settings',
        buttonLabel: 'Reset',
        desc: 'Reset subtitle-specific settings to their defaults.',
        event: 'click',
        type: 'button',
        get: () => {},
        set: () => {
          subtitlePersistedSettingKeys.forEach((key) => clearSetting(key));
          renderSubtitleSettingsControls(true);
        },
        update: () => {}
      },
      thumbnailing: {
        label: 'Generate Thumbnails',
        desc: 'Generate thumbnails for video listings. It may use a lot of bandwidth, especially in large folders of videos. Turn off if it causes playback problems.',
        event: 'change',
        default: normalizeBooleanSetting(getOptionSettingDefault('thumbnailing', true), true),
        get: () => typeof retrieveSetting('thumbnailing') !== 'undefined' ? retrieveSetting('thumbnailing') : settings.thumbnailing.default,
        set: (val) => persistSetting('thumbnailing', val),
        update: () => {
          const $el = $('.setting-thumbnailing');
          const val = $el.checked;
          settings.thumbnailing.set(val);
          if (!val) {
            clearThumbnailQueue();
          } else {
            populateThumbnails();
          }
        }
      },
      animate: {
        label: 'Animate Thumbnails',
        desc: 'Generate animated thumbnails. Disable this to save bandwidth and localStorage space.',
        event: 'change',
        default: normalizeBooleanSetting(getOptionSettingDefault('animate', true), true),
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
      'playlist-depth': {
        label: 'Playlist folder depth',
        desc: 'How many folder levels to include when adding a folder to the playlist (1 = current folder only).',
        event: 'change',
        type: 'select',
        options: [1, 2, 3],
        default: getPlaylistFolderDepthDefault(),
        get: () => normalizePlaylistFolderDepth(retrieveSetting('playlist-depth'), settings['playlist-depth'].default),
        set: (val) => persistSetting('playlist-depth', val),
        update: () => {
          const $el = $('.setting-playlist-depth');
          const val = normalizePlaylistFolderDepth($el.value);
          $el.value = val;
          settings['playlist-depth'].set(val);
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
      'export-config': {
        label: 'Export settings file',
        buttonLabel: 'Export',
        desc: `Download the current configuration as ${playerConfigFilename}`,
        event: 'click',
        type: 'button',
        get: () => {},
        set: () => exportPlayerConfig(),
        update: () => {}
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
          renderSubtitleSettingsControls(true);
        },
        update: () => {}
      },
    }

    const refreshSettingDefaultsFromOptions = () => {
      settings.hue.default = normalizeNumberSetting(getOptionSettingDefault('hue', getCSSVariable('--default-hue')), getCSSVariable('--default-hue'));
      settings.blur.default = normalizeBooleanSetting(getOptionSettingDefault('blur', true), true);
      settings.transitions.default = normalizeBooleanSetting(getOptionSettingDefault('transitions', true), true);
      settings['auto-subtitles'].default = getAutoSubtitleDefault();
      settings['subtitle-font'].default = getSubtitleFontDefault();
      settings['subtitle-size'].default = getSubtitleSizeDefault();
      settings['subtitle-position'].default = getSubtitlePositionDefault();
      settings['subtitle-color'].default = getSubtitleColorDefault();
      settings['subtitle-background'].default = getSubtitleBackgroundDefault();
      settings.thumbnailing.default = normalizeBooleanSetting(getOptionSettingDefault('thumbnailing', true), true);
      settings.animate.default = normalizeBooleanSetting(getOptionSettingDefault('animate', true), true);
      settings['playlist-depth'].default = getPlaylistFolderDepthDefault();
    }

    const nonPersistedSettingKeys = new Set(['cache', 'reset', 'subtitle-reset', 'export-config']);
    const exportPlayerConfig = () => {
      const options = deepCloneValue(app.options);
      if (!isObjectRecord(options.settings)) options.settings = {};
      Object.keys(settings).forEach((key) => {
        if (nonPersistedSettingKeys.has(key)) return;
        if (!settings[key] || typeof settings[key].get !== 'function') return;
        options.settings[key] = settings[key].get();
      });
      // `settings` is the canonical home for user-configurable defaults in exported config.
      if (Object.prototype.hasOwnProperty.call(options, 'subtitles')) delete options.subtitles;
      downloadJSON(playerConfigFilename, options);
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
        await requestVideoFrame();
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

    let audioArtworkRequestId = 0;
    let audioArtworkActive = false;
    let audioArtworkForUrl = '';
    let audioArtworkTimeoutId = null;

    const getAudioThumbnailOptions = () => {
      const thumbnailOpts = app.options.thumbnails;
      const audioConfig = app.options.audioThumbnails || {};
      const audioConcurrency = Math.max(1, audioConfig.concurrency || 1);
      const sidecarConcurrency = Math.max(1, audioConfig.sidecarConcurrency || audioConcurrency);

      return {
        sourceStrategy: 'race',
        sidecarExts: ['jpg', 'jpeg'],
        sidecarValidate: 'auto',
        sidecarConcurrency: sidecarConcurrency,
        output: {
          type: 'dataURI',
          size: thumbnailOpts.size,
          mime: { ...thumbnailOpts.mime }
        },
        debug: isDebug()
      };
    };

    const getTileArtworkCssUrl = (url) => {
      const $tile = $(`.file[href='${url}']`);
      if (!$tile) return null;
      const value = $tile.style.getPropertyValue('--image-url-0');
      if (!value || value === 'none') return null;
      return { value: value.trim(), $tile };
    };

    const resetPlayerBackground = () => {
      audioArtworkRequestId += 1;
      audioArtworkActive = false;
      audioArtworkForUrl = '';
      if (audioArtworkTimeoutId) {
        clearTimeout(audioArtworkTimeoutId);
        audioArtworkTimeoutId = null;
      }
      updatePlayerBackground();
    };

    const schedulePlayerArtworkBackground = (url) => {
      if (!url) return;
      if (audioArtworkActive && audioArtworkForUrl === url) return;
      if (audioArtworkTimeoutId) clearTimeout(audioArtworkTimeoutId);
      audioArtworkTimeoutId = setTimeout(() => {
        audioArtworkTimeoutId = null;
        setPlayerArtworkBackground(url);
      }, 0);
    };

    const setPlayerArtworkBackground = async (url) => {
      const requestId = ++audioArtworkRequestId;
      audioArtworkActive = false;

      if (!url || (!isAudio(url) && !$body.hasClass('is-audio'))) {
        updatePlayerBackground();
        return;
      }

      const tileArtwork = getTileArtworkCssUrl(url);
      if (tileArtwork && tileArtwork.value) {
        $player.style.backgroundImage = tileArtwork.value;
        audioArtworkActive = true;
        audioArtworkForUrl = url;
        return;
      }

      if (typeof audioThumbnail !== 'function') {
        updatePlayerBackground();
        return;
      }

      try {
        const results = await audioThumbnail(url, getAudioThumbnailOptions());
        if (requestId !== audioArtworkRequestId) return;

        const best = (results && (results.best || results[0])) || null;
        if (best && best.URI) {
          const cssUrl = `url('${escapeCssUrl(best.URI)}')`;
          $player.style.backgroundImage = cssUrl;
          audioArtworkActive = true;
          audioArtworkForUrl = url;
          if (tileArtwork && tileArtwork.$tile && !hasPreRenderedThumbnail(tileArtwork.$tile)) {
            tileArtwork.$tile.style.setProperty('--image-url-0', cssUrl);
          }
          return;
        }
      } catch (e) {
        if (isDebug()) console.warn('Audio artwork generation failed', url, e);
      }

      if (requestId !== audioArtworkRequestId) return;
      updatePlayerBackground();
    };

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

      if (!audioArtworkActive) updatePlayerBackground();
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

      const timestampList = (
        Array.isArray(thumbnailOpts.timestamps) && thumbnailOpts.timestamps.length > 0
          ? [...thumbnailOpts.timestamps]
          : [0]
      );
      const shouldAnimate = retrieveSetting('animate');
      const timestamps = (shouldAnimate ? timestampList : [timestampList[0]]);
      const frameCount = (shouldAnimate ? timestamps.length : 1);

      if (isAudio(url) && typeof audioThumbnail === 'function') {
        const audioOpts = getAudioThumbnailOptions();
        try {
          const results = await audioThumbnail(url, audioOpts);
          const best = (results && (results.best || results[0])) || null;
          if (best && best.URI) {
            const safeURI = escapeCssUrl(best.URI);
            for (let i = 0; i < frameCount; i++) {
              node.style.setProperty(`--image-url-${i}`, `url('${safeURI}')`);
            }
            return best;
          }
        } catch (e) {
          if (isDebug()) console.warn('Audio thumbnail generation failed', url, e);
        }
        return null;
      }

      const opts = {
        size: thumbnailOpts.size,
        mime: {...thumbnailOpts.mime},
        cache: thumbnailOpts.cache,
        timestamps: timestamps,
        cacheReadOnly: !thumbnailOpts.cache || isPlaying()
      }
      try {
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
      } catch (e) {
        if (isDebug()) console.warn('Thumbnail generation failed', url, e);
        return null;
      }
    }

    const createAnimationCSS = () => {
      const timestamps = (
        Array.isArray(app.options.thumbnails.timestamps) && app.options.thumbnails.timestamps.length > 0
          ? [...app.options.thumbnails.timestamps]
          : [0]
      );
      const n = timestamps.length;
      const style = $('style[primary]');
      if (!style || !style.sheet) return;

      var animationRule = '@keyframes animateThumbnail {\r\n';
      if (n <= 1) {
        animationRule += `0% { background-image: var(--image-url-0); }\r\n`;
        animationRule += `100% { background-image: var(--image-url-0); }\r\n`;
      } else {
        const unit = (1 / (n - 1)) * 100;
        for (let i = 0; i < n; i++) {
          const percent = `${unit * i}%`;
          animationRule += `${percent} { background-image: var(--image-url-${i}); }\r\n`;
        }
      }
      animationRule += '}';

      style.sheet.insertRule(animationRule);

      setCSSVariableNumber('--thumbnail-timestamps', timestamps.length, $('html'));
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
      window.addEventListener('unhandledrejection', (event) => {
        if (isAbortError(event.reason)) event.preventDefault();
      });

      await loadPlayerConfig();

      setupControls();
      renderSettingsControls();
      renderSubtitleSettingsControls();
      applySubtitleStyleSettings();
      createAnimationCSS();
      updateVersionNumber();
      checkFileHandlerOpen();

      const hash = await getHash();

      if (hash) {
        const restoredPlaylist = (hash.playlist ? applyPlaylistState(hash.playlist) : false);
        const hasHashLocation = (isString(hash.location) && hash.location.length > 1);
        const hasHashSubtitle = (isString(hash.subtitle) && hash.subtitle.length > 1 && !hash.subtitle.startsWith('blob:'));

        if (hasHashSubtitle) {
          hashState.subtitle = hash.subtitle;
        } else {
          hashState.subtitle = undefined;
        }

        if (hash.media && hash.media.length > 1 && !hash.media.startsWith('blob:')) {
          if (restoredPlaylist) {
            actionPlay(hash.media, { autoplay: false });
          } else {
            setPlaylistFromUrl(hash.media, false);
            actionPlay(hash.media, { autoplay: false });
          }
        }

        if (hash.time && hash.time > 0) $player.currentTime = hash.time;

        if (hasHashLocation) {
          await createLinksSafe(hash.location);
        } else {
          await createLinksSafe();
        }

        if (hasHashSubtitle) {
          try {
            await loadSubtitle(hash.subtitle);
          } catch (e) {
            console.warn('Unable to load subtitle from hash state', e);
            clearSubtitles();
          }
        } else {
          clearSubtitles();
        }
      }

      $(window).on('popstate', async (e) => {
        const hash = await getHash();
        if (hash && hash.playlist) applyPlaylistState(hash.playlist);
        if (hash && hash.location && hash.location.length > 1) {
          await createLinksSafe(hash.location);
        } else {
          await createLinksSafe();
        }

        if (hash && hash.subtitle && hash.subtitle.length > 1 && !hash.subtitle.startsWith('blob:')) {
          try {
            await loadSubtitle(hash.subtitle);
          } catch (e) {
            console.warn('Unable to load subtitle from hash state', e);
            clearSubtitles();
          }
        } else {
          clearSubtitles();
        }
      });
    }

    main();
  
