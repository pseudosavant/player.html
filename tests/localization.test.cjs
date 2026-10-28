const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');

const project = path.resolve(__dirname, '..');
const origin = 'https://player.test';
const read = file => fs.readFileSync(path.join(project, file), 'utf8');
const english = JSON.parse(read('src/locales/en.json'));
const chinese = JSON.parse(read('src/locales/zh-Hans.json'));
const allCatalogs = fs.readdirSync(path.join(project, 'src/locales')).filter(file => file.endsWith('.json')).map(file => JSON.parse(read('src/locales/' + file)));
const supportedLocales = ['en', 'es', 'fr', 'de', 'pt', 'ja', 'zh-Hans', 'zh-Hant', 'hi', 'ar', 'it', 'ko', 'nl', 'pl', 'fa', 'he', 'tr'];
let browser;
before(async () => {
  browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'chrome' } : {}) });
});
after(async () => { await browser?.close(); });

function runtime(languages = ['en-US'], fallback = 'en', saved = 'auto', mutate) {
  const catalogs = structuredClone([english, chinese, ...allCatalogs.filter(item => !['en', 'zh-Hans'].includes(item.locale))]);
  mutate?.(catalogs);
  const nodes = catalogs.map(catalog => ({ dataset: { locale: catalog.locale, name: catalog.name, dir: catalog.dir }, textContent: JSON.stringify(catalog) }));
  const events = new EventTarget();
  const context = vm.createContext({
    Intl, Event, Map, navigator: { languages, language: languages[0] },
    document: { documentElement: {}, querySelectorAll: selector => selector === 'script[data-locale]' ? nodes : [] },
    window: Object.assign(events, { storageRetrieve: () => saved, setCSSVariableString: () => {} })
  });
  vm.runInContext(read('src/js/i18n.js'), context);
  context.window.i18n.initialize(fallback);
  return { i18n: context.window.i18n, context };
}

test('all 17 locale catalogs have complete keys, valid plurals, and identical placeholders', () => {
  assert.deepEqual(allCatalogs.map(item => item.locale).sort(), [...supportedLocales].sort());
  const placeholders = text => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
  for (const catalog of allCatalogs) {
    assert.deepEqual(Object.keys(catalog.messages).sort(), Object.keys(english.messages).sort(), catalog.locale);
    assert.equal(catalog.dir, ['ar', 'fa', 'he'].includes(catalog.locale) ? 'rtl' : 'ltr');
    for (const [key, original] of Object.entries(english.messages)) {
      const translated = catalog.messages[key];
      assert.equal(typeof translated, typeof original, `${catalog.locale}: ${key}`);
      const variants = typeof original === 'object' ? Object.keys(translated) : [null];
      if (typeof original === 'object') {
        for (const category of new Intl.PluralRules(catalog.locale).resolvedOptions().pluralCategories) assert.ok(translated[category], `${catalog.locale}: ${key}.${category}`);
      }
      for (const variant of variants) {
        const en = variant ? original.other : original;
        const text = variant ? translated[variant] : translated;
        assert.ok(text?.trim(), key);
        assert.deepEqual(placeholders(text), placeholders(en), `${catalog.locale}: ${key}`);
      }
    }
  }
});

test('reviewed translations distinguish font styles, saved progress, and setting states', () => {
  const fonts = {
    en: 'Casual', es: 'Informal', fr: 'Décontractée', de: 'Informell', pt: 'Informal',
    ja: 'カジュアル', 'zh-Hans': '休闲风格', 'zh-Hant': '輕鬆風格', hi: 'अनौपचारिक',
    ar: 'غير رسمي', it: 'Informale', ko: '캐주얼', nl: 'Informeel', pl: 'Swobodna',
    fa: 'غیررسمی', he: 'לא רשמי', tr: 'Gündelik'
  };
  for (const catalog of allCatalogs) assert.equal(catalog.messages['subtitle.font.casual'], fonts[catalog.locale], catalog.locale);
  const messages = code => allCatalogs.find(catalog => catalog.locale === code).messages;
  assert.equal(messages('tr')['ui.on'], 'açık');
  assert.equal(messages('tr')['ui.off'], 'kapalı');
  assert.equal(messages('nl')['ui.in-progress'], 'Gedeeltelijk afgespeeld');
  assert.equal(messages('ko')['ui.in-progress'], '일부 재생');
  assert.equal(messages('ar')['ui.this-media-has-been-played'], 'هذه الوسائط مسجّلة كمكتملة');
  assert.equal(messages('fa')['ui.this-media-has-been-played'], 'این رسانه به‌عنوان تکمیل‌شده ثبت شده است');
  assert.equal(messages('he')['ui.this-media-has-been-played'], 'מדיה זו מסומנת כהושלמה');
  for (const shown of [0, 1, 2]) {
    const { i18n } = runtime(['he']);
    assert.equal(i18n.t('library.showing', { shown, total: 3 }).replace(/[\u2068\u2069]/g, ''), `תוצאות מוצגות: ${shown} מתוך 3`);
  }
});

