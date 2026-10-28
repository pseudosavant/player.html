const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const project = path.resolve(__dirname, '..');
const catalogs = ['en', 'tr', 'ar', 'hi'].map(code => JSON.parse(fs.readFileSync(path.join(project, 'src', 'locales', code + '.json'), 'utf8')));
let browser;

before(async () => {
  browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'chrome' } : {}) });
});
after(async () => { await browser?.close(); });

function fixture(variant) {
  const html = fs.readFileSync(path.join(project, 'dist', variant), 'utf8');
  const css = html.match(/<style\b[^>]*\bprimary\b[^>]*>([\s\S]*?)<\/style>/i)?.[1];
  assert.ok(css, 'The generated primary stylesheet must be present');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${css}</style></head><body>
    <ul class="settings modal show">
      <li class="modal-item setting-item"><span class="key">First setting</span><span class="desc"><label>
        <input type="checkbox" aria-label="First setting"><span class="metadata"></span>
      </label></span></li>
      <li class="modal-item setting-item"><span class="key">A second setting with a longer label that wraps</span><span class="desc"><label>
        <input type="checkbox" aria-label="Second setting" checked><span class="metadata"></span>
      </label></span></li>
    </ul>
  </body></html>`;
}

for (const variant of ['player.html', 'player.min.html']) {
  test(`${variant}: toggle gaps stay symmetric across scales, locales, and track heights`, async () => {
    for (const deviceScaleFactor of [1, 1.25, 1.5, 2]) {
      const context = await browser.newContext({ deviceScaleFactor, viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
      try {
        const page = await context.newPage();
        await page.setContent(fixture(variant));
        for (const viewportWidth of [1280, 320]) {
          await page.setViewportSize({ width: viewportWidth, height: 900 });
          const result = await page.evaluate(catalogs => {
            const root = document.documentElement;
            const modal = document.querySelector('.settings');
            const inputs = [...modal.querySelectorAll('input')];
            const failures = [];
            let checks = 0;
            let fractionalPositions = 0;
            let maximumGapDifference = 0;
            for (const catalog of catalogs) {
              root.lang = catalog.locale;
              root.dir = catalog.dir;
              root.style.setProperty('--label-on', JSON.stringify(catalog.messages['ui.on']));
              root.style.setProperty('--label-off', JSON.stringify(catalog.messages['ui.off']));
              modal.querySelectorAll('.key').forEach((node, i) => { node.textContent = catalog.messages[i ? 'settings.watch-history.label' : 'settings.wake-lock.label']; });
              for (const fontSize of [12, 13.2, 16]) {
                root.style.fontSize = fontSize + 'px';
                for (const zoom of [0.9, 1, 1.25]) {
                  modal.style.zoom = zoom;
                  for (const trackHeight of [2, 2.5]) {
                    for (const checked of [false, true]) {
                      for (const input of inputs) {
                        input.style.setProperty('--track-height', trackHeight + 'rem');
                        input.checked = checked;
                        const style = getComputedStyle(input);
                        const thumb = getComputedStyle(input, '::after');
                        const before = getComputedStyle(input, '::before');
                        const box = input.getBoundingClientRect();
                        const transform = thumb.transform === 'none' ? { m41: 0, m42: 0 } : new DOMMatrixReadOnly(thumb.transform);
                        const width = parseFloat(style.width);
                        const height = parseFloat(style.height);
                        const top = parseFloat(thumb.top) + transform.m42;
                        const bottom = height - top - parseFloat(thumb.height);
                        const left = parseFloat(thumb.left) + transform.m41;
                        const right = width - left - parseFloat(thumb.width);
                        const expectedWidth = (catalog.locale === 'tr' ? 5 : 3.5) * fontSize;
                        const expectedThumbWidth = catalog.locale === 'tr' ? 3 * fontSize : trackHeight * fontSize - 4;
                        const epsilon = 1 / 16;
                        const near = (a, b) => Math.abs(a - b) <= epsilon;
                        checks++;
                        maximumGapDifference = Math.max(maximumGapDifference, Math.abs(top - bottom));
                        if (Math.abs(box.top * devicePixelRatio - Math.round(box.top * devicePixelRatio)) > epsilon) fractionalPositions++;
                        const errors = [];
                        if (!near(height, trackHeight * fontSize)) errors.push('track height does not follow its variable');
                        if (!near(width, expectedWidth) || !near(parseFloat(thumb.width), expectedThumbWidth)) errors.push('switch width changed');
                        if (!near(top, 2) || !near(bottom, 2)) errors.push('unequal vertical insets');
                        if (!near(parseFloat(thumb.top), height / 2) || !near(transform.m42, -parseFloat(thumb.height) / 2)) errors.push('missing center anchor');
                        if (!near(checked ? right : left, 2) || left < -epsilon || right < -epsilon) errors.push('incorrect horizontal endpoint');
                        if (!near(parseFloat(thumb.height), trackHeight * fontSize - 4)) errors.push('thumb height changed');
                        if (style.padding !== '0px' || style.borderTopWidth !== '0px' || style.borderBottomWidth !== '0px' || style.boxSizing !== 'border-box') errors.push('unexpected box model');
                        if (style.flexShrink !== '0') errors.push('switch can shrink');
                        if (!['none', 'normal'].includes(before.content)) errors.push('extra track layer');
                        if (style.backgroundColor === 'rgba(0, 0, 0, 0)') errors.push('missing track fill');
                        if (style.direction !== 'ltr') errors.push('switch mechanics mirrored');
                        if (errors.length && failures.length < 10) failures.push({ locale: catalog.locale, fontSize, zoom, trackHeight, checked, top, bottom, left, right, errors });
                      }
                    }
                  }
                }
              }
            }
            return { failures, checks, fractionalPositions, maximumGapDifference };
          }, catalogs);
          assert.deepEqual(result.failures, [], `${variant}: DPR ${deviceScaleFactor}, viewport ${viewportWidth}`);
          assert.equal(result.checks, 288);
          assert.ok(result.fractionalPositions > 0, 'Exercise fractional device-pixel positions, not only integer origins');
          assert.ok(result.maximumGapDifference <= 1 / 16);
        }
      } finally {
        await context.close();
      }
    }
  });

  test(`${variant}: toggles retain keyboard behavior, visible focus, and reduced motion`, async () => {
    const context = await browser.newContext({ viewport: { width: 320, height: 700 }, reducedMotion: 'no-preference' });
    try {
      const page = await context.newPage();
      await page.setContent(fixture(variant));
      const input = page.getByRole('checkbox', { name: 'First setting' });
      await input.evaluate(node => { window.__toggleChanges = 0; node.addEventListener('change', () => window.__toggleChanges++); });
      const initial = await input.boundingBox();
      await page.keyboard.press('Tab');
      assert.equal(await input.evaluate(node => node === document.activeElement && node.matches(':focus-visible')), true);
      const focused = await input.evaluate(node => {
        const style = getComputedStyle(node);
        return { outline: style.outlineStyle, width: style.outlineWidth, offset: style.outlineOffset, property: style.transitionProperty };
      });
      assert.deepEqual(focused, { outline: 'solid', width: '2px', offset: '2px', property: 'background-color' });
      assert.deepEqual(await input.boundingBox(), initial, 'The focus outline must not shift layout');
      await page.keyboard.press('Space');
      assert.equal(await input.isChecked(), true);
      await page.waitForFunction(() => {
        const node = document.querySelector('input');
        const thumb = getComputedStyle(node, '::after');
        const x = new DOMMatrixReadOnly(thumb.transform).m41;
        return Math.abs(node.getBoundingClientRect().width - parseFloat(thumb.left) - x - parseFloat(thumb.width) - 2) < 0.1;
      });
      assert.deepEqual(await input.boundingBox(), initial, 'Toggling must not shift layout');
      await page.keyboard.press('Space');
      assert.equal(await input.isChecked(), false);
      assert.equal(await page.evaluate(() => window.__toggleChanges), 2);
      assert.equal(await input.getAttribute('aria-label'), 'First setting');
      await page.emulateMedia({ reducedMotion: 'reduce' });
      assert.deepEqual(await input.evaluate(node => [getComputedStyle(node).transitionDuration, getComputedStyle(node, '::after').transitionDuration]), ['0s', '0s']);
      await input.evaluate(node => { node.disabled = true; });
      await page.keyboard.press('Space');
      assert.equal(await input.isChecked(), false);
      assert.equal(await page.evaluate(() => window.__toggleChanges), 2, 'Disabled inputs keep native behavior');
    } finally {
      await context.close();
    }
  });

  test(`${variant}: Edge pinch zoom preserves the 2px toggle gaps at 125% scaling`, {
    skip: process.platform !== 'win32' && 'Requires installed Microsoft Edge and the Windows headed renderer'
  }, async () => {
    // Headless rendering does not reproduce the pre-pinch pixel rounding in Edge.
    const edge = await chromium.launch({ channel: 'msedge', headless: false, args: ['--window-position=-32000,-32000'] });
    try {
      const context = await edge.newContext({ deviceScaleFactor: 1.25, viewport: { width: 1600, height: 1000 }, reducedMotion: 'reduce' });
      const page = await context.newPage();
      await page.setContent(fixture(variant));
      await page.addStyleTag({ content: `.modal input[type='checkbox'] {
        --accent: #ff0099;
        --color-surface-quiet-active: #ff0099;
        --color-field-bg: #ffeff9;
      }` });
      const cdp = await context.newCDPSession(page);
      await cdp.send('Emulation.setPageScaleFactor', { pageScaleFactor: 4 });
      for (const checked of [false, true]) {
        for (const offset of [0, 0.2, 0.4, 0.6, 0.8, 1]) {
          await page.evaluate(({ checked, offset }) => {
            document.querySelector('.settings').style.marginTop = offset + 'px';
            document.querySelectorAll('input').forEach(node => { node.checked = checked; });
          }, { checked, offset });
          const metrics = await page.evaluate(() => ({
            ratio: devicePixelRatio,
            scale: visualViewport.scale,
            x: visualViewport.offsetLeft,
            y: visualViewport.offsetTop,
            boxes: [...document.querySelectorAll('input')].map(node => {
              const box = node.getBoundingClientRect();
              return { x: box.x, y: box.y, width: box.width, height: box.height, spacing: getComputedStyle(node).getPropertyValue('--spacing').trim() };
            })
          }));
          assert.equal(metrics.ratio, 1.25, 'Use display scaling, not ordinary browser zoom');
          assert.equal(metrics.scale, 4, 'Exercise pinch magnification through the visual viewport');
          const screenshot = await page.screenshot({ scale: 'device' });
          const gaps = await page.evaluate(async ({ png, metrics }) => {
            const image = new Image();
            image.src = 'data:image/png;base64,' + png;
            await image.decode();
            const canvas = document.createElement('canvas');
            canvas.width = image.naturalWidth;
            canvas.height = image.naturalHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(image, 0, 0);
            const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const scale = metrics.ratio * metrics.scale;
            // Include one pre-pinch device pixel around the rounded DOM bounds.
            const margin = Math.ceil(metrics.scale);
            return metrics.boxes.map(box => {
              const track = { top: Infinity, bottom: -Infinity };
              const thumb = { top: Infinity, bottom: -Infinity };
              const left = Math.floor((box.x - metrics.x) * scale) - margin;
              const right = Math.ceil((box.x + box.width - metrics.x) * scale) + margin;
              const top = Math.floor((box.y - metrics.y) * scale) - margin;
              const bottom = Math.ceil((box.y + box.height - metrics.y) * scale) + margin;
              if (left < 0 || top < 0 || right > canvas.width || bottom > canvas.height) throw new Error('Toggle must be fully visible in the pinch screenshot');
              for (let y = top; y < bottom; y++) {
                for (let x = left; x < right; x++) {
                  const i = (y * canvas.width + x) * 4;
                  const matches = (r, g, b, tolerance = 2) => Math.abs(data[i] - r) <= tolerance && Math.abs(data[i + 1] - g) <= tolerance && Math.abs(data[i + 2] - b) <= tolerance;
                  const bounds = matches(255, 0, 153, 4) ? track : matches(255, 239, 249) ? thumb : null;
                  if (bounds) {
                    bounds.top = Math.min(bounds.top, y);
                    bounds.bottom = Math.max(bounds.bottom, y);
                  }
                }
              }
              return { top: thumb.top - track.top, bottom: track.bottom - thumb.bottom,
                trackHeight: track.bottom - track.top + 1, thumbHeight: thumb.bottom - thumb.top + 1 };
            });
          }, { png: screenshot.toString('base64'), metrics });
          for (const [index, gap] of gaps.entries()) {
            const detail = JSON.stringify({ checked, offset, index, gap });
            assert.equal(metrics.boxes[index].spacing, '2px', 'Keep the original CSS inset');
            assert.ok(Math.abs(gap.top - 10) <= 1 && Math.abs(gap.bottom - 10) <= 1, 'Keep both painted gaps at 2 CSS pixels: ' + detail);
            assert.ok(Math.abs(gap.top - gap.bottom) <= 1, 'Keep the painted thumb centered: ' + detail);
            assert.ok(Math.abs(gap.trackHeight - 120) <= 1 && Math.abs(gap.thumbHeight - 100) <= 1, 'Keep the original track and thumb heights: ' + detail);
          }
        }
      }
    } finally {
      await edge.close();
    }
  });
}
