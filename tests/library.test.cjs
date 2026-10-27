const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const origin = 'http://localhost:8877';
const root = `${origin}/media/`;
const project = path.resolve(__dirname, '..');
let browser;

before(async () => {
  browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'chrome' } : {}) });
});
after(async () => { await browser?.close(); });

const record = (name, position, updatedAt = 1, extra = {}) => ({
  id: `${root}${encodeURI(name)}`,
  url: `${root}${encodeURI(name)}`,
  source: 'http',
  title: name,
  position,
  duration: 600,
  progress: position / 600,
  completed: position >= 600,
  updatedAt,
  ...extra
});

const rows = [
  ['../', '-', '-'],
  ['Sub/', '2026-10-01 12:00', '-'],
  ['Other/', '2026-10-01 12:00', '-'],
  ['Episode 10.webm', '2026-10-22 12:00', '30M'],
  ['Episode 2.webm', '2026-10-21 12:00', '20M'],
  ['Episode 1.webm', '2026-10-20 12:00', '10M'],
  ['Audio track.mp3', '2026-10-19 12:00', '5M'],
  ['Mystery.webm', '-', '-']
];

function listing(url, entries) {
  return '<html><head><title>Index of ' + url + '</title></head><body><h1>Index of ' + url + '</h1><table>' +
    entries.map(([name, date, size]) => '<tr><td><a href="' + encodeURI(name) + '">' + name + '</a></td><td>' + date + '</td><td>' + size + '</td></tr>').join('') + '</table></body></html>';
}