test('shared source corrections preserve action scope and diagnostic uncertainty in every locale', () => {
  assert.equal(english.messages['ui.go-back-10-seconds'], 'Seek backward');
  assert.equal(english.messages['ui.go-forward-30-seconds'], 'Seek forward');
  assert.equal(english.messages['ui.go-to-previous-folder'], 'Go to parent folder');
  assert.equal(english.messages['info.corsError.name'], 'Metadata request error');
  assert.match(english.messages['ui.add-all-files-from-current-folder'], /configured depth\. Library filters do not limit/);
  assert.match(english.messages['settings.poster-upload.desc'], /stored in this browser\./);
  assert.match(english.messages['settings.poster-upload.desc'], /Raster images.*SVG images remain unchanged\./);
  assert.match(english.messages['info.totalVideoFrames.desc'], /displayed and dropped/);
  assert.match(english.messages['info.encodedBodySize.desc'], /before HTTP content decoding/);
  assert.match(english.messages['info.corsStatus.desc'], /Failure does not identify the cause/);
  for (const { locale, messages } of allCatalogs) {
    assert.equal(messages['ui.toggle-subtitles'], messages['ui.select-subtitles'], locale);
    for (const key of ['ui.go-back-10-seconds', 'ui.go-forward-30-seconds']) assert.doesNotMatch(messages[key], /\p{N}/u, `${locale}: fixed seek interval`);
    assert.match(messages['info.corsStatus.desc'], /HEAD/, locale);
    assert.match(messages['info.corsError.desc'], /HEAD/, locale);
    assert.doesNotMatch(messages['info.corsError.name'], /CORS/, locale);
    assert.match(messages['info.encodedBodySize.desc'], /HTTP.*Timing-Allow-Origin/, locale);
    assert.match(messages['info.totalVideoFrames.desc'], /getVideoPlaybackQuality\(\)/, locale);
    assert.match(messages['settings.poster-upload.desc'], /SVG/, locale);
  }
});

test('approved labels preserve the original Add All casing', () => {
  const labels = {
    en: ['Subtitle Tracks', 'Choose image'], es: ['Pistas de subtítulos', 'Elegir imagen'],
    fr: ['Pistes de sous-titres', 'Choisir une image'], de: ['Untertitelspuren', 'Bild auswählen'],
    pt: ['Faixas de legendas', 'Escolher imagem'], ja: ['字幕トラック', '画像を選択'],
    'zh-Hans': ['字幕轨道', '选择图片'], 'zh-Hant': ['字幕軌', '選擇圖片'],
    hi: ['उपशीर्षक ट्रैक', 'इमेज चुनें'], ar: ['مسارات الترجمة', 'اختيار صورة'],
    it: ['Tracce dei sottotitoli', 'Scegli immagine'], ko: ['자막 트랙', '이미지 선택'],
    nl: ['Ondertitelsporen', 'Afbeelding kiezen'], pl: ['Ścieżki napisów', 'Wybierz obraz'],
    fa: ['مسیرهای زیرنویس', 'انتخاب تصویر'], he: ['רצועות כתוביות', 'בחירת תמונה'],
    tr: ['Altyazı parçaları', 'Görüntü seç']
  };
  for (const { locale, messages } of allCatalogs) {
    assert.deepEqual([messages['info.subtitles.name'], messages['ui.upload']], labels[locale], locale);
  }
  assert.equal(english.messages['ui.add-all'], 'Add All');
  assert.match(english.messages['ui.add-all-files-from-current-folder'], /configured depth\. Library filters do not limit/);
});

test('language resolution respects explicit choice, browser ordering, config, and script', () => {
  const cases = [
    [['zh-CN'], 'en', 'auto', 'zh-Hans'],
    [['zh-SG'], 'en', 'auto', 'zh-Hans'],
    [['zh-Hans-HK'], 'en', 'auto', 'zh-Hans'],
    [['zh'], 'en', 'auto', 'zh-Hans'],
    [['zh-TW'], 'en', 'auto', 'zh-Hant'],
    [['zh-HK'], 'en', 'auto', 'zh-Hant'],
    [['zh-MO'], 'en', 'auto', 'zh-Hant'],
    [['zh-Hant-CN'], 'en', 'auto', 'zh-Hant'],
    [['xx', 'zh-CN', 'en-US'], 'en', 'auto', 'zh-Hans'],
    [['en-GB', 'zh-CN'], 'zh-Hans', 'auto', 'en'],
    [['xx'], 'zh-Hans', 'auto', 'zh-Hans'],
    [['xx'], 'invalid_locale', 'auto', 'en'],
    [['fr-CA'], 'en', 'auto', 'fr'],
    [['pt-BR'], 'en', 'auto', 'pt'],
    [['pt-PT'], 'en', 'auto', 'pt'],
    [['ar-EG'], 'en', 'auto', 'ar'],
    [['fa-IR'], 'en', 'auto', 'fa'],
    [['iw-IL'], 'en', 'auto', 'he'],
    [['ar-Latn'], 'en', 'auto', 'en'],
    [['hi-Latn'], 'en', 'auto', 'en'],
    [['zh-CN'], 'zh-Hans', 'en', 'en'],
    [['en-US'], 'en', 'zh-Hans', 'zh-Hans'],
    [['zh-CN'], 'en', 'invalid_locale', 'zh-Hans']
  ];
  for (const [languages, fallback, saved, expected] of cases) {
    assert.equal(runtime(languages, fallback, saved).i18n.locale, expected, JSON.stringify({ languages, fallback, saved }));
  }
  const { i18n, context } = runtime(['en-US']);
  context.navigator.languages = ['zh-CN'];
  context.window.dispatchEvent(new Event('languagechange'));
  assert.equal(i18n.locale, 'zh-Hans');
  i18n.setLanguage('en');
  context.window.dispatchEvent(new Event('languagechange'));
  assert.equal(i18n.locale, 'en');
  assert.equal(context.document.documentElement.dir, 'ltr');
  assert.equal(context.document.documentElement.lang, 'en');
  for (const code of supportedLocales) {
    const resolved = runtime([code]).i18n;
    assert.equal(resolved.locale, code);
  }
});

