    const metadata = {
      title: document.querySelector('title').textContent,
      description: document.querySelector('meta[name="description"]').content,
      type: 'video.movie',
      icon: document.querySelector('link[rel="shortcut icon"').href,
      backgroundColor: '#FF0099'
    };

    setMetadata(metadata);

    function setMetadata(metadata) {

      function setTitle(title){
        const metas = [
          'og:site_name',
          'twitter:title',
          'og:title'
        ];

        setMetas(metas, title);
      }

      function setIcon(iconDataURI) {
        const metas = [
          'twitter:image:src',
          'msapplicationTileImage',
          'og:image'
        ];

        setMetas(metas, iconDataURI);

        const links = [
          'apple-touch-icon'
        ];

        setLinks(links, iconDataURI);
      }

      function setMetas(metas, content) {
        metas.forEach(function metaFn(meta) {
          const metadata = {
            prop: meta,
            content: content
          };

          append(createMeta(metadata));
        });
      }

      function setLinks(links, href) {
        links.forEach(function linkFn(rel) {
          const link = {
            rel: rel,
            href: href
          };

          append(createLink(link));
        });
      }

      function setDescription(desc) {
        const metas = [
          'og:description',
          'twitter:description'
        ];

        setMetas(metas, desc);
      }

      function setType(type){
        const metadata = {
          prop: 'og:type',
          content: type
        };

        append(createMeta(metadata));
      }

      function createLink(linkMetadata) {
        const rel = linkMetadata.rel;
        const href = linkMetadata.href;

        const link = document.createElement('link');
        link.rel = rel;
        link.href = href;

        return link;
      }

      function createMeta(metaMetadata) {
        const prop = metaMetadata.prop;
        const content = metaMetadata.content;

        const meta = document.createElement('meta');
        meta.property = prop;
        meta.name = prop;
        meta.content = content;

        return meta;
      }

      function append(el) {
        const $head = document.querySelector('head');
        $head.appendChild(el);
      }


      if (metadata.title) {
        setTitle(metadata.title);
      }

      if (metadata.icon) {
        setIcon(metadata.icon);
      }

      if (metadata.type) {
        setType(metadata.type);
      }

      if (metadata.description) {
        setDescription(metadata.description);
      }

      if (metadata.backgroundColor) {
        append(createMeta({prop: 'msapplication-TileColor', content: metadata.backgroundColor}));
      }
    }
  