async function openPlayer(t, records = [], variant = 'player.html', settings = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  const errors = [];
  const mediaRequests = [];
  t.after(async () => {
    await context.close();
    assert.deepEqual(errors, [], 'Unexpected browser exceptions');
  });
  await context.addInitScript(({ records, origin }) => {
    if (window.top !== window || location.origin !== origin) return;
    window.__seedHistory = new Promise((resolve, reject) => {
      const request = indexedDB.open('player-watch-history', 1);
      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore('items', { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt');
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('items', 'readwrite');
        records.forEach(item => tx.objectStore('items').put(item));
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
    });
    window.__cacheScans = 0;
    const getAll = IDBObjectStore.prototype.getAll;
    IDBObjectStore.prototype.getAll = function (...args) {
      if (this.transaction.db.name === 'player-thumbnail-cache') window.__cacheScans++;
      return getAll.apply(this, args);
    };
  }, { records, origin });
  const exports = 'window.__playerTest = { libraryState, hashState, settings, searchState, openLocation, refreshSearchIndex, registerLocalFolder, createLocalLinks, getLocalSession, localObjectUrls, localObjectUrlMetadata, getWatchHistoryRecords, getWatchHistoryId, getLocalFileHistoryId, sanitizeRestoredHash, requestFolderLinks, addFolderToPlaylist, setPlaylistFromUrls, playPlaylistIndex, getMediaUrl, renderLibraryView, putThumbnailCacheRecord, readThumbnailCache, applyThumbnailCacheItems, pruneThumbnailCache, runThumbnailCacheStore, idbRequest, getThumbnailCacheKey, populateThumbnails, writeWatchHistory }; Promise.resolve(window.__seedHistory).then(main);';
  const html = fs.readFileSync(path.join(project, 'dist', variant), 'utf8').replace(/\bmain\(\);(?=\s*<\/script>)/, exports);
  assert.ok(html.includes('window.__playerTest ='), 'Test instrumentation must match the built app');
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (url.pathname.endsWith('player.html.json')) return route.fulfill({ json: { startLocation: '/media/', settings: { thumbnailing: false, animate: false, 'search-depth': 1, ...settings } } });
    if (url.pathname.endsWith('player.html') || url.pathname.endsWith('player.min.html')) return route.fulfill({ contentType: 'text/html', body: html });
    if (url.pathname === '/media/') return route.fulfill({ contentType: 'text/html', body: listing('/media/', rows) });
    if (url.pathname === '/media/Other/') return route.fulfill({ contentType: 'text/html', body: listing('/media/Other/', [['Only audio.mp3', '2026-10-18 12:00', '5M']]) });
    if (url.pathname === '/media/Sub/') return route.fulfill({ contentType: 'text/html', body: listing('/media/Sub/', [['Nested/', '-', '-'], ['Child.webm', '2026-10-18 12:00', '40M']]) });
    if (url.pathname === '/media/Sub/Nested/') return route.fulfill({ contentType: 'text/html', body: listing('/media/Sub/Nested/', [['Deep.webm', '-', '50M']]) });
    if (/\.(webm|mp3)$/.test(url.pathname)) mediaRequests.push(url.pathname);
    return route.fulfill({ status: 404, body: 'Not found' });
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${origin}/${variant}`);
  try {
    await page.waitForFunction(() => document.querySelectorAll('.file:not([hidden])').length === 5, null, { timeout: 10000 });
  } catch (error) {
    console.error(JSON.stringify({ errors, content: await page.locator('body').innerText(), files: await page.locator('.file .label').allTextContents(), state: await page.evaluate(() => ({ links: window.app?.links, source: window.__playerTest?.hashState })) }));
    throw error;
  }
  await page.waitForFunction(() => !document.querySelector('.links-search-input').disabled);
  return { page, context, mediaRequests };
}

const visibleNames = page => page.locator('.file:not([hidden]) .label').allTextContents();

test('natural sorting, missing metadata, intersecting filters, and queue independence', async t => {
  const { page } = await openPlayer(t, [record('Episode 1.webm', 600), record('Episode 2.webm', 120)]);
  assert.deepEqual(await visibleNames(page), ['Audio track', 'Episode 1', 'Episode 2', 'Episode 10', 'Mystery']);
  await page.evaluate(() => window.app.playlist = [{ url: '/keep-first.webm' }, { url: '/keep-second.webm' }]);
  await page.selectOption('.library-sort', 'size-desc');
  await page.waitForFunction(() => document.querySelector('.file:not([hidden]) .label').textContent === 'Episode 10');
  assert.deepEqual(await visibleNames(page), ['Episode 10', 'Episode 2', 'Episode 1', 'Audio track', 'Mystery']);
  await page.selectOption('.library-sort', 'size-asc');
  await page.waitForFunction(() => document.querySelector('.file:not([hidden]) .label').textContent === 'Audio track');
  assert.equal((await visibleNames(page)).at(-1), 'Mystery');
  await page.selectOption('.library-sort', 'date-desc');
  await page.waitForFunction(() => document.querySelector('.file:not([hidden]) .label').textContent === 'Episode 10');
  assert.deepEqual(await visibleNames(page), ['Episode 10', 'Episode 2', 'Episode 1', 'Audio track', 'Mystery']);
  await page.selectOption('.library-sort', 'date-asc');
  await page.waitForFunction(() => document.querySelector('.file:not([hidden]) .label').textContent === 'Audio track');
  assert.equal((await visibleNames(page)).at(-1), 'Mystery');
  await page.selectOption('.library-type', 'video');
  await page.selectOption('.library-status', 'in-progress');
  await page.waitForFunction(() => document.querySelectorAll('.file:not([hidden])').length === 1);
  assert.deepEqual(await visibleNames(page), ['Episode 2']);
  assert.deepEqual(await page.locator('.folder:not([hidden]) .label').allTextContents(), ['Parent Folder', 'Other', 'Sub']);
  await page.locator('.links-search-input').fill('Episode 1');
  await page.locator('.links-search-input').press('Enter');
  await page.waitForFunction(() => document.querySelectorAll('.file:not([hidden])').length === 0);
  assert.deepEqual(await page.locator('.folder:not([hidden]) .label').allTextContents(), []);
  assert.equal(await page.locator('.links-search-results-count').textContent(), '0 results');
  assert.deepEqual(await page.evaluate(() => app.playlist.map(item => item.url)), ['/keep-first.webm', '/keep-second.webm']);
});

test('media filters preserve folder navigation in both library layouts', async t => {
  const { page } = await openPlayer(t);
  for (const view of ['tiles', 'list']) {
    await page.locator(`.library-view-${view}`).click();
    await page.selectOption('.library-type', 'video');
    await page.waitForFunction(() => document.querySelectorAll('.file:not([hidden])').length === 4);
    assert.deepEqual(await visibleNames(page), ['Episode 1', 'Episode 2', 'Episode 10', 'Mystery']);
    assert.deepEqual(await page.locator('.folder:not([hidden]) .label').allTextContents(), ['Parent Folder', 'Other', 'Sub']);

    await page.selectOption('.library-type', 'audio');
    await page.waitForFunction(() => document.querySelector('.file:not([hidden]) .label')?.textContent === 'Audio track');
    assert.deepEqual(await visibleNames(page), ['Audio track']);
    assert.deepEqual(await page.locator('.folder:not([hidden]) .label').allTextContents(), ['Parent Folder', 'Other', 'Sub']);
    await page.locator('.folder:not([hidden])').filter({ hasText: 'Sub' }).locator('.label').click();
    await page.waitForFunction(() => document.querySelectorAll('.folder:not([hidden]) .label')[1]?.textContent === 'Nested');
    assert.equal(await page.locator('.library-type').inputValue(), 'audio');
    assert.deepEqual(await visibleNames(page), []);
    assert.deepEqual(await page.locator('.folder:not([hidden]) .label').allTextContents(), ['Parent Folder', 'Nested']);

    await page.locator('.folder.parent:not([hidden]) .label').click();
    await page.waitForFunction(() => document.querySelector('.file:not([hidden]) .label')?.textContent === 'Audio track');
    assert.equal(await page.locator('.library-type').inputValue(), 'audio');
    assert.deepEqual(await page.locator('.folder:not([hidden]) .label').allTextContents(), ['Parent Folder', 'Other', 'Sub']);
  }
});

test('directory navigation shows only the immediate parent and children in both builds', async t => {
  for (const variant of ['player.html', 'player.min.html']) {
    const { page } = await openPlayer(t, [], variant);
    const folderNames = () => page.locator('.folder:not([hidden]) .label').allTextContents();
    assert.deepEqual(await folderNames(), ['Parent Folder', 'Other', 'Sub']);
    await page.locator('.folder:not([hidden])').filter({ hasText: 'Sub' }).locator('.label').click();
    await page.waitForFunction(() => window.app.links.url.endsWith('/media/Sub/'));
    await page.waitForFunction(() => document.querySelector('.file:not([hidden]) .label')?.textContent === 'Child');
    assert.deepEqual(await folderNames(), ['Parent Folder', 'Nested']);
    await page.locator('.folder:not([hidden])').filter({ hasText: 'Nested' }).locator('.label').click();
    await page.waitForFunction(() => document.querySelector('.file:not([hidden]) .label')?.textContent === 'Deep');
    assert.deepEqual(await folderNames(), ['Parent Folder']);
    assert.equal(await page.locator('.folder.parent').getAttribute('href'), root + 'Sub/');
    await page.locator('.folder.parent .label').click();
    await page.waitForFunction(() => document.querySelector('.file:not([hidden]) .label')?.textContent === 'Child');
    assert.deepEqual(await folderNames(), ['Parent Folder', 'Nested']);
  }
});

test('search counts appear only for queries and folders must match before appearing', async t => {
  const { page } = await openPlayer(t, [], 'player.html', { 'search-depth': 3 });
  assert.equal(await page.locator('.links-search-results-count').isVisible(), false);
  await page.selectOption('.library-type', 'video');
  await page.waitForFunction(() => document.querySelectorAll('.file:not([hidden])').length === 4);
  assert.equal(await page.locator('.links-search-results-count').isVisible(), false);
  await page.locator('.links-search-input').fill('Episode 2');
  await page.locator('.links-search-input').press('Enter');
  await page.waitForFunction(() => document.querySelector('.links-search-results-count').textContent === '1 result');
  assert.deepEqual(await visibleNames(page), ['Episode 2.webm']);
  assert.deepEqual(await page.locator('.folder:not([hidden]) .label').allTextContents(), []);
  await page.locator('.links-search-input').fill('Nested');
  await page.locator('.links-search-input').press('Enter');
  await page.waitForFunction(() => document.querySelector('.folder:not([hidden]) .label')?.textContent === 'Sub / Nested');
  assert.deepEqual(await page.locator('.folder:not([hidden]) .label').allTextContents(), ['Sub / Nested']);
  assert.deepEqual(await visibleNames(page), ['Sub / Nested / Deep.webm']);
  assert.equal(await page.locator('.links-search-results-count').textContent(), '2 results');
  await page.locator('.folder:not([hidden]) .label').click();
  await page.waitForFunction(() => document.querySelector('.file:not([hidden]) .label')?.textContent === 'Deep');
  assert.equal(await page.locator('.links-search-input').inputValue(), '');
  assert.equal(await page.locator('.links-search-results-count').isVisible(), false);
  assert.equal(await page.locator('.folder.parent:not([hidden])').count(), 1);
});

test('Open URL replaces search results with the requested folder and clears shared search state', async t => {
  for (const variant of ['player.html', 'player.min.html']) {
    const { page } = await openPlayer(t, [], variant);
    await page.route('http://blocked.example.test/', route => route.fulfill({ status: 403, body: 'Forbidden' }));
    for (const folder of [root, `${root}Sub/`]) {
      await page.locator('.links-search-input').fill('Episode 1');
      await page.waitForFunction(() => document.querySelector('.links-search-results-count').textContent === '2 results');
      await page.locator('.btn-open-url').click();
      await page.locator('.open-url-input').fill('http://blocked.example.test/');
      await page.locator('.open-url-submit').click();
      await page.waitForFunction(() => document.querySelector('.open-url-error').textContent.includes('Unable to open URL'));
      assert.equal(await page.locator('.links-search-input').inputValue(), 'Episode 1');
      assert.deepEqual(await visibleNames(page), ['Episode 1.webm', 'Episode 10.webm']);
      assert.equal(await page.evaluate(() => __playerTest.hashState.root), root);
      await page.locator('.open-url-input').fill(folder);
      await page.locator('.open-url-submit').click();
      await page.locator('.open-url.show').waitFor({ state: 'hidden' });
      assert.equal(await page.locator('.links-search-input').inputValue(), '');
      assert.equal(await page.locator('.links-search-results-count').isVisible(), false);
      await page.waitForFunction(expected => document.querySelector('.file:not([hidden]) .label')?.textContent === expected, folder === root ? 'Audio track' : 'Child');
      assert.deepEqual(await visibleNames(page), folder === root ? ['Audio track', 'Episode 1', 'Episode 2', 'Episode 10', 'Mystery'] : ['Child']);
      assert.equal(await page.locator('.folder.parent:not([hidden])').count(), 1);
      assert.deepEqual(await page.evaluate(() => ({ query: __playerTest.searchState.query, search: __playerTest.hashState.search, location: __playerTest.hashState.location })), { query: '', search: '', location: folder });
    }
  }
});

test('Continue playing search cannot hide Library folders when library search is disabled', async t => {
  for (const variant of ['player.html', 'player.min.html']) {
    const { page } = await openPlayer(t, [record('Episode 2.webm', 120)], variant);
    await page.locator('.btn-settings').click();
    await page.selectOption('.setting-search-depth', '0');
    await page.keyboard.press('Escape');
    for (const keyboard of [false, true]) {
      await page.locator('.library-tab-continue').click();
      await page.waitForFunction(() => document.querySelectorAll('.file:not([hidden])').length === 1);
      await page.locator('.links-search-input').fill('Episode');
      await page.waitForFunction(() => __playerTest.searchState.query === 'Episode');
      if (keyboard) {
        await page.locator('.library-tab-continue').focus();
        await page.keyboard.press('ArrowLeft');
      } else {
        await page.locator('.library-tab-library').click();
      }
      await page.waitForFunction(() => document.querySelectorAll('.file:not([hidden])').length === 5);
      assert.deepEqual(await page.locator('.folder:not([hidden]) .label').allTextContents(), ['Parent Folder', 'Other', 'Sub']);
      assert.equal(await page.locator('.links-search').isVisible(), false);
      assert.equal(await page.locator('.links-search-input').inputValue(), '');
      assert.equal(await page.evaluate(() => __playerTest.searchState.query), '');
      assert.equal(await page.locator('.links-search-results-count').isVisible(), false);
    }
  }
});

test('a superseded folder navigation cannot replace the newer library search root', async t => {
  for (const variant of ['player.html', 'player.min.html']) {
    for (const failure of [false, true]) {
      const { page } = await openPlayer(t, [], variant);
      const slowRoot = failure ? 'http://review-slow.example.test/' : `${origin}/review-slow/`;
      let releaseSlow;
      let markSlowRequested;
      const slowGate = new Promise(resolve => { releaseSlow = resolve; });
      const slowRequested = new Promise(resolve => { markSlowRequested = resolve; });
      t.after(() => releaseSlow());
      await page.route(slowRoot, async route => {
        markSlowRequested();
        await slowGate;
        await route.fulfill({ status: failure ? 403 : 200, contentType: 'text/html', body: listing('/review-slow/', [['Slow.webm', '-', '-']]) });
      });
      await page.route('**/review-fast/', route => route.fulfill({ contentType: 'text/html', body: listing('/review-fast/', [['Fast.webm', '-', '-']]) }));
      await page.evaluate(slowRoot => {
        app.playlist = [{ url: '/keep.webm' }];
        window.__slowNavigation = __playerTest.openLocation(`${slowRoot}Slow.webm`, { autoplay: false });
      }, slowRoot);
      await slowRequested;
      assert.equal(await page.evaluate(() => __playerTest.openLocation('/review-fast/', { playMedia: false })), true);
      releaseSlow();
      const slowOpened = await page.evaluate(() => window.__slowNavigation);
      await page.waitForFunction(() => __playerTest.searchState.indexed && !__playerTest.searchState.indexing);
      const fastRoot = `${origin}/review-fast/`;
      assert.deepEqual(await page.evaluate(() => ({ location: __playerTest.hashState.location, root: __playerTest.hashState.root, searchRoot: __playerTest.searchState.rootUrl })), { location: fastRoot, root: fastRoot, searchRoot: fastRoot });
      assert.equal(slowOpened, false);
      assert.deepEqual(await page.evaluate(() => app.playlist.map(item => item.url)), ['/keep.webm']);
      assert.equal(await page.evaluate(() => __playerTest.getMediaUrl()), '');
      assert.deepEqual(await visibleNames(page), ['Fast']);
      await page.locator('.links-search-input').fill('Fast');
      await page.waitForFunction(() => document.querySelector('.links-search-results-count').textContent === '1 result');
      assert.deepEqual(await visibleNames(page), ['Fast.webm']);
      assert.equal(await page.locator('.file:not([hidden])').getAttribute('href'), `${fastRoot}Fast.webm`);
    }
  }
});

test('disabling library search prevents an in-flight index from repopulating its state', async t => {
  for (const variant of ['player.html', 'player.min.html']) {
    const { page } = await openPlayer(t, [], variant);
    let releaseIndex;
    let markIndexRequested;
    const indexGate = new Promise(resolve => { releaseIndex = resolve; });
    const indexRequested = new Promise(resolve => { markIndexRequested = resolve; });
    t.after(() => releaseIndex());
    await page.route(root, async route => {
      markIndexRequested();
      await indexGate;
      await route.fulfill({ contentType: 'text/html', body: listing('/media/', rows) });
    });
    await page.evaluate(() => { window.__pendingIndex = __playerTest.refreshSearchIndex({ force: true }); });
    await indexRequested;
    await page.locator('.btn-settings').click();
    await page.selectOption('.setting-search-depth', '0');
    releaseIndex();
    assert.equal(await page.evaluate(() => window.__pendingIndex), false);
    assert.deepEqual(await page.evaluate(() => ({ indexed: __playerTest.searchState.indexed, indexing: __playerTest.searchState.indexing, entries: __playerTest.searchState.entries, folders: __playerTest.searchState.folderEntries })), { indexed: false, indexing: false, entries: [], folders: [] });
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.links-search').isVisible(), false);
    assert.deepEqual(await page.locator('.folder:not([hidden]) .label').allTextContents(), ['Parent Folder', 'Other', 'Sub']);
  }
});

test('list headers, icon feedback, tooltips, and field shapes stay consistent', async t => {
  const { page } = await openPlayer(t, [record('Episode 1.webm', 600)]);
  const folderColor = await page.locator('.folder:not(.parent) .arrow .closed').first().evaluate(el => getComputedStyle(el).fill);
  const parentColor = await page.locator('.folder.parent .folder-label .icon').evaluate(el => getComputedStyle(el).fill);
  assert.equal(await page.locator('.library-list-heading').isVisible(), false);
  let hoverColor;
  for (const view of ['tiles', 'list']) {
    await page.locator(`.library-view-${view}`).click();
    assert.equal(await page.locator('.file.watched .watched-icon').getAttribute('title'), 'This media has been played');
    assert.equal(await page.locator('.file.watched .watched-icon').isVisible(), view === 'tiles');
    for (const selector of ['.file:not([hidden])', '.folder:not(.parent):not([hidden])']) {
      const button = page.locator(`${selector} .btn-add-to-playlist`).first();
      assert.match(await button.getAttribute('title'), /Add.*to playlist/);
      await page.mouse.move(0, 0);
      const baseColor = await button.locator('svg').evaluate(el => getComputedStyle(el).fill);
      await button.hover();
      const color = await button.locator('svg').evaluate(el => getComputedStyle(el).fill);
      assert.notEqual(color, baseColor);
      if (hoverColor) assert.equal(color, hoverColor);
      hoverColor = color;
    }
  }
  assert.deepEqual(await page.locator('.library-list-heading span').allTextContents(), ['Name', 'Add']);
  assert.equal(await page.locator('.library-list-heading').isVisible(), true);
  assert.equal(await page.locator('.folder:not(.parent) .folder-label .icon').first().evaluate(el => getComputedStyle(el).fill), folderColor);
  assert.equal(await page.locator('.folder.parent .folder-label .icon').evaluate(el => getComputedStyle(el).fill), parentColor);
  assert.equal(await page.locator('.file-size, .file-date').count(), 0);
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.library-list-heading')).gridTemplateColumns === getComputedStyle(document.querySelector('.file:not([hidden]) .title')).gridTemplateColumns), true);
  assert.equal(await page.locator('.library-heading-add').evaluate(el => getComputedStyle(el).textAlign), 'center');
  for (const selector of ['.file:not([hidden]) .btn-add-to-playlist', '.folder:not(.parent) .btn-add-to-playlist']) {
    assert.equal(await page.locator(selector).first().evaluate(el => getComputedStyle(el).justifySelf), 'center', selector);
  }
  for (const selector of ['.library-heading-name', '.file:not([hidden]) .label', '.folder:not([hidden]) .label']) {
    assert.ok(['left', 'start'].includes(await page.locator(selector).first().evaluate(el => getComputedStyle(el).textAlign)), selector);
  }
  for (const label of await page.locator('.library-field > span').all()) {
    assert.equal(await label.evaluate(el => getComputedStyle(el).textAlign), 'center');
    assert.equal(await label.evaluate(el => parseFloat(getComputedStyle(el).marginBottom)), await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize) * 0.25));
  }
  const radius = await page.locator('.links-search-input').evaluate(el => getComputedStyle(el).borderRadius);
  for (const select of await page.locator('.library-field select').all()) assert.equal(await select.evaluate(el => getComputedStyle(el).borderRadius), radius);
  await page.locator('.links-search-input').fill('Episode');
  await page.locator('.links-search-input').press('Enter');
  await page.locator('.links-search-clear').waitFor();
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.links-search-clear')).backgroundColor === getComputedStyle(document.querySelector('.setting-watch-history-clear')).backgroundColor), true);
  await page.locator('.links-search-clear').click();
  await page.waitForFunction(() => document.querySelectorAll('.file:not([hidden])').length === 5);
  assert.equal(await page.locator('.links-search-results-count').isVisible(), false);
  assert.equal(await page.locator('.links-search-clear').isVisible(), false);
  await page.locator('.folder:not([hidden])').filter({ hasText: 'Sub' }).locator('.label').click();
  await page.waitForFunction(() => document.querySelector('.file:not([hidden]) .label')?.textContent === 'Child');
  assert.equal(await page.locator('.library-list-heading').isVisible(), true);
  assert.equal(await page.locator('.library-list-heading').count(), 1);
});

test('library controls share padding and typography and grow with their text', async t => {
  for (const variant of ['player.html', 'player.min.html']) {
    const { page } = await openPlayer(t, [], variant);
    assert.equal(await page.locator('.links-search-input').evaluate(el => el.getBoundingClientRect().width === el.parentElement.getBoundingClientRect().width), true);
    await page.locator('.links-search-input').fill('Episode');
    await page.locator('.links-search-clear').waitFor();
    const declarations = await page.evaluate(() => {
      const rule = Array.from(document.querySelector('style[primary]').sheet.cssRules).find(rule => ['.links-search-input', '.library-field select', '.links-search-clear'].every(selector => rule.selectorText?.includes(selector)));
      return { height: rule.style.height, padding: rule.style.padding, fontSize: rule.style.fontSize };
    });
    assert.equal(declarations.height, '');
    assert.equal(declarations.padding, '0.5rem 1rem');
    assert.ok(declarations.fontSize.endsWith('rem'));
    assert.ok(Math.abs(parseFloat(declarations.fontSize) - 1.333333) < 0.00001);
    for (const width of [1280, 700, 480, 360, 320]) {
      await page.setViewportSize({ width, height: 800 });
      const metrics = await page.locator('.links-search-input, .library-field select, .links-search-clear').evaluateAll(controls => controls.map(control => {
        const style = getComputedStyle(control);
        return Object.fromEntries(['minHeight', 'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'paddingTop', 'paddingBottom', 'borderRadius', 'cornerShape'].map(property => [property, style[property]]));
      }));
      assert.equal(metrics.length, 5);
      metrics.forEach(metric => assert.deepEqual(metric, metrics[0], variant + ' at ' + width));
      assert.equal(metrics[0].fontSize, '16px');
      assert.equal(metrics[0].paddingTop, '6px');
      assert.equal(metrics[0].paddingBottom, '6px');
      assert.equal(await page.locator('.links-search-clear').evaluate(el => getComputedStyle(el).marginLeft), '9px');
      assert.equal(await page.evaluate(() => document.querySelector('.links-search-clear').getBoundingClientRect().left - document.querySelector('.links-search-input').getBoundingClientRect().right), 9);
      assert.equal(await page.locator('.links-search-clear').evaluate(el => getComputedStyle(el).borderWidth), '0px');
      assert.equal(await page.locator('.links-search-clear').evaluate(el => el.getBoundingClientRect().height), await page.locator('.links-search-input').evaluate(el => el.getBoundingClientRect().height));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      for (const control of await page.locator('.links-search-input, .library-field select, .links-search-clear').all()) {
        assert.equal(await control.evaluate(el => el.scrollWidth <= el.clientWidth + 1), true);
      }
    }
    await page.setViewportSize({ width: 1280, height: 800 });
    if (process.env.PLAYER_SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.PLAYER_SCREENSHOT_DIR, 'library-search-desktop.png'), fullPage: true });
    const originalHeight = await page.locator('.links-search-input').evaluate(el => el.getBoundingClientRect().height);
    await page.evaluate(() => document.documentElement.style.fontSize = '1rem');
    const scaledMetrics = await page.locator('.links-search-input, .library-field select, .links-search-clear').evaluateAll(controls => controls.map(control => {
      const style = getComputedStyle(control);
      return { height: control.getBoundingClientRect().height, fontSize: parseFloat(style.fontSize), paddingTop: style.paddingTop, paddingBottom: style.paddingBottom };
    }));
    scaledMetrics.forEach(metric => {
      assert.ok(metric.height > originalHeight);
      assert.ok(Math.abs(metric.fontSize - 16 * 1.333333) < 0.01);
      assert.equal(metric.paddingTop, '8px');
      assert.equal(metric.paddingBottom, '8px');
    });
    assert.equal(scaledMetrics[0].height, scaledMetrics[1].height);
    await page.evaluate(() => document.documentElement.style.removeProperty('font-size'));
    await page.setViewportSize({ width: 320, height: 800 });
    const naturalHeights = await page.locator('.links-search-input, .library-field select, .links-search-clear').evaluateAll(controls => controls.map(el => el.getBoundingClientRect().height));
    const session = await page.context().newCDPSession(page);
    await session.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
    assert.equal(await page.evaluate(() => matchMedia('(pointer: coarse)').matches), true);
    assert.deepEqual(await page.locator('.links-search-input, .library-field select, .links-search-clear').evaluateAll(controls => controls.map(el => el.getBoundingClientRect().height)), naturalHeights);
    for (const control of await page.locator('.links-search-input, .library-field select, .links-search-clear').all()) {
      assert.equal(await control.evaluate(el => getComputedStyle(el).minHeight), '0px');
    }
    if (process.env.PLAYER_SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.PLAYER_SCREENSHOT_DIR, 'library-search-touch.png'), fullPage: true });
    await session.detach();
    await page.locator('.links-search-clear').click();
    assert.equal(await page.locator('.links-search-input').inputValue(), '');
    assert.equal(await page.locator('.links-search-clear').isVisible(), false);
    assert.equal(await page.locator('.links-search-input').evaluate(el => el.getBoundingClientRect().width === el.parentElement.getBoundingClientRect().width), true);
  }
});

test('portrait filters stay on one row with native styling and no right padding', async t => {
  for (const variant of ['player.html', 'player.min.html']) {
    const { page } = await openPlayer(t, [record('Episode 2.webm', 120)], variant);
    for (const width of [320, 375, 390, 480]) {
      await page.setViewportSize({ width, height: 667 });
      const fields = await page.locator('.library-field').evaluateAll(fields => fields.map(field => {
        const select = field.querySelector('select');
        const style = getComputedStyle(select);
        return {
          top: field.getBoundingClientRect().top,
          fontSize: style.fontSize,
          appearance: style.appearance,
          paddingLeft: style.paddingLeft,
          paddingRight: style.paddingRight,
          customCaretCount: field.querySelectorAll('svg').length
        };
      }));
      fields.forEach(field => {
        assert.equal(field.top, fields[0].top, variant + ' at ' + width);
        assert.equal(field.fontSize, '16px');
        assert.equal(field.appearance, 'auto');
        assert.equal(field.paddingLeft, '12px');
        assert.equal(field.paddingRight, '0px');
        assert.equal(field.customCaretCount, 0);
      });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    }
    if (process.env.PLAYER_SCREENSHOT_DIR) {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.screenshot({ path: path.join(process.env.PLAYER_SCREENSHOT_DIR, 'library-filters-iphone-se.png'), fullPage: true });
    }
    await page.setViewportSize({ width: 320, height: 667 });
    await page.selectOption('.library-status', 'in-progress');
    await page.waitForFunction(() => document.querySelectorAll('.file:not([hidden])').length === 1);
    assert.deepEqual(await visibleNames(page), ['Episode 2']);
    if (process.env.PLAYER_SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.PLAYER_SCREENSHOT_DIR, 'library-filters-narrow.png'), fullPage: true });
    await page.setViewportSize({ width: 1280, height: 800 });
    assert.equal(await page.locator('.library-field > svg').count(), 0);
    assert.equal(await page.locator('.library-field select').first().evaluate(el => getComputedStyle(el).appearance), 'auto');
  }
});

test('list view keeps only Name and Add at desktop and portrait widths', async t => {
  for (const variant of ['player.html', 'player.min.html']) {
    const { page } = await openPlayer(t, [record('Episode 1.webm', 600), record('Episode 2.webm', 120)], variant);
    await page.locator('.library-view-list').click();
    for (const width of [1280, 480, 360, 320]) {
      await page.setViewportSize({ width, height: 800 });
      assert.deepEqual(await page.locator('.library-list-heading span').allTextContents(), ['Name', 'Add']);
      assert.equal(await page.locator('.file-size, .file-date, .library-heading-played').count(), 0);
      assert.equal(await page.locator('.file.watched .watched-icon').isVisible(), false);
      assert.equal(await page.locator('.file.watched .file-resume').isVisible(), true);
      assert.equal(await page.locator('.file.watched .file-resume').textContent(), 'Played');
      assert.match(await page.locator('.file.in-progress .file-resume').textContent(), /^Resume /);
      const columns = await page.locator('.library-list-heading').evaluate(el => getComputedStyle(el).gridTemplateColumns);
      assert.equal(columns.split(/\s+/).length, 2);
      for (const row of await page.locator('.file:not([hidden]) .title, .folder:not([hidden]) .title').all()) {
        assert.equal(await row.evaluate(el => getComputedStyle(el).gridTemplateColumns), columns);
        assert.equal(await row.evaluate(el => el.scrollWidth <= el.clientWidth + 1), true);
      }
      for (const button of await page.locator('.links .btn-add-to-playlist:visible').all()) {
        assert.equal(await button.evaluate(el => getComputedStyle(el).gridColumnStart), '2');
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    }
    await page.locator('.library-view-tiles').click();
    assert.equal(await page.locator('.file.watched .watched-icon').isVisible(), true);
  }
});

test('directory metadata excludes filenames and does not invent missing sizes or dates', async t => {
  const { page } = await openPlayer(t);
  const fixtures = {
    python: '<ul><li><a href="Track%2003.mp3">Track 03.mp3</a></li><li><a href="2026-10-23%2012%3A34.mp4">2026-10-23 12:34.mp4</a></li></ul>',
    apache: '<table><tr><td><a href="clip99.mp4">clip99.mp4</a></td><td>23-Oct-2026 12:34</td><td>1.5M</td></tr><tr><td><a href="unknown3.mp3">unknown3.mp3</a></td><td>23-Oct-2026 12:34</td><td>-</td></tr></table>',
    nginx: '<pre><a href="clip12.webm">clip12.webm</a> 2026-10-23 12:34 1048576\n<a href="missing3.mp3">missing3.mp3</a> 2026-10-23 12:34 -\n<a href="empty.mp4">empty.mp4</a> 2026-10-23 12:34 0\n</pre>',
    iis: '<pre><br>10/23/2026 12:34 PM 1,234 <a href="one.mp3">one.mp3</a><br>10/23/2026 12:34 PM 2 KB <a href="two.webm">two.webm</a><br></pre>'
  };
  await page.route('**/metadata/**', route => route.fulfill({ contentType: 'text/html', body: fixtures[new URL(route.request().url()).pathname.split('/')[2]] }));
  const metadata = {};
  for (const name of Object.keys(fixtures)) {
    metadata[name] = await page.evaluate(async url => {
      const result = await window.folderApiRequest(url, { mode: 'fetch', cache: 'no-store' });
      return { files: result.files.map(({ size, date }) => ({ size, date })), heads: result.stats.heads };
    }, `${origin}/metadata/${name}/`);
  }
  const date = '2026-10-23T12:34:00.000Z';
  assert.deepEqual(metadata.python.files, [{ size: null, date: null }, { size: null, date: null }]);
  assert.deepEqual(metadata.apache.files, [{ size: 1572864, date }, { size: null, date }]);
  assert.deepEqual(metadata.nginx.files, [{ size: 1048576, date }, { size: null, date }, { size: 0, date }]);
  assert.deepEqual(metadata.iis.files, [{ size: 1234, date }, { size: 2048, date }]);
  assert.ok(Object.values(metadata).every(result => result.heads === 0));
});

test('parent folder icons stay open when filters hide all files', async t => {
  const { page } = await openPlayer(t);
  assert.equal(await page.evaluate(() => app.links.folders.find(folder => folder.url === location.origin + '/')?.role), 'parent');
  for (const [folder, type, label] of [['Sub', 'video', 'Child'], ['Other', 'audio', 'Only audio']]) {
    await page.selectOption('.library-type', type);
    await page.locator('.folder:not([hidden])').filter({ hasText: folder }).locator('.label').click();
    await page.waitForFunction(label => document.querySelector('.file:not([hidden]) .label')?.textContent === label, label);
    for (const filter of [type, type === 'video' ? 'audio' : 'video', type]) {
      await page.selectOption('.library-type', filter);
      await page.waitForFunction(count => document.querySelectorAll('.file:not([hidden])').length === count, filter === type ? 1 : 0);
      assert.equal(await page.locator('.folder.parent:not([hidden]) .arrow .open').evaluate(el => getComputedStyle(el).display), 'block');
      assert.equal(await page.locator('.folder.parent:not([hidden]) .arrow .closed').evaluate(el => getComputedStyle(el).display), 'none');
    }
    await page.locator('.folder.parent:not([hidden]) .label').click();
    await page.locator('.folder:not([hidden])').filter({ hasText: 'Other' }).locator('.label').waitFor();
    for (const icon of await page.locator('.folder:not(.parent):not([hidden]) .arrow .open').all()) {
      assert.equal(await icon.evaluate(el => getComputedStyle(el).display), 'none');
    }
  }
});

test('progress labels support audio and video and keep Played next to Unplayed', async t => {
  const { page } = await openPlayer(t, [record('Audio track.mp3', 600), record('Episode 1.webm', 600), record('Episode 2.webm', 120)]);
  assert.deepEqual(await page.locator('.library-status option').allTextContents(), ['All states', 'Played', 'Unplayed', 'In progress']);
  assert.match(await page.locator('.library-tab-continue').textContent(), /^Continue playing/);
  await page.locator('.library-view-list').click();
  await page.selectOption('.library-status', 'watched');
  await page.waitForFunction(() => document.querySelectorAll('.file:not([hidden])').length === 2);
  assert.deepEqual(await visibleNames(page), ['Audio track', 'Episode 1']);
  assert.deepEqual(await page.locator('.file:not([hidden]) .file-resume').allTextContents(), ['Played', 'Played']);
  await page.selectOption('.library-status', 'unplayed');
  await page.waitForFunction(() => document.querySelector('.file:not([hidden]) .label')?.textContent === 'Episode 10');
  assert.deepEqual(await visibleNames(page), ['Episode 10', 'Mystery']);
  await page.selectOption('.library-status', 'in-progress');
  await page.waitForFunction(() => document.querySelectorAll('.file:not([hidden])').length === 1);
  assert.deepEqual(await visibleNames(page), ['Episode 2']);
});

test('Continue playing stays within the library and restores the folder view', async t => {
  const { page } = await openPlayer(t, [record('Episode 2.webm', 120, 2), record('Sub/Child.webm', 60, 5), record('Episode 1.webm', 600), record('Elsewhere.webm', 80, 8, { url: `${origin}/unrelated/Elsewhere.webm` }), record('Local.webm', 50, 9, { source: 'local-file', url: 'Local.webm' })]);
  assert.equal(await page.locator('.library-continue-count').textContent(), '2');
  await page.locator('.library-tab-continue').click();
  await page.waitForFunction(() => document.querySelectorAll('.file:not([hidden])').length === 2);
  assert.deepEqual(await visibleNames(page), ['Sub / Child.webm', 'Episode 2.webm']);
  assert.equal(await page.locator('.folder:not([hidden])').count(), 0);
  assert.match(await page.locator('.file:not([hidden]) .file-resume').first().textContent(), /Resume 00:01:00/);
  await page.locator('.library-tab-library').click();
  await page.waitForFunction(() => document.querySelectorAll('.file:not([hidden])').length === 5);
  assert.ok(await page.locator('.folder:not([hidden])').count() > 0);
});

test('library switches leave the current page position alone instead of restoring tab scroll', async t => {
  for (const variant of ['player.html', 'player.min.html']) {
    const { page } = await openPlayer(t, [record('Episode 2.webm', 120), record('Sub/Child.webm', 60)], variant);
    await page.addStyleTag({ content: '.media-container { height: 600px; }' });
    const scrollPosition = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(window.scrollY)))));
    await page.evaluate(() => window.scrollTo(0, 180));
    assert.equal(await scrollPosition(), 180);
    await page.locator('.library-tab-continue').click();
    await page.waitForFunction(() => document.querySelectorAll('.file:not([hidden])').length === 2);
    assert.equal(await scrollPosition(), 180, variant + ' should not scroll to the top on first switch');
    await page.evaluate(() => window.scrollTo(0, 80));
    assert.equal(await scrollPosition(), 80);
    await page.locator('.library-tab-library').click();
    await page.waitForFunction(() => document.querySelectorAll('.file:not([hidden])').length === 5);
    assert.equal(await scrollPosition(), 80, variant + ' should not restore the previous Library scroll');
    await page.locator('.library-tab-continue').click();
    await page.waitForFunction(() => document.querySelectorAll('.file:not([hidden])').length === 2);
    assert.equal(await scrollPosition(), 80, variant + ' should not restore the previous Continue playing scroll');
  }
});

test('library and view selectors have matching connected buttons at desktop and mobile sizes', async t => {
  const { page } = await openPlayer(t, [record('Episode 2.webm', 120)]);
  for (const theme of ['dark', 'light']) {
    await page.emulateMedia({ colorScheme: theme });
    for (const width of [1280, 700, 360, 320]) {
      await page.setViewportSize({ width, height: 800 });
      for (const selector of ['.library-tabs', '.library-views']) {
        const metrics = await page.locator(selector).evaluate(group => {
          const buttons = Array.from(group.querySelectorAll('button'));
          const first = buttons[0].getBoundingClientRect();
          const last = buttons[1].getBoundingClientRect();
          const styles = buttons.map(button => getComputedStyle(button));
          const parent = getComputedStyle(group);
          return {
            gap: last.left - first.right,
            heightDifference: first.height - last.height,
            border: parent.borderWidth,
            radius: parent.borderRadius,
            innerBorders: [styles[0].borderRightWidth, styles[1].borderLeftWidth],
            squareInnerCorners: [styles[0].borderTopRightRadius, styles[1].borderTopLeftRadius],
            backgrounds: styles.map(style => style.backgroundColor),
            overflows: buttons.some(button => button.scrollWidth > button.clientWidth + 1)
          };
        });
        assert.ok(Math.abs(metrics.gap) < 1, selector + ' should have no gap');
        assert.equal(metrics.heightDifference, 0);
        assert.equal(metrics.border, '1px');
        assert.equal(metrics.radius, '6px');
        assert.deepEqual(metrics.innerBorders, ['0px', '1px']);
        assert.deepEqual(metrics.squareInnerCorners, ['0px', '0px']);
        assert.notEqual(metrics.backgrounds[0], metrics.backgrounds[1]);
        assert.equal(metrics.overflows, false);
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    }
  }
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.locator('.library-view-list').click();
  assert.equal(await page.locator('.library-view-list').getAttribute('aria-pressed'), 'true');
  await page.locator('.library-tab-continue').click();
  assert.equal(await page.locator('.library-tab-continue').getAttribute('aria-selected'), 'true');
});

test('list layout reuses nodes and thumbnail variables and survives preference reload', async t => {
  const { page } = await openPlayer(t);
  await page.evaluate(async () => {
    window.__savedTile = document.querySelector('.file:not([hidden])');
    const api = window.__playerTest;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 8;
    canvas.getContext('2d').fillRect(0, 0, 8, 8);
    const blob = await new Promise(resolve => canvas.toBlob(resolve));
    await api.putThumbnailCacheRecord('test-frames', [{ blob }, { blob }]);
    const cached = await api.readThumbnailCache('test-frames');
    api.applyThumbnailCacheItems(window.__savedTile, cached.items);
    window.__savedThumbnail = window.__savedTile.style.getPropertyValue('--image-url-1');
  });
  await page.locator('.library-view-list').click();
  assert.equal(await page.evaluate(() => document.querySelector('.links').classList.contains('list-view')), true);
  await page.selectOption('.library-sort', 'name-desc');
  await page.waitForFunction(() => document.querySelector('.file:not([hidden]) .label').textContent === 'Mystery');
  assert.equal(await page.evaluate(() => window.__savedTile === window.__playerTest.libraryState.nodes.get(window.__savedTile.href)), true);
  assert.equal(await page.evaluate(() => window.__savedTile.style.getPropertyValue('--image-url-1') === window.__savedThumbnail), true);
  assert.equal(await page.evaluate(async () => {
    const url = window.__savedThumbnail.match(/blob:[^'")]+/)[0];
    const image = new Image();
    image.src = url;
    await image.decode();
    return image.naturalWidth === 8 && (await fetch(url)).ok;
  }), true);
  await page.reload();
  await page.waitForFunction(() => document.querySelector('.links').classList.contains('list-view'));
  assert.equal(await page.locator('.library-sort').inputValue(), 'name-desc');
});

test('history privacy removes Continue playing and keyboard tabs do not seek the player', async t => {
  const { page } = await openPlayer(t, [record('Episode 2.webm', 120)]);
  await page.locator('.library-tab-library').focus();
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => document.querySelector('.library-tab-continue').getAttribute('aria-selected') === 'true');
  assert.equal(await page.locator('.player').evaluate(el => el.currentTime), 0);
  await page.locator('.btn-settings').click();
  await page.locator('.setting-watch-history').uncheck();
  await page.waitForFunction(() => document.querySelector('.library-tab-continue').hidden);
  assert.equal(await page.locator('.library-tab-library').getAttribute('aria-selected'), 'true');
  assert.equal(await page.locator('.library-status').isDisabled(), true);
});

async function installLocalFolder(page) {
  await page.evaluate(() => {
    const modified = 1730000000000;
    const fileHandle = name => ({ kind: 'file', name, async getFile() { return new File(['test-content'], name, { type: 'video/webm', lastModified: modified }); } });
    const directory = (name, items) => ({
      kind: 'directory', name,
      async *entries() { for (const item of items) yield [item.name, item]; },
      async getDirectoryHandle(name) { const result = items.find(item => item.name === name && item.kind === 'directory'); if (!result) throw new Error('Missing directory'); return result; },
      async getFileHandle(name) { const result = items.find(item => item.name === name && item.kind === 'file'); if (!result) throw new Error('Missing file'); return result; }
    });
    const nested = directory('Nested', [fileHandle('Deep.webm')]);
    const sub = directory('Sub', [nested, fileHandle('Child.webm')]);
    const folder = directory('Local library', [sub, fileHandle('Local.webm')]);
    window.showDirectoryPicker = async () => folder;
  });
}

test('local history appears before playback and local folder queues traverse children', async t => {
  const local = record('Local.webm', 80, 5, { id: 'local-file:Local.webm:12:1730000000000', url: 'Local.webm', source: 'local-file' });
  const { page } = await openPlayer(t, [local]);
  await installLocalFolder(page);
  await page.locator('.btn-local-file').click();
  await page.waitForFunction(() => document.querySelector('.file:not([hidden])')?.href.startsWith('local:'));
  assert.equal(await page.locator('.file:not([hidden]).in-progress').count(), 1);
  assert.equal(await page.evaluate(() => window.__playerTest.localObjectUrls.size), 0);
  assert.equal(await page.locator('.folder:not(.parent) .arrow .open').evaluate(el => getComputedStyle(el).display), 'none');
  assert.equal(await page.locator('.folder:not(.parent) .arrow .closed').evaluate(el => getComputedStyle(el).display), 'block');
  const result = await page.evaluate(async () => {
    const api = window.__playerTest;
    const sub = new URL('Sub/', api.hashState.location).href;
    await api.addFolderToPlaylist(sub, { shouldPlay: false, depth: 2 });
    return app.playlist.map(item => new URL(item.url).pathname);
  });
  assert.deepEqual(result, ['/Sub/Child.webm', '/Sub/Nested/Deep.webm']);
  const oldRoot = await page.evaluate(() => window.__playerTest.hashState.location);
  await page.locator('.btn-local-file').click();
  await page.waitForFunction(old => window.__playerTest.hashState.location !== old, oldRoot);
  assert.equal(await page.locator('.file:not([hidden]).in-progress').count(), 1);
  await page.selectOption('.library-type', 'audio');
  await page.waitForFunction(() => document.querySelectorAll('.file:not([hidden])').length === 0);
  assert.deepEqual(await page.locator('.folder:not([hidden]) .label').allTextContents(), ['Sub']);
  await page.locator('.folder:not([hidden]) .label').click();
  await page.waitForFunction(() => document.querySelectorAll('.folder:not([hidden]) .label')[1]?.textContent === 'Nested');
  assert.equal(await page.locator('.library-type').inputValue(), 'audio');
  assert.deepEqual(await visibleNames(page), []);
});

test('local Back and Forward retain handles and expired refresh state is rejected', async t => {
  const { page } = await openPlayer(t);
  await installLocalFolder(page);
  await page.locator('.btn-local-file').click();
  await page.waitForFunction(() => document.querySelector('.file:not([hidden])')?.href.startsWith('local:'));
  await page.locator('.folder:not([hidden])').filter({ hasText: 'Sub' }).locator('.label').click();
  await page.waitForFunction(() => document.querySelector('.file:not([hidden]) .label')?.textContent === 'Child');
  await page.locator('.folder:not([hidden])').filter({ hasText: 'Nested' }).locator('.label').click();
  await page.waitForFunction(() => document.querySelector('.file:not([hidden]) .label')?.textContent === 'Deep');
  await page.goBack();
  await page.waitForFunction(() => document.querySelector('.file:not([hidden]) .label')?.textContent === 'Child');
  await page.goForward();
  await page.waitForFunction(() => document.querySelector('.file:not([hidden]) .label')?.textContent === 'Deep');
  assert.deepEqual(await page.evaluate(() => window.__playerTest.sanitizeRestoredHash({ root: 'local://expired/', location: 'local://expired/Sub/' })), {});
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll('.file:not([hidden])').length === 5);
  assert.equal(await page.locator('.library-tab-library').getAttribute('aria-selected'), 'true');
});

test('thumbnail accounting stays dormant while Settings is closed and pruning uses keys', async t => {
  const { page } = await openPlayer(t);
  await page.evaluate(async () => {
    const api = window.__playerTest;
    await api.runThumbnailCacheStore('readwrite', store => {
      for (let i = 0; i < 303; i++) store.put({ key: 'cache-' + i, items: [{ blob: new Blob(['thumbnail']) }], size: 9, lastAccessedAt: i });
    });
    await api.pruneThumbnailCache();
    await Promise.all(Array.from({ length: 10 }, () => api.settings.cache.update()));
  });
  assert.equal(await page.evaluate(() => window.__cacheScans), 0);
  assert.equal(await page.evaluate(() => window.__playerTest.runThumbnailCacheStore('readonly', store => window.__playerTest.idbRequest(store.count()))), 300);
  await page.locator('.btn-settings').click();
  await page.waitForFunction(() => document.querySelector('.setting-cache + .metadata').textContent.includes('2'));
  assert.equal(await page.evaluate(() => window.__cacheScans), 1);
  assert.match(await page.locator('.setting-cache + .metadata').textContent(), /2/);
});

test('unplayable looped queues stop after one failed pass and allow a manual retry', async t => {
  const { page, mediaRequests } = await openPlayer(t);
  await page.evaluate(root => {
    window.__playerTest.setPlaylistFromUrls([root + 'broken-one.webm', root + 'broken-two.webm']);
    window.__playerTest.playPlaylistIndex(0);
  }, root);
  await page.waitForFunction(() => app.playlistIndex === 1 && !window.__playerTest.getMediaUrl());
  const firstPass = mediaRequests.length;
  assert.ok(firstPass >= 2 && firstPass <= 6, 'Each failed file should be attempted a bounded number of times');
  await page.evaluate(() => window.__playerTest.playPlaylistIndex(0));
  await page.waitForFunction(() => app.playlistIndex === 1 && !window.__playerTest.getMediaUrl());
  assert.ok(mediaRequests.length > firstPass);
  assert.equal(await page.locator('body').evaluate(el => el.classList.contains('is-stopped')), true);
});

test('minified build has the same library controls and fits a narrow viewport', async t => {
  const { page } = await openPlayer(t, [record('Episode 2.webm', 120)], 'player.min.html');
  await page.setViewportSize({ width: 360, height: 800 });
  await page.locator('.library-view-list').click();
  assert.equal(await page.locator('.links.list-view').count(), 1);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  for (const selector of ['.library-toolbar', '.library-controls', '.file:not([hidden]) .title']) {
    assert.equal(await page.locator(selector).first().evaluate(el => el.scrollWidth <= el.clientWidth + 1), true, selector);
  }
  await page.setViewportSize({ width: 320, height: 700 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  if (process.env.PLAYER_SCREENSHOT_DIR) {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.screenshot({ path: path.join(process.env.PLAYER_SCREENSHOT_DIR, 'library-mobile.png'), fullPage: true });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.screenshot({ path: path.join(process.env.PLAYER_SCREENSHOT_DIR, 'library-desktop.png'), fullPage: true });
    await page.locator('.library-view-tiles').click();
    await page.screenshot({ path: path.join(process.env.PLAYER_SCREENSHOT_DIR, 'library-tiles.png'), fullPage: true });
    await page.locator('.library-tab-continue').click();
    await page.waitForFunction(() => document.querySelectorAll('.file:not([hidden])').length === 1);
    await page.screenshot({ path: path.join(process.env.PLAYER_SCREENSHOT_DIR, 'library-continue.png'), fullPage: true });
  }
});