test('Arabic, Hebrew, and Polish use their own plural categories and isolate RTL substitutions', () => {
  for (const code of ['ar', 'he', 'pl']) {
    const { i18n } = runtime([code]);
    const messages = allCatalogs.find(item => item.locale === code).messages;
    for (const count of [0, 1, 2, 3, 5, 11, 21, 22, 100, 1.5]) {
      const form = new Intl.PluralRules(code).select(count);
      const total = i18n.number(count);
      const value = i18n.t('library.results', { count, total });
      assert.equal(value.replace(/[\u2068\u2069]/g, ''), messages['library.results'][form].replace('{total}', total));
      if (code !== 'pl') assert.ok(value.includes(`\u2068${total}\u2069`));
    }
  }
  assert.equal(runtime(['pl']).i18n.t('library.results', { count: 22, total: '22' }), '22 wyniki');
  assert.equal(runtime(['pl']).i18n.t('library.results', { count: 5, total: '5' }), '5 wyników');
});

test('English message fallback uses English plural rules and substitutions are text only', () => {
  const { i18n } = runtime(['zh-CN'], 'en', 'auto', catalogs => {
    delete catalogs[1].messages['library.results'];
    delete catalogs[1].messages['ui.open'];
  });
  assert.equal(i18n.t('ui.open'), 'Open');
  assert.equal(i18n.t('library.results', { count: 1, total: '1' }), '1 result');
  assert.equal(i18n.t('library.results', { count: 2, total: '2' }), '2 results');
  assert.equal(i18n.t('missing.message'), 'missing.message');
  assert.equal(i18n.t('toString'), 'toString');
  assert.equal(i18n.t('cloud.open', { provider: '<img onerror=alert(1)>' }), '从 <img onerror=alert(1)> 打开');
  assert.equal(i18n.number(1234.5), new Intl.NumberFormat('zh-Hans').format(1234.5));
});

test('build rejects missing keys, mismatched placeholders, and invalid plural catalogs', () => {
  const script = `import build, json
original = build.read_text
def check(mode):
    def read(path):
        text = original(path)
        if path.name != 'zh-Hans.json': return text
        data = json.loads(text)
        if mode == 'missing': del data['messages']['library.name']
        if mode == 'placeholder': data['messages']['library.resume'] = '{wrong}'
        if mode == 'plural': data['messages']['library.results'] = {'one': '{total}'}
        if mode == 'structure': data['messages']['library.results'] = '{total}'
        if mode == 'empty': data['messages']['library.name'] = ''
        return json.dumps(data)
    build.read_text = read
    try: build.inline_locales('<!-- inline-locales -->')
    except ValueError: return
    raise AssertionError(mode)
for mode in ['missing', 'placeholder', 'plural', 'structure', 'empty']: check(mode)
`;
  execFileSync('python', ['-B', '-c', script], { cwd: project });
});

test('embedded locale JSON escapes HTML delimiters without changing translations', () => {
  const script = `import build, json
original = build.read_text
def read(path):
    data = json.loads(original(path))
    data['messages']['library.name'] = '</script><script>alert(1)</script> & > <'
    return json.dumps(data)
build.read_text = read
print(build.inline_locales('<!-- inline-locales -->'))
`;
  const html = execFileSync('python', ['-B', '-X', 'utf8', '-c', script], { cwd: project, encoding: 'utf8' });
  assert.equal(html.includes('<script>alert'), false);
  assert.equal((html.match(/<script /g) || []).length, supportedLocales.length);
  for (const match of html.matchAll(/<script [^>]+>(.*?)<\/script>/gs)) {
    assert.equal(JSON.parse(match[1]).messages['library.name'], '</script><script>alert(1)</script> & > <');
  }
});

