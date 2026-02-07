    const iconLink = document.querySelector('link[rel="shortcut icon"]') || document.querySelector('link[rel="icon"]');
    if (iconLink) {
      const icon = iconLink.href;
      const metadata = await imageMetadata(icon);
      const startUrl = window.location.href.split('#')[0];
      const scopeUrl = new URL('./', startUrl).toString();
      const themeColor = resolveManifestColor(getCSSVariable('--theme-color'));

      const manifest = {
        short_name: document.title,
        name: document.title,
        description: document.querySelector('meta[name="description"]').content,
        background_color: '#FFFFFF',
        theme_color: themeColor,
        color: themeColor,
        icons: [
          {
            src: icon,
            sizes: `${metadata.width}x${metadata.height}`,
            type: metadata.type
          }
        ],
        display: 'standalone',
        start_url: startUrl,
        scope: scopeUrl,
        file_handlers: [
          {
            action: location.href.split('#')[0],
            accept: {
              "audio/*": [".mp3", ".wav", ".aac", ".m4a", ".mka", ".ogg"],
              "video/*": [".mp4", ".mov", ".webm", ".mkv"]
            }
          }
        ]
      }
      setPWAManifest(manifest);
    }

    function resolveManifestColor(value) {
      const fallback = '#ff0099';
      const candidate = String(value || '').trim();
      if (!candidate) return fallback;

      const probe = document.createElement('span');
      probe.style.color = '';
      probe.style.color = candidate;

      if (!probe.style.color) {
        return fallback;
      }

      probe.style.position = 'absolute';
      probe.style.left = '-9999px';
      document.body.appendChild(probe);
      const computed = getComputedStyle(probe).color;
      probe.remove();

      return (computed ? computed : fallback);
    }

    function setPWAManifest(manifest) {
      const json = JSON.stringify(manifest);
      const base64 = base64EncodeUTF(json);
      const mimeType = 'application/json';
      const dataURI = `data:${mimeType};base64,${base64}`;

      const link = document.createElement('link');
      link.setAttribute('rel', 'manifest');
      link.setAttribute('href', dataURI);

      document.querySelector('head').appendChild(link);
    }

    function imageMetadata(src) {
      const img = document.createElement('img');

      const inferImageType = (value) => {
        const dataMatch = /^data:([^;]+);/i.exec(value);
        if (dataMatch) return dataMatch[1];

        const extMatch = /\.([a-z0-9]+)(?:$|[?#])/i.exec(value);
        if (extMatch) {
          const ext = extMatch[1].toLowerCase();
          const map = {
            png: 'image/png',
            jpg: 'image/jpeg',
            jpeg: 'image/jpeg',
            gif: 'image/gif',
            webp: 'image/webp',
            svg: 'image/svg+xml',
            ico: 'image/x-icon'
          };
          if (map[ext]) return map[ext];
        }

        return 'image/png';
      }

      const type = inferImageType(src);

      const promise = new Promise((resolve) => {
        img.onload = function imageSizeLoad() {
          const width = img.naturalWidth;
          const height = img.naturalHeight;
          resolve({ height, width, type });
        }
        img.onerror = function imageSizeError() {
          resolve({ height: 0, width: 0, type });
        }
      });

      img.src = src;

      return promise;
    }
  
