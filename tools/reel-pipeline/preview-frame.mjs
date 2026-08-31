// Fast iteration helper - loads a recipe and screenshots just ONE frame at
// a given normalized time, skipping the full frame-loop + ffmpeg encode.
// For eyeballing whether a new recipe's camera/color/pattern combo looks
// right before spending the minutes a full render costs.
//
// Usage: node preview-frame.mjs <recipe.json> [t] [outfile.png]
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer';
import { startStaticServer, REPO_ROOT } from './static-server.js';

const [, , recipePath, tArg, outArg] = process.argv;
if (!recipePath) throw new Error('Usage: node preview-frame.mjs <recipe.json> [t] [outfile.png]');
const t = tArg !== undefined ? Number(tArg) : 0.5;
const outFile = outArg ?? 'preview-frame.png';

function loadRecipe(recipePath) {
  const raw = JSON.parse(fs.readFileSync(recipePath, 'utf8'));
  if (!raw.pattern) return raw;
  const recipeDir = path.dirname(path.resolve(recipePath));
  const patternAbsPath = path.resolve(recipeDir, raw.pattern);
  const patternUrlPath = '/' + path.relative(REPO_ROOT, patternAbsPath).split(path.sep).join('/');
  return { ...raw, pattern: patternUrlPath };
}

const recipe = loadRecipe(recipePath);
const server = await startStaticServer(5599);
const browser = await puppeteer.launch({
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'],
});
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('[pageerror]', e));
  await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
  await page.goto('http://localhost:5599/3d/index.html?reel=1', { waitUntil: 'networkidle0' });
  await page.waitForFunction('window.__reelTimeline !== undefined', { timeout: 15000 });
  await page.evaluate((recipe) => window.__reelTimeline.load(recipe), recipe);
  await page.evaluate((t) => window.__reelTimeline.seek(t), t);
  const canvas = await page.$('#three-canvas');
  await canvas.screenshot({ path: outFile });
  console.log('wrote', outFile);
} finally {
  await browser.close();
  server.close();
}
