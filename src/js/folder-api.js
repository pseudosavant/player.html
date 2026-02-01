    // folder.api: version 1.1.0
    const global = window;
    const urlType = (url) => {
      if (isHiddenFileOrFolder(url)) {
        return 'hidden';
      } else if (isFolder(url)) {
        return 'folder';
      } else if (isFile(url)) {
        return 'file';
      } else {
        return 'unknown';
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

    const isHiddenFileOrFolder = (url) => {
      const reHidden = /\/\..+$/i;
      return url.toString().match(reHidden);
    }

    const parentFolder = (url) => {
      // Only add the first slash if the URL doesn't have it at the end
      const append = (url.endsWith('/') ? '../' : '/../');
      const parentUrl = new URL(url + append).toString();
      return parentUrl;
    }

    const urlToFoldername = (url) => {
      var pieces = url.split('/');
      return pieces[pieces.length - 2]; // Return piece before final `/`
    }

    const urlToFilename = (url) => {
      const re = /\/([^/]+)$/;
      const parts = re.exec(url);
      return (parts && parts.length > 1 ? parts[1] : url);
    }

    // Parses each node's metadata by running a function on each entry
    const linkToMetadata = async (node, server) => {
      return (
        typeof servers[server] === 'function' ?
          servers[server](node) :
          {}
      );
    }

    const getHeaderData = async (url) => {
      if (!url) return {};

      try {
        const res = await fetch(url);
        const h = res.headers;
        return h;
      } catch (e) {
        console.warn(e);
        return new Headers();
      }
    }

    const getServer = async (url) => {
      const headers = await getHeaderData(url);

      if (isNginx(headers)) {
        return 'nginx';
      } else if (isApache(headers)) {
        return 'apache';
      } else if (isIIS(headers)) {
        return 'iis';
      } else if (isDeno(headers)) {
        return 'deno';
      }

      return 'generic';
    }

    const isServer = (server) => (headers) => {
      if (!headers.get('Server')) return false;

      return headers.get('Server').toString().toLowerCase().includes(server.toLowerCase());
    }
    const isApache = isServer('Apache');
    const isIIS = isServer('IIS');
    const isNginx = isServer('Nginx');
    const isDeno = (headers) => {
      return (
        Array.from(headers.keys()).length === 2 &&
        headers.has('content-length') &&
        headers.has('content-type')
        );
    };

    const servers = {
      apache: (node) => {
        const metadata = { date: undefined, size: undefined };

        if (!node.parentNode || !node.parentNode.parentNode) return metadata;

        const row = node.parentNode.parentNode;

        const dateNode = row.querySelector('td:nth-of-type(3)');
        if (dateNode) {
          const dateRe = /(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})/g;
          const dateResults = dateRe.exec(dateNode.textContent);

          if (dateResults) {
            const d =     (toInteger(dateResults[1]) >= 0 ? toInteger(dateResults[1]) : undefined);
            const m =     (isString(dateResults[2])       ? dateResults[2] : undefined);
            const y =     (toInteger(dateResults[3]) >= 0 ? toInteger(dateResults[3]) : undefined);
            const hours = (toInteger(dateResults[4]) >= 0 ? toInteger(dateResults[4]) : undefined);
            const mins =  (toInteger(dateResults[5]) >= 0 ? toInteger(dateResults[5]) : undefined);
            metadata.date = new Date(`${m}-${d}, ${y} ${hours}:${mins}:00`);
          }
        }

        const sizeNode = row.querySelector('td:nth-of-type(4)');

        if (sizeNode) {
          const sizeRe = /(\d+)(\w)?/g;
          const sizeResults = sizeRe.exec(sizeNode.textContent);

          if (sizeResults) {
            const val = toInteger(sizeResults[1]);
            const unit = (isUndefined(sizeResults[2]) ? 'B' : sizeResults[2]);

            const factor = {
              B: 0, K: 1, M: 2, G: 3, T: 4
            }

            metadata.size = Math.floor(
              val * Math.pow(1024, factor[unit])
            );
          }
        }

        return metadata;
      },
      nginx: (node) => {
        const metadata = { date: undefined, size: undefined };

        const metadataNode = node.nextSibling;
        if (!metadataNode) return metadata;

        const text = metadataNode.textContent;
        const re = /(\d{2})-(\w{3})-(\d{4})\s(\d{2}):(\d{2})\s+(\d+)?/g;
        const results = re.exec(text);

        if (!results) return metadata;
        const d =     (toInteger(results[1]) >= 0 ? toInteger(results[1]) : undefined);
        const m =     (isString(results[2])       ? results[2] : undefined);
        const y =     (toInteger(results[3]) >= 0 ? toInteger(results[3]) : undefined);
        const hours = (toInteger(results[4]) >= 0 ? toInteger(results[4]) : undefined);
        const mins =  (toInteger(results[5]) >= 0 ? toInteger(results[5]) : undefined);
        metadata.date = new Date(`${m}-${d}, ${y} ${hours}:${mins}:00`);

        metadata.size = (isNumber(toInteger(results[6])) ? toInteger(results[6]) : undefined);

        return metadata;
      },
      iis: (node) => {
        const metadata = { date: undefined, size: undefined };

        const metadataNode = node.previousSibling;
        if (!metadataNode) return metadata;

        const re = /(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{1,2})\s(AM|PM)\s+(\d+)?/i;
        const text = metadataNode.textContent;
        const results = re.exec(text);
        if (!results) return metadata;

        const d =     (toInteger(results[1]) >= 0 ? toInteger(results[1]) : undefined);
        const m =     (isString(results[2])       ? results[2] : undefined);
        const y =     (toInteger(results[3]) >= 0 ? toInteger(results[3]) : undefined);
        const hours = (toInteger(results[4]) >= 0 ? toInteger(results[4]) : undefined);
        const mins =  (toInteger(results[5]) >= 0 ? toInteger(results[5]) : undefined);
        metadata.date = new Date(`${m}-${d}, ${y} ${hours}:${mins}:00`);

        metadata.size = (isNumber(toInteger(results[7])) ? toInteger(results[7]) : undefined);

        return metadata;
      },
      deno: (node) => {
        const row = node.parentElement.parentElement;
        const sizeString = row.querySelector('td:nth-of-type(2)').innerText;
        const sizeRe = /([\d\.]+)(\w)/;

        const parsed = sizeRe.exec(sizeString);
        if (!parsed) return {};

        const value = toNumber(parsed[1]);
        if (!isNumber(value)) return {};
        
        const unit = parsed[2].trim();
        const units = {
          B: 1,
          K: 1000,
          M: 1_000_000,
          G: 1_000_000_000,
          T: 1_000_000_000_000
        }

        const size = value * units[unit];
        const metadata = { size };

        return metadata;
      },
      fallback: (node) => {
        const metadata = { date: undefined, size: undefined };

        const metadataNode = node.nextSibling;
        if (!metadataNode) return metadata;

        const text = metadataNode.textContent;
        const re = /(\d{2})-(\w{3})-(\d{4})\s(\d{2}):(\d{2})\s+(\d+)?/g;
        const results = re.exec(text);

        if (!results) return metadata;
        const d =     (toInteger(results[1]) >= 0 ? toInteger(results[1]) : undefined);
        const m =     (isString(results[2])       ? results[2] : undefined);
        const y =     (toInteger(results[3]) >= 0 ? toInteger(results[3]) : undefined);
        const hours = (toInteger(results[4]) >= 0 ? toInteger(results[4]) : undefined);
        const mins =  (toInteger(results[5]) >= 0 ? toInteger(results[5]) : undefined);
        metadata.date = new Date(`${m}-${d}, ${y} ${hours}:${mins}:00`);

        metadata.size = (isNumber(toInteger(results[6])) ? toInteger(results[6]) : undefined);

        return metadata;
      },
    }

    const removeDuplicates = (items) => {
      const o = {};

      items.forEach((item) => {
        const key = item.href;
        o[key] = item;
      });

      return Object.values(o);
    }

    const getLinksFromFrame = async (frame, baseUrl) => {
      const server = await getServer(baseUrl) || 'generic';

      var query;

      switch (server) {
        case 'apache':
          query = 'td a';

          if ([...frame.contentDocument.querySelectorAll(query)].length === 0) {
            query = 'a'; // Fallback to any `<a>` if none are found
          }

          break;
        case 'deno':
        case 'iis':
        case 'nginx':
        default:
          query = 'a';
          break;
      }

      const links = removeDuplicates([...frame.contentDocument.querySelectorAll(query)]);
      const folders = [];
      const files = [];

      for (var i = 0; i < links.length; i++) {
        const link = links[i];
        const url = link.toString();
        const type = urlType(url);

        var target;
        const metadata = await linkToMetadata(link, server);
        const res = { url };

        switch (type) {
          case 'folder':
            res.name = urlToFoldername(url);
            res.type = 'child';
            target = folders;
            break;
          case 'file':
            res.name = urlToFilename(url);
            target = files;
            break;
        }

        if (metadata.size) res.size = metadata.size;
        if (metadata.date) res.date = metadata.date;

        if (target === folders) {
          if (server === 'apache' && !metadata.date || // Apache never has a date for parent folders
            url === '../' ||
            url === parentFolder(baseUrl)
          ) {
            res.type = 'parent';
          } else if (url === '/') {
            res.type = 'root';
          }
        }

        if (target) target.push(res);
      }

      // Populate a parent folder if no folders are listed
      if (folders.length === 0) {
        const parent = {
          type: 'parent',
          url: parentFolder(baseUrl),
          name: 'Parent'
        }

        folders.push(parent);
      }

      return { server, folders, files };
    }

    const folderApiRequest = async (url) => {
      const $frame = document.createElement('iframe');
      $frame.style.visibility = 'hidden';
      $frame.style.overflow = 'hidden';
      $frame.style.width = 0;
      $frame.style.height = 0;        
      document.querySelector('body').appendChild($frame); // `<iframe>` must be appended before setting `src` or iOS calls load on `appendChild` as well

      const promise = new Promise((resolve, reject) => {
        $frame.addEventListener('error', reject, false);

        $frame.addEventListener('load', async () => {
          const links = await getLinksFromFrame($frame, url);
          $frame.parentElement.removeChild($frame);
          resolve(links);
        }, false);
      });

      $frame.src = url; // Setting src starts loading

      return promise;
    }

    const toNumber = (d) => +d;
    const toInteger = (d) => parseInt(d, 10);
    const is = (type) => (v) => typeof v === type;
    const isNumber = is('number');
    const isString = is('string');
    const isUndefined = is('undefined');

    global.folderApiRequest = folderApiRequest;
  