async function openPlayer(t, options = {}) {
  const context = await browser.newContext({ locale: options.locale || 'en-US', viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  const errors = [];
  const requests = [];
  t.after(async () => {
    await context.close();
    assert.deepEqual(errors, [], 'Unexpected browser exceptions');
  });
  await context.addInitScript(({ saved, languages }) => {
    if (window.top !== window) return;
    if (saved && localStorage.getItem('setting-language') === null) localStorage.setItem('setting-language', saved);
    if (languages) Object.defineProperty(navigator, 'languages', { get: () => languages });
    window.__parsedLocales = [];
    const parse = JSON.parse;
    JSON.parse = function (...args) {
      const result = parse.apply(this, args);
      if (result?.locale && result?.messages) window.__parsedLocales.push(result.locale);
      return result;
    };
  }, { saved: options.saved, languages: options.languages });
  const variant = options.variant || 'player.html';
  const exports = 'window.__i18nTest = { settings, renderFileinfo, renderPlaylist, renderSubtitleTranscriptControls, subtitleTranscriptState, getLibraryResumeLabel, setOpenUrlError, registerLocalFolder, createLocalLinks, getLocalSession, hashState, getMediaUrl, actionPlay, getProgressBarRelative, toggleModal }; main();';
  let html = read('dist/' + variant).replace(/\bmain\(\);(?=\s*<\/script>)/, exports);
  assert.ok(html.includes('window.__i18nTest ='));
  if (options.mutateHtml) html = options.mutateHtml(html);
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    requests.push({ url: url.href, method: route.request().method(), range: route.request().headers().range });
    if (url.origin !== origin) return route.abort();
    if (url.pathname === '/player.html.json') return route.fulfill({ json: {
      options: { startLocation: '/media/', defaultLanguage: options.defaultLanguage || 'en', settings: { thumbnailing: false, animate: false, 'search-depth': 1 } }
    } });
    if (url.pathname.endsWith('.html')) return route.fulfill({ contentType: 'text/html', body: html });
    if (url.pathname === '/media/') return route.fulfill({ contentType: 'text/html', body: '<h1>Index of /media/</h1><table><tr><td><a href="../">../</a></td></tr><tr><td><a href="Sub/">Sub/</a></td></tr><tr><td><a href="Sample.webm">Sample.webm</a></td></tr><tr><td><a href="Sample.vtt">Sample.vtt</a></td></tr></table>' });
    if (url.pathname === '/media/Sub/') return route.fulfill({ contentType: 'text/html', body: '<ul><li><a href="../">../</a></li></ul>' });
    if (url.pathname === '/media/Sample.webm') {
      const body = fs.readFileSync(path.join(project, 'videos/subtitles-auto-vtt.webm'));
      const range = /bytes=(\d+)-(\d*)/.exec(route.request().headers().range || '');
      if (range) {
        const start = Number(range[1]);
        const end = range[2] ? Math.min(Number(range[2]), body.length - 1) : body.length - 1;
        return route.fulfill({ status: 206, contentType: 'video/webm', headers: { 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${start}-${end}/${body.length}` }, body: body.subarray(start, end + 1) });
      }
      return route.fulfill({ contentType: 'video/webm', headers: { 'Accept-Ranges': 'bytes' }, body });
    }
    return route.fulfill({ status: 404, body: 'Not found' });
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin + '/' + variant);
  await page.waitForFunction(() => document.querySelector('.file .label')?.textContent === 'Sample' && !document.querySelector('.links-search-input').disabled);
  return { page, requests, context };
}

for (const variant of ['player.html', 'player.min.html']) {
  test(`${variant}: corrected source copy renders and Turkish switch labels fit in both states`, async t => {
    const { page } = await openPlayer(t, { variant });
    assert.equal(await page.locator('.btn-subtitles').getAttribute('title'), 'Select subtitles');
    assert.equal(await page.locator('.help [data-i18n="ui.go-back-10-seconds"]').textContent(), 'Seek backward');
    assert.equal(await page.locator('.help [data-i18n="ui.go-forward-30-seconds"]').textContent(), 'Seek forward');
    assert.equal(await page.locator('.help [data-i18n="ui.go-to-previous-folder"]').textContent(), 'Go to parent folder');
    await page.evaluate(() => {
      window.__i18nTest.renderFileinfo({ subtitles: 2, corsError: 'TypeError: Failed to fetch', encodedBodySize: 1024, totalVideoFrames: 12 });
      window.__i18nTest.renderPlaylist();
    });
    assert.equal(await page.locator('.fileinfo .corsError .key').textContent(), 'Metadata request error');
    assert.equal(await page.locator('.fileinfo .corsError .value').textContent(), 'TypeError: Failed to fetch');
    assert.equal(await page.locator('.fileinfo .subtitles .key').textContent(), 'Subtitle Tracks');
    assert.equal(await page.locator('.fileinfo .subtitles .value').textContent(), '2');
    assert.match(await page.locator('.fileinfo .encodedBodySize .key').getAttribute('title'), /before HTTP content decoding/);
    assert.match(await page.locator('.fileinfo .totalVideoFrames .key').getAttribute('title'), /displayed and dropped/);
    assert.match(await page.locator('.btn-playlist-add-folder').getAttribute('title'), /Library filters do not limit/);
    assert.equal((await page.locator('.btn-playlist-add-folder').textContent()).trim(), 'Add All');
    await page.click('.btn-settings');
    assert.equal((await page.locator('.setting-poster-upload').textContent()).trim(), 'Choose image');
    assert.match(await page.locator('.setting-poster-upload').evaluate(node => node.closest('.setting-item').title), /SVG images remain unchanged/);
    await page.selectOption('.setting-language', 'tr');
    for (const width of [375, 320]) {
      await page.setViewportSize({ width, height: 740 });
      for (const checked of [false, true]) {
        await page.locator('.setting-blur').setChecked(checked);
        await page.waitForFunction(checked => {
          const node = document.querySelector('.setting-blur');
          const style = getComputedStyle(node, '::after');
          const x = style.transform === 'none' ? 0 : new DOMMatrixReadOnly(style.transform).m41;
          const left = parseFloat(style.left) + x;
          const right = node.clientWidth - left - parseFloat(style.width);
          return node.checked === checked && left >= 1 && right >= 1 && (checked ? right : left) <= 3;
        }, checked);
        const geometry = await page.locator('.setting-blur').evaluate(node => {
          const style = getComputedStyle(node, '::after');
          const context = document.createElement('canvas').getContext('2d');
          context.font = style.font;
          return {
            text: window.i18n.t(node.checked ? 'ui.on' : 'ui.off'), content: style.content,
            labelWidth: context.measureText(window.i18n.t(node.checked ? 'ui.on' : 'ui.off')).width,
            available: parseFloat(style.width) - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
            overflow: node.closest('.setting-item').scrollWidth > node.closest('.setting-item').clientWidth
          };
        });
        assert.equal(geometry.text, checked ? 'açık' : 'kapalı');
        assert.ok(geometry.content.includes(geometry.text));
        assert.ok(geometry.labelWidth <= geometry.available, `${variant}: Turkish label clipped at ${width}px`);
        assert.equal(geometry.overflow, false);
        if (process.env.PLAYER_SCREENSHOT_DIR && width === 320) await page.screenshot({ path: path.join(process.env.PLAYER_SCREENSHOT_DIR, `locale-tr-${variant}-settings-${checked ? 'on' : 'off'}.png`), fullPage: true });
      }
    }
    await page.selectOption('.setting-language', 'en');
    assert.equal(await page.locator('.setting-blur').evaluate(node => getComputedStyle(node).getPropertyValue('--width').trim()), '3.5rem');
  });

  test(`${variant}: automatic Chinese localizes controls, settings, tooltips, and dynamic UI`, async t => {
    const { page, requests } = await openPlayer(t, { variant, locale: 'zh-CN' });
    assert.equal(await page.locator('html').getAttribute('lang'), 'zh-Hans');
    assert.equal(await page.locator('.library-tab-library').textContent(), '媒体库');
    assert.equal(await page.locator('.library-tab-continue > span').first().textContent(), '继续播放');
    assert.equal(await page.locator('.library-continue-count').count(), 1);
    assert.equal(await page.locator('.btn-settings').getAttribute('aria-label'), '打开设置');
    assert.equal(await page.locator('.settings').getAttribute('aria-label'), '设置');
    assert.equal(await page.locator('html').evaluate(node => node.style.getPropertyValue('--label-on')), "'开'");
    assert.equal(await page.locator('.library-heading-name').textContent(), '名称');
    assert.equal(await page.locator('.links-search-input').getAttribute('placeholder'), '搜索媒体文件');
    assert.equal(await page.locator('.btn-add-to-playlist').last().getAttribute('title'), '添加到播放列表');
    assert.equal(await page.locator('.watched-icon').getAttribute('title'), chinese.messages['ui.this-media-has-been-played']);
    assert.equal(await page.locator('.folder').first().locator('.label').textContent(), '上级文件夹');
    assert.equal(await page.locator('.setting-language option:checked').textContent(), '自动');
    assert.deepEqual(await page.evaluate(() => window.__parsedLocales), ['en', 'zh-Hans']);
    assert.equal(requests.some(request => /\/locales\//.test(request.url)), false);
    await page.locator('.links-search-input').fill('Sample');
    await page.waitForFunction(() => document.querySelector('.links-search-results-count').textContent === '1 个结果');
    await page.evaluate(() => {
      const api = window.__i18nTest;
      api.renderFileinfo({ name: 'Sample.webm', url: 'https://player.test/media/Sample.webm', videoFrameCallbackSupport: true, rangeRequests: 'Supported (HTTP 206)', encodedBodySize: 1024 });
      api.renderPlaylist();
    });
    assert.equal(await page.locator('.fileinfo .name .value').textContent(), 'Sample.webm');
    assert.equal(await page.locator('.fileinfo .rangeRequests .value').textContent(), '支持（HTTP 206）');
    assert.equal(await page.locator('.fileinfo .videoFrameCallbackSupport .value').textContent(), '是');
    assert.match(await page.locator('.fileinfo .encodedBodySize .key').getAttribute('title'), /Timing-Allow-Origin/);
    assert.equal(await page.locator('.playlist-empty').textContent(), '播放列表为空');
    const unknownBindings = await page.evaluate(keys => [...document.querySelectorAll('[data-i18n], [data-i18n-title], [data-i18n-aria-label], [data-i18n-placeholder], [data-i18n-content]')].flatMap(node => [...node.attributes].filter(attr => /^data-i18n(?:-(?:title|aria-label|placeholder|content))?$/.test(attr.name) && !keys.includes(attr.value)).map(attr => attr.value)), Object.keys(english.messages));
    assert.deepEqual(unknownBindings, []);
    assert.match(await page.evaluate(() => window.__i18nTest.getLibraryResumeLabel({ position: 120, duration: 600 })), /从 00:02:00 继续/);
    await page.click('.btn-settings');
    assert.equal(await page.locator('.settings-section-heading').first().textContent(), '界面');
    assert.equal(await page.locator('.setting-language').getAttribute('aria-label'), '语言');
    assert.match(await page.locator('.setting-language').locator('..').locator('..').locator('..').getAttribute('title'), /浏览器/);
  });

  test(`${variant}: live choice persists without resetting media, queue, subtitles, or local handles`, async t => {
    const { page, requests } = await openPlayer(t, { variant });
    assert.deepEqual(await page.evaluate(() => window.__parsedLocales), ['en'], 'Inactive catalogs should not be parsed');
    await page.locator('.file').click();
    await page.waitForFunction(() => document.querySelector('.player').readyState >= 2);
    await page.evaluate(async () => {
      const api = window.__i18nTest;
      const player = document.querySelector('.player');
      player.pause();
      player.currentTime = 5;
      if (player.seeking) await new Promise(resolve => player.addEventListener('seeked', resolve, { once: true }));
      player.playbackRate = 1.5;
      player.volume = 0.4;
      window.__originalPlayer = player;
      window.__originalSource = player.src;
      window.__originalQueue = window.app.playlist;
      window.__mediaLoadCount = 0;
      player.addEventListener('loadstart', () => window.__mediaLoadCount++);
      window.__localUrl = api.registerLocalFolder({ name: 'Local', kind: 'directory', async *entries() {} }).rootUrl;
      api.subtitleTranscriptState.status = 'ready';
      api.subtitleTranscriptState.cueCount = 1;
      api.subtitleTranscriptState.query = 'original';
      api.subtitleTranscriptState.results = [{ start: 5, text: '<b>original subtitle text</b>' }];
      api.renderSubtitleTranscriptControls();
      api.setOpenUrlError('openUrl.required');
      api.renderFileinfo({ name: 'Sample.webm', rangeRequests: 'Supported (HTTP 206)', date: '2026-10-27T12:00:00Z' });
      api.renderPlaylist();
    });
    const before = requests.length;
    await page.click('.btn-settings');
    await page.selectOption('.setting-language', 'zh-Hans');
    await page.waitForFunction(() => document.querySelector('html').lang === 'zh-Hans');
    assert.deepEqual(await page.evaluate(() => window.__parsedLocales), ['en', 'zh-Hans']);
    assert.deepEqual(await page.evaluate(() => {
      const player = document.querySelector('.player');
      return {
        same: player === window.__originalPlayer && player.src === window.__originalSource,
        queue: window.app.playlist === window.__originalQueue,
        currentTime: player.currentTime, rate: player.playbackRate, volume: player.volume,
        paused: player.paused, loads: window.__mediaLoadCount,
        handle: !!window.__i18nTest.getLocalSession(window.__localUrl)
      };
    }), { same: true, queue: true, currentTime: 5, rate: 1.5, volume: 0.4, paused: true, loads: 0, handle: true });
    assert.equal(await page.locator('.subtitle-transcript-text').textContent(), '<b>original subtitle text</b>');
    assert.equal(await page.locator('.subtitle-transcript-text b').count(), 0);
    assert.equal(await page.locator('.subtitle-transcript-status').textContent(), '1 条可搜索字幕');
    assert.equal(await page.locator('.open-url-error').textContent(), '请输入文件夹或媒体网址。');
    assert.equal(await page.locator('.fileinfo .rangeRequests .value').textContent(), '支持（HTTP 206）');
    assert.match(await page.locator('.fileinfo .date .value').textContent(), /2026年10月27日/);
    for (const locale of ['ar', 'fa', 'he', 'zh-Hans']) {
      await page.selectOption('.setting-language', locale);
      assert.deepEqual(await page.evaluate(() => {
        const player = document.querySelector('.player');
        return {
          same: player === window.__originalPlayer && player.src === window.__originalSource,
          queue: window.app.playlist === window.__originalQueue,
          time: player.currentTime, rate: player.playbackRate, paused: player.paused,
          loads: window.__mediaLoadCount,
          handle: !!window.__i18nTest.getLocalSession(window.__localUrl)
        };
      }), { same: true, queue: true, time: 5, rate: 1.5, paused: true, loads: 0, handle: true });
    }
    assert.equal(requests.slice(before).some(request => request.method === 'HEAD' || request.range === 'bytes=0-0'), false);
    await page.reload();
    await page.waitForFunction(() => !!document.querySelector('.setting-language'));
    assert.equal(await page.locator('html').getAttribute('lang'), 'zh-Hans');
    assert.equal(await page.locator('.setting-language').inputValue(), 'zh-Hans');
    await page.click('.btn-settings');
    await page.selectOption('.setting-language', 'auto');
    assert.equal(await page.locator('html').getAttribute('lang'), 'en');
  });

  test(`${variant}: config is a fallback and Traditional Chinese does not select Simplified`, async t => {
    for (const [options, expected] of [
      [{ locale: 'xx', defaultLanguage: 'zh-Hans' }, 'zh-Hans'],
      [{ locale: 'en-US', defaultLanguage: 'zh-Hans' }, 'en'],
      [{ locale: 'zh-TW' }, 'zh-Hant'],
      [{ locale: 'en-US', saved: 'zh-Hans' }, 'zh-Hans'],
      [{ languages: ['xx', 'zh-CN', 'en-US'] }, 'zh-Hans']
    ]) {
      const { page } = await openPlayer(t, { variant, ...options });
      assert.equal(await page.locator('html').getAttribute('lang'), expected);
      await page.close();
    }
  });
}

test('Chinese controls fit desktop and narrow portrait layouts', async t => {
  const { page } = await openPlayer(t, { locale: 'zh-CN' });
  for (const width of [1280, 375, 320]) {
    await page.setViewportSize({ width, height: width === 1280 ? 900 : 740 });
    const layout = await page.evaluate(() => {
      const controls = [...document.querySelectorAll('.library-field')].map(node => {
        const box = node.getBoundingClientRect();
        return { left: box.left, right: box.right, top: box.top };
      });
      return { controls, width: innerWidth, overflow: document.documentElement.scrollWidth > innerWidth };
    });
    assert.equal(layout.overflow, false, `Horizontal overflow at ${width}px`);
    assert.ok(layout.controls.every(control => control.left >= 0 && control.right <= layout.width));
    assert.equal(new Set(layout.controls.map(control => Math.round(control.top))).size, 1, `Filters split rows at ${width}px`);
    if (process.env.PLAYER_SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.PLAYER_SCREENSHOT_DIR, `locale-zh-${width}.png`), fullPage: true });
  }
  await page.click('.btn-settings');
  assert.ok(await page.locator('.setting-language').isVisible());
  if (process.env.PLAYER_SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.PLAYER_SCREENSHOT_DIR, 'locale-zh-settings-320.png'), fullPage: true });
});

for (const variant of ['player.html', 'player.min.html']) {
  test(`${variant}: every supported language can be detected and changed without parsing inactive catalogs`, async t => {
    const { page, requests } = await openPlayer(t, { variant });
    assert.equal(await page.locator('.setting-language option').count(), supportedLocales.length + 1);
    await page.click('.btn-settings');
    for (const catalog of allCatalogs) {
      await page.selectOption('.setting-language', catalog.locale);
      assert.equal(await page.locator('html').getAttribute('lang'), catalog.locale);
      assert.equal(await page.locator('html').getAttribute('dir'), catalog.dir);
      assert.equal(await page.locator('.settings').getAttribute('aria-label'), catalog.messages['modal.settings']);
      assert.equal(await page.locator('.btn-settings').getAttribute('aria-label'), catalog.messages['ui.open-settings']);
      assert.equal((await page.locator('.setting-poster-upload').textContent()).trim(), catalog.messages['ui.upload']);
      await page.evaluate(() => window.__i18nTest.renderFileinfo({ subtitles: 3 }));
      assert.equal(await page.locator('.fileinfo .subtitles .key').textContent(), catalog.messages['info.subtitles.name']);
    }
    assert.equal(new Set(await page.evaluate(() => window.__parsedLocales)).size, supportedLocales.length);
    assert.equal(requests.some(request => /\/locales\//.test(request.url)), false);
    await page.selectOption('.setting-language', 'en');
    assert.equal(await page.locator('html').getAttribute('dir'), 'ltr');
  });
}

for (const locale of ['ar', 'fa', 'he']) {
  test(`${locale}: RTL mirrors library and modals, isolates text, and preserves seek direction`, async t => {
    const { page } = await openPlayer(t, { locale });
    assert.deepEqual(await page.evaluate(() => window.__parsedLocales), ['en', locale]);
    await page.evaluate(() => {
      const api = window.__i18nTest;
      api.renderFileinfo({ name: 'Sample.webm', url: 'https://player.test/media/Sample.webm?name=one&part=2', readyState: 'HAVE_METADATA', duration: 120 });
      api.subtitleTranscriptState.status = 'ready';
      api.subtitleTranscriptState.cueCount = 5;
      api.subtitleTranscriptState.query = 'subtitle';
      api.subtitleTranscriptState.results = [{ start: 10, text: 'Original English subtitle 2026' }, { start: 20, text: 'نص الترجمة الأصلي' }];
      api.renderSubtitleTranscriptControls();
      document.querySelector('.file .label').textContent = 'فيلم Sample 2026.webm';
    });
    for (const width of [1280, 375, 320]) {
      await page.setViewportSize({ width, height: width === 1280 ? 900 : 740 });
      await page.click('.library-view-list');
      const geometry = await page.evaluate(() => {
        const box = selector => document.querySelector(selector).getBoundingClientRect();
        const progress = box('.progress-bar');
        const api = window.__i18nTest;
        return {
          overflow: document.documentElement.scrollWidth > innerWidth,
          labelRightOfAdd: box('.file .file-label').left > box('.file .btn-add-to-playlist').left,
          fields: [...document.querySelectorAll('.library-field')].map(node => Math.round(node.getBoundingClientRect().top)),
          seek: [api.getProgressBarRelative(progress.left), api.getProgressBarRelative(progress.right)],
          transportLtr: box('.btn-rewind').left < box('.btn-fast-forward').left,
          timerDirection: getComputedStyle(document.querySelector('.current-timestamp')).direction,
          title: document.querySelector('.file').title
        };
      });
      assert.equal(geometry.overflow, false, `${locale}: page overflow at ${width}px`);
      assert.equal(geometry.labelRightOfAdd, true);
      assert.equal(new Set(geometry.fields).size, 1);
      assert.deepEqual(geometry.seek, [0, 1]);
      assert.equal(geometry.transportLtr, true);
      assert.equal(geometry.timerDirection, 'ltr');
      assert.match(geometry.title, /\u2068https:\/\/player\.test\/media\/Sample.webm\u2069/);
      if (process.env.PLAYER_SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.PLAYER_SCREENSHOT_DIR, `locale-${locale}-${width}.png`), fullPage: true });
      await page.click('.btn-settings');
      const modal = await page.locator('.settings').boundingBox();
      assert.ok(modal.x >= -1 && modal.x + modal.width <= width + 1, `${locale}: settings outside viewport`);
      const close = await page.locator('.settings .modal-close-btn').boundingBox();
      assert.ok(close.x < modal.x + modal.width / 2, 'RTL close button should be at the inline end');
      if (process.env.PLAYER_SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.PLAYER_SCREENSHOT_DIR, `locale-${locale}-settings-${width}.png`), fullPage: true });
      await page.click('.settings .modal-close-btn');
    }
    assert.equal(await page.locator('.file .label').getAttribute('dir'), 'auto');
    assert.equal(await page.locator('.fileinfo .url .value').textContent(), 'https://player.test/media/Sample.webm?name=one&part=2');
    assert.equal(await page.locator('.fileinfo .readyState .value').textContent(), 'HAVE_METADATA');
    assert.deepEqual(await page.locator('.subtitle-transcript-text').allTextContents(), ['Original English subtitle 2026', 'نص الترجمة الأصلي']);
    assert.equal(await page.locator('.open-url-input').getAttribute('dir'), 'ltr');
    await page.evaluate(() => window.__i18nTest.toggleModal(document.querySelector('.subtitle-selection')));
    assert.equal(await page.locator('.subtitle-selection').evaluate(node => node.scrollWidth > node.clientWidth + 1), false);
    if (process.env.PLAYER_SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.PLAYER_SCREENSHOT_DIR, `locale-${locale}-subtitles-320.png`), fullPage: true });
  });
}

test('all locales keep library controls and settings inside desktop and portrait viewports', async t => {
  const { page } = await openPlayer(t);
  for (const width of [1280, 375, 320]) {
    await page.setViewportSize({ width, height: width === 1280 ? 900 : 740 });
    for (const catalog of allCatalogs) {
      await page.evaluate(code => window.i18n.setLanguage(code), catalog.locale);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${catalog.locale}: page overflow at ${width}px`);
      const fields = await page.locator('.library-field select').evaluateAll(nodes => nodes.map(node => Math.round(node.getBoundingClientRect().bottom)));
      assert.equal(new Set(fields).size, 1, `${catalog.locale}: filter controls split rows at ${width}px (${fields})`);
      if (process.env.PLAYER_SCREENSHOT_DIR && ['de', 'fr', 'hi', 'ja'].includes(catalog.locale) && width === 320) await page.screenshot({ path: path.join(process.env.PLAYER_SCREENSHOT_DIR, `locale-${catalog.locale}-${width}.png`), fullPage: true });
      await page.click('.btn-settings');
      const failures = await page.locator('.settings').evaluate(modal => {
        const bounds = modal.getBoundingClientRect();
        const rtl = getComputedStyle(modal).direction === 'rtl';
        return [...modal.querySelectorAll('.setting-item')].flatMap(row => {
          const label = row.querySelector('.key').getBoundingClientRect();
          const control = row.querySelector('.desc').getBoundingClientRect();
          const overlap = rtl ? control.right > label.left + 1 : label.right > control.left + 1;
          return row.scrollWidth > row.clientWidth + 1 || overlap || label.left < bounds.left || control.right > bounds.right ? [row.textContent.trim()] : [];
        });
      });
      assert.deepEqual(failures, [], `${catalog.locale}: settings overflow at ${width}px`);
      const toggle = await page.locator('.setting-blur').evaluate(node => {
        const style = getComputedStyle(node, '::after');
        const context = document.createElement('canvas').getContext('2d');
        context.font = style.font;
        return { width: parseFloat(style.width), text: Math.max(...['on', 'off'].map(key => context.measureText(window.i18n.t('ui.' + key)).width)) };
      });
      assert.ok(toggle.text <= toggle.width + 1, `${catalog.locale}: toggle label is too wide (${toggle.text}px > ${toggle.width}px)`);
      if (process.env.PLAYER_SCREENSHOT_DIR && ['de', 'hi', 'ja'].includes(catalog.locale) && width === 320) await page.screenshot({ path: path.join(process.env.PLAYER_SCREENSHOT_DIR, `locale-${catalog.locale}-settings-${width}.png`), fullPage: true });
      await page.click('.settings .modal-close-btn');
    }
  }
});
