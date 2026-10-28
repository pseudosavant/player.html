    const global = window;
    const isDebug = () => !!(global.app && global.app.options && global.app.options.debug);
    const logInfo = (...args) => { if (isDebug()) console.info(...args); }
    /*
      You must supply the appropriate keys in the `app.options.cloud` at the top of this <script> block AND register your app with
      Google and/or Microsoft.

      player.html also *must be served over HTTPS* for the Google and MS auth flows to work
    */
    const cloudSdkLoads = new Map();
    function loadCloudSdk(provider) {
      if (provider.ready()) return Promise.resolve();
      if (cloudSdkLoads.has(provider.id)) return cloudSdkLoads.get(provider.id);
      const pending = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = provider.src;
        script.async = true;
        script.dataset.cloudSdk = provider.id;
        const cleanup = () => {
          clearTimeout(timer);
          script.removeEventListener('load', onLoad);
          script.removeEventListener('error', onError);
        };
        const fail = (error) => {
          cleanup();
          script.remove();
          reject(error);
        };
        const onLoad = () => {
          if (!provider.ready()) return fail(new Error(`${provider.name} SDK is unavailable`));
          cleanup();
          resolve();
        };
        const onError = () => fail(new Error(`Unable to load ${provider.name} SDK`));
        const timer = setTimeout(() => fail(new Error(`${provider.name} SDK load timed out`)), 15000);
        script.addEventListener('load', onLoad);
        script.addEventListener('error', onError);
        try {
          document.head.appendChild(script);
        } catch (error) {
          fail(error);
        }
      }).catch((error) => {
        cloudSdkLoads.delete(provider.id);
        throw error;
      });
      cloudSdkLoads.set(provider.id, pending);
      return pending;
    }

    function filePickerMain() {
      const setButtonMessage = (button, key, name) => {
        button.dataset.i18nTitle = key;
        button.dataset.i18nAriaLabel = key;
        button.dataset.i18nParams = JSON.stringify({ provider: name });
        global.i18n.apply(button);
      };
      const providers = [
        {
          id: 'onedrive', name: 'OneDrive', configured: onedriveCheck(),
          src: 'https://js.live.net/v7.2/OneDrive.js',
          ready: () => typeof global.OneDrive?.open === 'function'
        },
        {
          id: 'gdrive', name: 'Google Drive', configured: gdriveCheck(),
          src: 'https://apis.google.com/js/api.js',
          ready: () => typeof global.gapi?.load === 'function'
        }
      ];
      return Promise.all(providers.map((provider) => {
        const button = $(`.btn-${provider.id}`);
        if (!button) return;
        const enabled = isHTTPS() && provider.configured;
        button.hidden = !enabled;
        button.disabled = true;
        if (!enabled) {
          button.style.removeProperty('display');
          return;
        }
        button.show();
        setButtonMessage(button, 'cloud.loading', provider.name);
        return loadCloudSdk(provider).then(() => {
          if (button.hidden) return;
          button.disabled = false;
          setButtonMessage(button, 'cloud.open', provider.name);
        }).catch((error) => {
          if (!button.hidden) setButtonMessage(button, 'cloud.failed', provider.name);
          console.warn(`Cloud picker unavailable: ${provider.name}`, error);
        });
      }));
    }
    global.setupCloudPickers = filePickerMain;

    function isHTTPS() {
      return location.protocol === 'https:';
    }

    function onedriveCheck() {
      const onedriveOpts = app && app.options && app.options.cloud && app.options.cloud.onedrive;
      return isSet(onedriveOpts && onedriveOpts.clientId);
    }

    function gdriveCheck() {
      const gdriveOpts = app && app.options && app.options.cloud && app.options.cloud.gdrive;
      return (
        isSet(gdriveOpts && gdriveOpts.developerKey) &&
        isSet(gdriveOpts && gdriveOpts.clientId) &&
        isSet(gdriveOpts && gdriveOpts.appId)
      );
    }

    function isSet(v) {
      return (typeof v === 'string' && v.trim().length > 0);
    }

    function onedrive() {
      const p = new Promise((resolve, reject) => {
        function complete(res) {
          if (!res || !res.value || !res.value[0]) {
            // Common case: user closes the picker without choosing a file.
            logInfo('OneDrive picker closed without a file');
            resolve();
            return;
          }

          const file = res.value[0];
          const metadata = {
            source: 'OneDrive',
            id: file.id,
            name: file.name,
            url: file['@microsoft.graph.downloadUrl'],
            size: file.size,
            mimeType: file.file.mimeType,
            duration:
              file.video && file.video.duration ? file.video.duration : undefined,
            media: file.video || {}
          };
          resolve(metadata);
        }

        var opts = {
          clientId: app.options.cloud.onedrive.clientId,
          action: 'download',
          multiSelect: false,
          advanced: {
            queryParameters:
              'select=id,name,size,file,audio,video,@microsoft.graph.downloadUrl',
            filter: 'mp4,webm,mkv,wav,mp3,aac,m4a,ogg',
            navigation: {
              sourceTypes: ['OneDrive', 'Sites', 'Recent']
            },
            viewType: 'files'
          },
          success: complete,
          cancel: complete,
          error: reject
        };

        global.OneDrive.open(opts);
      });

      return p;
    }
    global.onedrive = onedrive;
    function gdrive() {
      const p = new Promise((resolve, reject) => {
        const opts = app.options.cloud.gdrive;
        const developerKey = opts.developerKey; // The Browser API key obtained from the Google API Console.
        const clientId = opts.clientId; // The Client ID obtained from the Google API Console. Replace with your own Client ID.
        const appId = opts.appId; //  console.developers.google.com - 'Project number' under 'IAM & Admin' > 'Settings'

        const scope = ['https://www.googleapis.com/auth/drive.file'];

        var gdrivePickerAPILoaded = false;
        var oauthToken;

        // Use the Google API Loader script to load the google.picker script.
        function gdrivePickerLoad() {
          global.gapi.load('auth', {
            callback: function () {
              global.gapi.auth.authorize(
                {
                  client_id: clientId,
                  scope: scope,
                  immediate: false
                },
                function (authResult) {
                  if (authResult && !authResult.error) {
                    oauthToken = authResult.access_token;
                    gdrivePickerCreate();
                  }
                }
              );
            }
          });
          global.gapi.load('picker', {
            callback: function () {
              gdrivePickerAPILoaded = true;
              gdrivePickerCreate();
            }
          });
        }

        function gdrivePickerCreate() {
          if (gdrivePickerAPILoaded && oauthToken) {
            const view = new global.google.picker.View(
              global.google.picker.ViewId.DOCS_VIDEOS
            );
            const gdrivePicker = new global.google.picker.PickerBuilder()
              .setAppId(appId)
              .setOAuthToken(oauthToken)
              .setDeveloperKey(developerKey)
              .addView(view)
              .setCallback(gdriveCallback)
              .build();
            gdrivePicker.setVisible(true);

            global.gdrivePicker = gdrivePicker;
          }
        }

        function gdriveCallback(response) {
          if (
            response.action === global.google.picker.Action.PICKED &&
            response.docs &&
            response.docs[0]
          ) {
            const file = response.docs[0];

            const metadata = {
              source: 'Google Drive',
              url: `https://drive.google.com/u/0/uc?id=${file.id}&export=download`,
              id: file.id,
              name: file.name,
              size: file.sizeBytes,
              duration: file.duration,
              mimeType: file.mimeType
            };

            resolve(metadata);
          } else if (response.action === global.google.picker.Action.CANCEL) {
            resolve();
          }
        }

        gdrivePickerLoad();
      });

      return p;
    }
    global.gdrive = gdrive;
