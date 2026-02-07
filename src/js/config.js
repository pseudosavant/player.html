    /* IMPORTANT!!!

      If you would like support for opening directly from the cloud, you must supply the appropriate keys
      in the `app.options.cloud` below AND register your app with Google and/or Microsoft.

      OneDrive Docs: https://docs.microsoft.com/en-us/onedrive/developer/rest-api/getting-started/app-registration?view=odsp-graph-online
      GDrive Docs: https://developers.google.com/drive/api/v3/picker

    */
    const global = window;
    global.app = {
      options: {
        // When false, suppress non-error console noise.
        debug: false,
        cloud: {
          onedrive: {
            clientId: '98a393da-bb36-4061-82df-f847ed49ce8a'
          },
          gdrive: {
            developerKey: 'AIzaSyASwr9ZqtB_DGszfJ7E1nIq-SRO44rsXdc', // Browser API key obtained from the Google API Console.
            clientId: '350482528905-uplflng9avfo3p5sghlgr0g059r04v0b.apps.googleusercontent.com', // Client ID obtained from the Google API Console. Replace with your own Client ID.
            appId: '350482528905' // console.developers.google.com - 'Project number' under 'IAM & Admin' > 'Settings'
          }
        },
        thumbnails: {
          timestamps: [0.005, 0.01, 0.015], // How far into the clip (relatively) should it grab the thumbnail from (e.g. 0.10 = 10%)
          size: 320, // Maximum width of thumbnails. Setting this smaller will save localStorage space.
          mime: {
            type: 'image/webp',
            quality: 0.2
          },
          cache: true, // Should thumbnails be written and read from localStorage cache
          resizeQuality: 'high', // `<canvas>` resize quality
          concurrency: 1 // How many thumbnails should it generate at a time. WARNING: Be careful with this setting. Setting it higher than 1 can swamp your HTTP server with thumbnail requests and cause playback issues.
        },
        audioThumbnails: {
          concurrency: 4, // How many audio thumbnails should it generate at a time. Audio artwork checks are typically lightweight.
          sidecarConcurrency: 4 // How many sidecar checks should run per audio file.
        },
        subtitles: {
          autoMatch: false, // Auto-load matching .vtt/.srt subtitles after playback starts.
          font: 'sans', // sans | serif | mono | casual
          size: '100%', // Percentage string (e.g. 50%, 75%, 100%, 150%, 200%)
          position: 'author', // author | 90 | 75 | 60 | 35 | 20
          color: '#ffffff', // Subtitle text color in hex.
          background: '#000000' // Subtitle background color in hex.
        },
        settings: {
          hue: 323,
          blur: true,
          transitions: true,
          'auto-subtitles': false,
          'subtitle-font': 'sans',
          'subtitle-size': '100%',
          'subtitle-position': 'author',
          'subtitle-color': '#ffffff',
          'subtitle-background': '#000000',
          thumbnailing: true,
          animate: true,
          'playlist-depth': 2
        },
        // Perceptual volume curve exponent for the discrete volume control (0..1 -> 0..1).
        // Higher values give more control at lower volumes.
        volumeExponent: 1.8,
        updateRate: { // Limit UI update rates in ms
          timeupdate: 1000/5, // media playback `timeupdate` events
          trickHover: 1000/10 // Seeking on trickplay hover overlay
        }
      },
      links: [],
      metadata: {}
    };
  
