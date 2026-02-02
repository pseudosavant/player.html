    const iconLink = document.querySelector('link[rel="shortcut icon"]') || document.querySelector('link[rel="icon"]');
    if (iconLink) {
      const icon = iconLink.href;
      const metadata = await imageMetadata(icon);

      const manifest = {
        short_name: document.title,
        name: document.title,
        description: document.querySelector('meta[name="description"]').content,
        background_color: '#FFFFFF',
        theme_color: getCSSVariable('--theme-color'),
        color: getCSSVariable('--theme-color'),
        icons: [
          {
            src: icon,
            sizes: `${metadata.width}x${metadata.height}`,
            type: metadata.type
          }
        ],
        display: 'standalone',
        start_url: `${window.location.origin}${window.location.pathname}`,
        scope: window.location.pathname,
        file_handlers: [
          {
            action: location.href.split('#')[0],
            accept: {
              "audio/*": [".mp3", ".wav", ".aac", ".m4a", ".ogg"],
              "video/*": [".mp4", ".mov", ".webm", ".mkv"]
            }
          }
        ]
      }
      setPWAManifest(manifest);
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

    function imageMetadata(dataURI) {
      const img = document.createElement('img');

      const mimeRe = /data:([\w\/]+);/i;
      const type = mimeRe.exec(dataURI)[1];

      const promise = new Promise((resolve, reject) => {
        img.onload = function imageSizeLoad() {
          const width = img.naturalWidth;
          const height = img.naturalHeight;
          resolve({ height, width, type });
        }
      });

      img.src = dataURI;

      return promise;
    }
  
