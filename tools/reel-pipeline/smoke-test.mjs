import puppeteer from 'puppeteer';
import { startStaticServer } from './static-server.js';

const server = await startStaticServer(5510);
const browser = await puppeteer.launch({
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'],
});
try {
  const page = await browser.newPage();
  page.on('console', (m) => console.log('[page]', m.text()));
  page.on('pageerror', (e) => console.error('[pageerror]', e));
  await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
  await page.goto('http://localhost:5510/3d/index.html?reel=1', { waitUntil: 'networkidle0', timeout: 30000 });
  await page.waitForFunction('window.__reelTimeline !== undefined', { timeout: 15000 });
  console.log('reelTimeline ready');
  const canvas = await page.$('#three-canvas');
  await canvas.screenshot({ path: 'smoke-test.png' });
  console.log('screenshot saved');
} finally {
  await browser.close();
  server.close();
}
