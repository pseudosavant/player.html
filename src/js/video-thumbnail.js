    const global = window;
    // video-thumbnail.js
    // https://github.com/pseudosavant/video-thumbnail.js
    // © 2021 Paul Ellis (https://github.com/pseudosavant)
    // License: MIT
    // v1.3.0

    const defaults = {
      timestamps: [0.1],
      size: 480,
      mime: { type: 'image/webp', quality: 0.2 },
      type: 'dataURI',
      cache: false,
      cacheKeyPrefix: 'video-thumbnail.js'
    };

    const round = (val, digits) => +val.toFixed(digits);

    function store(key, val) {
      try {
        localStorage.setItem(key, val);
        console.info(`[localStorage] Persisted: ${key} `);
        return true;
      } catch (e) {
        if (e.name === 'QuotaExceededError') {
          console.warn(`[localStorage] Quota exceeded: unable to persist ${key}`)
        } else {
          console.warn(`[localStorage] Failed to store: ${key} (${e.name})`, e);
        }
        return null;
      }
    }

    function retrieve(key) {
      try {
        return localStorage.getItem(key);
      } catch (e) {
        console.warn(`[localStorage] Failed to retrieve: ${key}`, e);
        return null;
      }
    }

    function keyEndsWith(partialKey) {
      const keys = Object.keys(localStorage);
      const fullKey = keys.find((key) => key.endsWith(partialKey));
      return fullKey;
    }

    const betweenZeroAndOne = (n) => (n > 0 && n < 1);

    const is = (type) => (v) => typeof v === type;
    const isNumber = is('number');
    const isString = is('string');
    const isBoolean = is('boolean');
    const isUndefined = is('undefined');

    const canCache = (function(){
      const falseMessage = `[${defaults.cacheKeyPrefix}] Thumbnail caching support: false`;

      // Must support `localStorage`
      try {
          const key = '__canCacheTest__';
          const val = 'true';

          localStorage.setItem(key, val);
          const supported = localStorage.getItem(key) === val;
          localStorage.removeItem(key);

        if (!supported) console.info(falseMessage);

        return supported;
      } catch (e) {
        console.info(falseMessage);
        return false;
      }
    })();

    function getVideo(url) {
      const $player = document.createElement('video');
      $player.crossorigin = 'anonymous';
      $player.muted = true;
      $player.autoplay = true; // Must be set to `true` for iOS
      $player.playsInline = true; // Must be set to `true` to prevent automatic fullscreen on iOS

      const promise = new Promise((resolve, reject) => {
        // Pause the video once it is available
        $player.addEventListener('canplay', () => {
          $player.pause();
          resolve($player);
        }, { once: true });

        // Reject the promise on error
        $player.addEventListener('error', reject, { once: true});
      });

      $player.src = url;
      $player.load();

      return promise;
    }

    async function videoToDataURI(videoElement, timestamp, size, mime, type) {
      const start = Date.now();
      const $player = videoElement;

      const aspectRatio = $player.videoHeight / $player.videoWidth;
      const w = size;
      const h = w * aspectRatio;

      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d');

      const relativeSeekTimestamp = timestamp * $player.duration;

      // Relative seek if `0 < time < 1`, absolute otherwise
      const seekTime = (betweenZeroAndOne(timestamp) ? relativeSeekTimestamp : timestamp);
      await seek($player, seekTime);

      $player.pause();
      ctx.drawImage($player, 0, 0, w, h);

      const URI = (type === 'objectURL' ? await canvasToBlob(c, mime.type, mime.quality) : c.toDataURL(mime.type, mime.quality));
      const duration = Date.now() - start;
      const response = { URI, timestamp, duration, seekTime, mime };

      return response;
    }

    function canvasToBlob(canvas, type, quality) {
      const promise = new Promise((resolve, reject) => {
        try {
          canvas.toBlob((blob) => resolve(URL.createObjectURL(blob)), type, quality);
        } catch (e) {
          reject('Unable to create blob from `<canvas>`', e);
        }
      });

      return promise;
    }

    function seek($player, time) {
      const promise = new Promise((resolve, reject) => {
        const errorHandler = (e) => reject('Error while seeking video', e);
        $player.addEventListener('error', errorHandler, { once: true});

        $player.addEventListener('seeked', (e) => {
          $player.removeEventListener('error', errorHandler);
          resolve($player.currentTime);
        }, { once: true});
      });

      $player.currentTime = time;

      return promise;
    }

    const isSeekable = (videoElement) => {
      return videoElement.seekable.end(0) === 0;
    }
    window.isSeekable = isSeekable;

    async function getThumbnailDataURI(url, opts) {
      opts = {...opts} || {};

      const isImageMimeType = (s) => (/image\/.+/i).test(s);
      const size          = (isNumber(opts.size) && opts.size > 0         ? opts.size : defaults.size);
      const mime          = (opts.mime && isImageMimeType(opts.mime.type) ? {...opts.mime} : {...defaults.mime});
      const type          = (opts.type === 'objectURL'                    ? opts.type : defaults.type);
      const shouldCache   = (isBoolean(opts.shouldCache)                  ? opts.shouldCache : defaults.cache);
      const cacheReadOnly = opts.cacheReadOnly;

      const timestamps = (
        Array.isArray(opts.timestamps) ?
          opts.timestamps :
          (isUndefined(opts.timestamps) ? defaults.timestamps : [opts.timestamps])
      );

      try {
        const thumbnails = []; // Used to hold the thumbnails for each timestamp
        for (let i = 0; i < timestamps.length; i++) {
          const timestamp = timestamps[i];

          // Find localStorage full key that ends with cacheKeySuffix
          const cacheKeySuffix = `${size}|${imageFormat(mime)}|${timestamp}|${url}`;
          const cachedKey = keyEndsWith(cacheKeySuffix);
          const cachedURI = retrieve(cachedKey);

          // Retrieve from cache if available
          if (canCache && shouldCache && isDataURI(cachedURI)) {
            const metadata = cacheKeyParser(cachedKey);
            const {timestamp, seekTime, mime} = metadata;

            const sizeKB = round(cachedURI.length / 1024, 2);
            const URI = cachedURI;
            const duration = 0;

            thumbnails.push({URI, timestamp, duration, mime, seekTime, sizeKB});
            console.info(`[${defaults.cacheKeyPrefix}] Retrieved from cache: ${cachedKey}`);
          } else if (!cacheReadOnly) {
            // Generate fresh thumbnail if not found in cache
            const $player = await getVideo(url);
            const thumbnail = await videoToDataURI($player, timestamp, size, mime, type);
            unloadVideoSrc($player);

            thumbnail.sizeKB = round(thumbnail.URI.length / 1024, 2);
            thumbnail.seekTime = round(thumbnail.seekTime, 2);
            thumbnails.push(thumbnail);

            // Create full cache key
            const cacheKeyPrefix = (isString(opts.cacheKeyPrefix) ? opts.cacheKeyPrefix : defaults.cacheKeyPrefix);
            const cacheTimestamp = Date.now();
            const cacheKey = `${defaults.cacheKeyPrefix}-${cacheTimestamp}-${thumbnail.seekTime}-${cacheKeySuffix}`;

            // Cache the thumbnail if you can cache, should cache, and it isn't already in the cache
            if (canCache && shouldCache && !retrieve(cacheKey)) {
              const keys = Object.keys(localStorage) // Retrieve all localStorage keys
              .filter((key) => key.startsWith(cacheKeyPrefix)) // Filter out non-video-thumbnail.js keys
              .sort(); // Sort keys. Timestamp in key makes oldest entries show up first

              // While the thumbnail can't be cached remove 1 entry at a time until successful
              while (!store(cacheKey, thumbnail.URI) && keys.length > 0) {
                const key = keys.shift(); // Select oldest cached thumbnail
                localStorage.removeItem(key); // Remove oldest cached thumbnail
                console.info(`[${defaults.cacheKeyPrefix}] Purged from cache: ${key}`);
              }
            }
          }
        }

        return thumbnails;
      } catch (e) {
        console.info(`[${defaults.cacheKeyPrefix}] Unable to create thumbnail(s) for: ${url}`, e);
      }
    }

    const unloadVideoSrc = (el) => {
      el.removeAttribute('src'); // Unset video, use `removeAttribute` instead of `src = undefined` to prevent 404s for `/video-thumbnail.js/src/undefined`
      el.load(); // Must invoke `load` to complete the `src` change
    }

    const cacheKeyParser = (key) => {
      const re = /video-thumbnail\.js-(\d{13,})-(\d+\.?\d{0,2})-(\d{1,4})\|(\w{3,4})\|([\d\.]+)\|(.+)/gim;
      const parts = re.exec(key);
      const res = {
        cacheTimestamp: +parts[1],
        seekTime: +parts[2],
        size: +parts[3],
        mime: { type: `image/${parts[4]}`},
        timestamp: +parts[5],
        URL: parts[6]
      }

      return res;
    };
    const imageFormat = (mime) => mime.type.split('/')[1];
    const isDataURI = (uri) => uri && uri.startsWith('data:image/') && uri.length > 30;

    getThumbnailDataURI.clearCache = (prefix) => {
      const cacheKeyPrefix = (typeof prefix === 'string' ? prefix : defaults.cacheKeyPrefix);

      const keys = Object.keys(localStorage)
        .filter((k) => k.startsWith(cacheKeyPrefix));
      while (keys.length > 0) localStorage.removeItem(keys.pop());

      return keys.length === 0;
    }

    // Returns cache size in bytes
    getThumbnailDataURI.cacheSize = () => {
      const keys = Object.keys(localStorage).filter((key) => key.startsWith(defaults.cacheKeyPrefix));
      const size = keys.reduce((acc, key) => acc += localStorage.getItem(key).length, 0);
      return size;
    }

    global.videoThumbnail = getThumbnailDataURI;
  
