import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createArenaServer } from '../server.mjs';

// Browser screenshots of the real local arena UI; no image generation.
// Demo fight uses built-in scripted bots, not external LLM agents.
const server = createArenaServer();
await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});
const base = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch({ headless: true });
try {
  await mkdir(new URL('../docs/screenshots/', import.meta.url), { recursive: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  const response = await page.goto(base, { waitUntil: 'networkidle' });
  if (response?.status() !== 200) throw new Error('Unexpected landing status');
  await page.waitForFunction(() => {
    const el = document.querySelector('#startButton');
    return el instanceof HTMLButtonElement && !el.disabled;
  }, { timeout: 15000 });
  await page.click('#startButton');
  await page.waitForTimeout(800);
  const arena = page.locator('#arena');
  if (!(await arena.isVisible())) throw new Error('Real arena surface not visible after starting');
  if (await page.locator('#battleSection').isHidden()) throw new Error('Battle section hidden');
  const shot = new URL('../docs/screenshots/agent-arena-gameplay.png', import.meta.url);
  await page.screenshot({ path: shot.pathname, fullPage: false, animations: 'disabled' });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  const xOverflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  if (xOverflow) {
    const overflowEvidence = await page.evaluate(() => ({
      innerWidth, scrollWidth: document.documentElement.scrollWidth,
      nodes: [...document.querySelectorAll('body *')].map(el => ({
        tag: el.tagName, id: el.id, className: typeof el.className === 'string' ? el.className : '',
        right: Math.round(el.getBoundingClientRect().right),
        left: Math.round(el.getBoundingClientRect().left),
        width: Math.round(el.getBoundingClientRect().width),
      })).filter(item => item.right > innerWidth + 1 || item.left < -1).slice(0, 35)
    }));
    console.error('MOBILE_LAYOUT_OVERFLOW_DIAGNOSTIC', JSON.stringify(overflowEvidence));
    throw new Error('Mobile page horizontal overflow');
  }
  const mobile = new URL('../docs/screenshots/agent-arena-mobile.png', import.meta.url);
  await page.screenshot({ path: mobile.pathname, fullPage: false, animations: 'disabled' });
  if (pageErrors.length) throw new Error('Browser runtime errors: ' + pageErrors.join('; '));

  console.log('PASS: authentic scripted demo screenshots saved; mobile width 390 px; no JS page errors.');
} finally {
  await browser.close();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
