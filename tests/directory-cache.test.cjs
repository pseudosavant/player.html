const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

const project = path.resolve(__dirname, '..');
const listing = names => '<!doctype html><title>Directory listing</title><ul>' +
  names.map(name => `<li><a href="${name}">${name}</a></li>`).join('') + '</ul>';

test('library and search bypass directory responses cached by a previous server', async t => {
  let previousProject = true;
  let currentFile = 'Current.webm';
  let nestedFile = 'Nested.webm';
  const directoryRequests = [];
  const html = fs.readFileSync(path.join(project, 'dist', 'player.html'), 'utf8')
    .replace(/<script\b[^>]*\bsrc=['"]https?:[^>]*><\/script>/g, '');
  const server = http.createServer((request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    response.setHeader('Content-Type', 'text/html');
    if (pathname === '/player.html') return response.end(html);
    if (pathname === '/prime.html') return response.end('<!doctype html><title>Cache setup</title>');
    if (pathname === '/player.html.json') {
      response.setHeader('Content-Type', 'application/json');
      return response.end(JSON.stringify({ startLocation: '/media/', settings: { thumbnailing: false, animate: false, 'search-depth': 2 } }));
    }
    if (pathname === '/media/' || pathname === '/media/videos/') {
      directoryRequests.push(pathname);
      response.setHeader('Cache-Control', 'public, max-age=3600');
      return response.end(listing(previousProject
        ? ['data-uri-pwa/', 'old-project.webm']
        : (pathname === '/media/' ? ['videos/', currentFile] : [nestedFile])));
    }
    response.writeHead(404);
    response.end('Not found');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'chrome' } : {}) });
  t.after(() => browser.close());
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));

  // Routing disables Playwright's HTTP cache. Use a real server for this test.
  await page.goto(`${origin}/prime.html`);
  await page.evaluate(async () => {
    await fetch('/media/').then(response => response.text());
    await fetch('/media/videos/').then(response => response.text());
  });
  previousProject = false;
  assert.match(await page.evaluate(() => fetch('/media/').then(response => response.text())), /data-uri-pwa/);
  assert.equal(directoryRequests.length, 2, 'The old listing must actually be served from the browser cache');

  await page.goto(`${origin}/player.html`);
  await page.locator('.folder:not([hidden])').first().waitFor();
  assert.deepEqual(await page.locator('.folder:not([hidden]) .label').allTextContents(), ['Parent Folder', 'videos']);
  assert.deepEqual(await page.locator('.file:not([hidden]) .label').allTextContents(), ['Current']);
  await page.waitForFunction(() => !document.querySelector('.links-search-input').disabled);
  await page.locator('.links-search-input').fill('Nested');
  await page.locator('.links-search-input').press('Enter');
  await page.waitForFunction(() => document.querySelector('.file:not([hidden]) .label')?.textContent === 'videos / Nested.webm');
  assert.deepEqual(await page.locator('.file:not([hidden]) .label').allTextContents(), ['videos / Nested.webm']);
  assert.ok(directoryRequests.filter(pathname => pathname === '/media/').length >= 2);
  assert.ok(directoryRequests.filter(pathname => pathname === '/media/videos/').length >= 2);

  await page.locator('.links-search-clear').click();
  await page.waitForFunction(() => document.querySelector('.file:not([hidden]) .label')?.textContent === 'Current');
  const nestedRequests = directoryRequests.filter(pathname => pathname === '/media/videos/').length;
  await page.reload();
  await page.waitForFunction(() => !document.querySelector('.links-search-input').disabled);
  assert.equal(directoryRequests.filter(pathname => pathname === '/media/videos/').length, nestedRequests, 'An unchanged directory should reuse its search index');

  currentFile = 'Updated.webm';
  nestedFile = 'Replacement.webm';
  await page.reload();
  await page.waitForFunction(() => !document.querySelector('.links-search-input').disabled);
  await page.waitForFunction(() => document.querySelector('.file:not([hidden]) .label')?.textContent === 'Updated');
  assert.deepEqual(await page.locator('.file:not([hidden]) .label').allTextContents(), ['Updated']);
  await page.locator('.links-search-input').fill('Replacement');
  await page.locator('.links-search-input').press('Enter');
  await page.waitForFunction(() => document.querySelector('.file:not([hidden]) .label')?.textContent === 'videos / Replacement.webm');
  assert.deepEqual(await page.locator('.file:not([hidden]) .label').allTextContents(), ['videos / Replacement.webm']);
  assert.ok(directoryRequests.filter(pathname => pathname === '/media/videos/').length > nestedRequests, 'A changed directory must invalidate the search index');

  await page.evaluate(() => {
    for (const key of Object.keys(sessionStorage).filter(key => key.startsWith('player-search-index:'))) {
      const cache = JSON.parse(sessionStorage.getItem(key));
      delete cache.directories;
      cache.entries = [];
      sessionStorage.setItem(key, JSON.stringify(cache));
    }
  });
  await page.reload();
  await page.waitForFunction(() => !document.querySelector('.links-search-input').disabled);
  await page.waitForFunction(() => document.querySelector('.file:not([hidden]) .label')?.textContent === 'videos / Replacement.webm');
  assert.deepEqual(await page.locator('.file:not([hidden]) .label').allTextContents(), ['videos / Replacement.webm'], 'Legacy search caches must be rebuilt');
  assert.deepEqual(errors, []);
});
