    const global = window;
    const isDebug = () => !!(global.app && global.app.options && global.app.options.debug);
    const logInfo = (...args) => { if (isDebug()) console.info(...args); }
    /*
      You must supply the appropriate keys in the `app.options.cloud` at the top of this <script> block AND register your app with
      Google and/or Microsoft.

      player.html also *must be served over HTTPS* for the Google and MS auth flows to work
    */
    function filePickerMain() {
      // Show the cloud buttons if OneDrive and/or Gdrive are configured
      if (isHTTPS()) {
        if (onedriveCheck()) $('.btn-onedrive').show();
        if (gdriveCheck())   $('.btn-gdrive').show();
      }
    }

    function isHTTPS() {
      return location.protocol === 'https:';
    }

    function onedriveCheck() {
      return isSet(app.options.cloud.onedrive.clientId);
    }

    function gdriveCheck() {
      const opts = app.options.cloud;
      return isSet(opts.gdrive.developerKey) && isSet(opts.gdrive.clientId) && isSet(opts.gdrive.appId);
    }

    function isSet(v) {
      return (typeof v !== 'undefined' && v.length > 0);
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

    filePickerMain();
  
