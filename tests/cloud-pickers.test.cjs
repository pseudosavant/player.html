const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const project = path.resolve(__dirname, '..');
const oneDriveUrl = 'https://js.live.net/v7.2/OneDrive.js';
const googleUrl = 'https://apis.google.com/js/api.js';
const configured = {
  onedrive: { clientId: 'microsoft-client' },
  gdrive: { developerKey: 'google-key', clientId: 'google-client', appId: '12345' }
};
const sdkCode = url => url === oneDriveUrl
  ? 'window.OneDrive = { open(options) { window.__cloudOpenCount = (window.__cloudOpenCount || 0) + 1; options.cancel(); } };'
  : 'window.gapi = { load() { window.__googleModuleLoadCount = (window.__googleModuleLoadCount || 0) + 1; } };';
let browser;

before(async () => {
  browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'chrome' } : {}) });
});
after(async () => { await browser?.close(); });

async function openPlayer(t, options = {}) {
  const origin = (options.protocol || 'https:') + '//player.test';
  const context = await browser.newContext();
  const requests = [];
  const errors = [];
  let releaseConfig;
  let releaseSdk;
  const configGate = options.deferConfig ? new Promise(resolve => { releaseConfig = resolve; }) : Promise.resolve();
  const sdkGate = options.deferSdk ? new Promise(resolve => { releaseSdk = resolve; }) : Promise.resolve();
  let failure = options.failure;
  const tasks = new Set();
  t.after(async () => {
    releaseConfig?.();
    releaseSdk?.();
    await Promise.allSettled([...tasks]);
    await context.close();
    assert.deepEqual(errors, [], 'Unexpected browser exceptions');
  });
  if (options.preloaded) await context.addInitScript(options.preloaded);
  const variant = options.variant || 'player.html';
  const html = fs.readFileSync(path.join(project, 'dist', variant), 'utf8');
  const config = {
    startLocation: '/media/',
    settings: { thumbnailing: false, animate: false, 'search-depth': 0 },
    cloud: options.cloud || {}
  };
  const handle = async route => {
    const url = route.request().url();
    if (url === oneDriveUrl || url === googleUrl) {
      requests.push(url);
      await sdkGate;
      if (failure === url) return route.abort();
      return route.fulfill({ contentType: 'text/javascript', body: options.missingGlobal === url ? 'void 0;' : sdkCode(url) });
    }
    const parsed = new URL(url);
    if (parsed.origin !== origin) return route.abort();
    if (parsed.pathname === '/player.html.json') {
      await configGate;
      return route.fulfill({ json: options.wrapped ? { options: config } : config });
    }
    if (parsed.pathname.endsWith('.html')) return route.fulfill({ contentType: 'text/html', body: html });
    if (parsed.pathname === '/media/') return route.fulfill({ contentType: 'text/html', body: '<ul><li><a href="Sample.webm">Sample.webm</a></li></ul>' });
    return route.fulfill({ status: 404, body: 'Not found' });
  };
  await context.route('**/*', route => {
    const task = handle(route);
    tasks.add(task);
    return task.finally(() => tasks.delete(task));
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  if (options.clock) await page.clock.install();
  await page.goto(origin + '/' + variant);
  const waitForLibrary = () => page.waitForFunction(() => document.querySelector('.file .label')?.textContent === 'Sample');
  if (!options.deferConfig) await waitForLibrary();
  return { page, requests, waitForLibrary, releaseConfig, releaseSdk, setFailure: value => { failure = value; } };
}

for (const variant of ['player.html', 'player.min.html']) {
  test(`${variant}: unconfigured cloud providers stay hidden and make no requests`, async t => {
    const { page, requests } = await openPlayer(t, { variant });
    assert.equal(await page.locator('.btn-onedrive').isVisible(), false);
    assert.equal(await page.locator('.btn-gdrive').isVisible(), false);
    assert.deepEqual(requests, []);
    assert.equal(await page.locator('script[data-cloud-sdk]').count(), 0);
  });

  test(`${variant}: HTTP never loads cloud SDKs even with complete configuration`, async t => {
    const { page, requests } = await openPlayer(t, { variant, protocol: 'http:', cloud: configured });
    assert.equal(await page.locator('.btn-onedrive').isVisible(), false);
    assert.equal(await page.locator('.btn-gdrive').isVisible(), false);
    assert.deepEqual(requests, []);
  });

  test(`${variant}: each configured provider loads its existing SDK during startup`, async t => {
    for (const provider of ['onedrive', 'gdrive']) {
      const { page, requests } = await openPlayer(t, { variant, cloud: { [provider]: configured[provider] } });
      await page.waitForFunction(provider => !document.querySelector('.btn-' + provider).disabled, provider);
      assert.deepEqual(requests, [provider === 'onedrive' ? oneDriveUrl : googleUrl]);
      assert.equal(await page.locator('.btn-' + (provider === 'onedrive' ? 'gdrive' : 'onedrive')).isVisible(), false);
      assert.equal(await page.evaluate(() => window.__cloudOpenCount || window.__googleModuleLoadCount || 0), 0);
      if (provider === 'onedrive') {
        await page.locator('.btn-onedrive').click();
        assert.equal(await page.evaluate(() => window.__cloudOpenCount), 1);
      }
    }
  });

  test(`${variant}: configuration and SDK loading do not race or block the library`, async t => {
    const { page, requests, waitForLibrary, releaseConfig, releaseSdk } = await openPlayer(t, {
      variant, cloud: configured, wrapped: true, deferConfig: true, deferSdk: true
    });
    assert.deepEqual(requests, []);
    assert.equal(await page.locator('.btn-onedrive').isVisible(), false);
    assert.equal(await page.locator('.btn-gdrive').isVisible(), false);
    releaseConfig();
    await waitForLibrary();
    await page.waitForFunction(() => document.querySelectorAll('script[data-cloud-sdk]').length === 2);
    for (const provider of ['onedrive', 'gdrive']) {
      assert.equal(await page.locator('.btn-' + provider).isVisible(), true);
      assert.equal(await page.locator('.btn-' + provider).isDisabled(), true);
    }
    await page.evaluate(() => { window.__cloudRepeat = Promise.all([setupCloudPickers(), setupCloudPickers()]); });
    releaseSdk();
    await page.evaluate(() => window.__cloudRepeat);
    assert.deepEqual([...requests].sort(), [oneDriveUrl, googleUrl].sort());
    assert.equal(await page.locator('.btn-onedrive').isEnabled(), true);
    assert.equal(await page.locator('.btn-gdrive').isEnabled(), true);
  });

  test(`${variant}: one SDK failure does not disable the other provider and can be retried`, async t => {
    const { page, requests, setFailure } = await openPlayer(t, { variant, cloud: configured, failure: oneDriveUrl });
    await page.waitForFunction(() => document.querySelector('.btn-onedrive').title === 'Unable to load OneDrive');
    await page.waitForFunction(() => !document.querySelector('.btn-gdrive').disabled);
    assert.equal(await page.locator('.btn-onedrive').isDisabled(), true);
    assert.equal(await page.locator('script[data-cloud-sdk="onedrive"]').count(), 0);
    setFailure(null);
    await page.evaluate(() => setupCloudPickers());
    assert.equal(await page.locator('.btn-onedrive').isEnabled(), true);
    assert.equal(requests.filter(url => url === oneDriveUrl).length, 2);
    assert.equal(requests.filter(url => url === googleUrl).length, 1);
  });

  test(`${variant}: missing SDK globals and SDK timeouts fail safely`, async t => {
    const missing = await openPlayer(t, { variant, cloud: { onedrive: configured.onedrive }, missingGlobal: oneDriveUrl });
    await missing.page.waitForFunction(() => document.querySelector('.btn-onedrive').title === 'Unable to load OneDrive');
    assert.equal(await missing.page.locator('.btn-onedrive').isDisabled(), true);
    const timedOut = await openPlayer(t, { variant, cloud: { onedrive: configured.onedrive }, deferSdk: true, clock: true });
    await timedOut.page.clock.fastForward(15001);
    await timedOut.page.waitForFunction(() => document.querySelector('.btn-onedrive').title === 'Unable to load OneDrive');
    assert.equal(await timedOut.page.locator('.btn-onedrive').isDisabled(), true);
    assert.equal(await timedOut.page.locator('script[data-cloud-sdk]').count(), 0);
    timedOut.releaseSdk();
  });
}

test('cloud configuration rejects partial, blank, and non-string credentials', async t => {
  for (const field of ['developerKey', 'clientId', 'appId']) {
    const { page, requests } = await openPlayer(t, { cloud: { gdrive: { ...configured.gdrive, [field]: '  ' }, onedrive: { clientId: 123 } } });
    assert.equal(await page.locator('.btn-gdrive').isVisible(), false);
    assert.equal(await page.locator('.btn-onedrive').isVisible(), false);
    assert.deepEqual(requests, []);
  }
});

test('existing SDK globals are reused without injecting scripts', async t => {
  const { page, requests } = await openPlayer(t, {
    cloud: configured,
    preloaded: () => { window.OneDrive = { open() {} }; window.gapi = { load() {} }; }
  });
  await page.waitForFunction(() => !document.querySelector('.btn-onedrive').disabled && !document.querySelector('.btn-gdrive').disabled);
  assert.deepEqual(requests, []);
  assert.equal(await page.locator('script[data-cloud-sdk]').count(), 0);
});

test('cloud availability messages follow live language changes without loading SDKs again', async t => {
  const { page, requests } = await openPlayer(t, {
    cloud: configured,
    failure: oneDriveUrl,
    preloaded: () => { Object.defineProperty(navigator, 'languages', { get: () => ['zh-CN'] }); }
  });
  await page.waitForFunction(() => document.querySelector('.btn-onedrive').title === '无法加载 OneDrive' && !document.querySelector('.btn-gdrive').disabled);
  assert.equal(await page.locator('.btn-gdrive').getAttribute('aria-label'), '从 Google Drive 打开');
  await page.click('.btn-settings');
  await page.selectOption('.setting-language', 'en');
  assert.equal(await page.locator('.btn-onedrive').getAttribute('title'), 'Unable to load OneDrive');
  assert.equal(await page.locator('.btn-onedrive').isDisabled(), true);
  assert.equal(await page.locator('.btn-gdrive').getAttribute('title'), 'Open from Google Drive');
  assert.equal(requests.length, 2);
});
