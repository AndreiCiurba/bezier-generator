// One-off generator for patterns/variety.json - several distinct small
// shapes built out of *real* current-grid nail positions (see
// gen-sample-pattern.mjs for why: guarantees every translated copy
// stampThroughoutGrid produces actually snaps to real nails, without having
// to hand-derive the rotated-lattice math). Run once, inspect the output,
// done - not part of the ongoing pipeline.
import puppeteer from 'puppeteer';
import fs from 'node:fs';
import { startStaticServer } from './static-server.js';

const server = await startStaticServer(5510);
const browser = await puppeteer.launch({
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'],
});
try {
  const page = await browser.newPage();
  await page.goto('http://localhost:5510/3d/index.html?reel=1', { waitUntil: 'networkidle0' });
  await page.waitForFunction('window.__reelTimeline !== undefined');

  const result = await page.evaluate(() => {
    const points = window.__reelTimeline.sceneSync.grid.points;
    const cols = Math.round(Math.sqrt(points.length));
    const at = (row, col) => points[row * cols + col];
    const palette = window.__reelTimeline.palette.snapshot();

    const shapes = {
      diamond: [at(5, 5), at(5, 7), at(7, 6), at(5, 5)],
      // A ribbon zigzagging between two rows across several columns.
      zigzag: [at(4, 3), at(6, 4), at(4, 5), at(6, 6), at(4, 7), at(6, 8), at(4, 9)],
      // A 5-point star traced as a single continuous path (skip-one-vertex
      // order), spoked out from a center nail.
      star: [at(3, 6), at(8, 8), at(5, 3), at(5, 9), at(8, 4), at(3, 6)],
      // An outward-spiraling zigzag - each leg one step further out and
      // rotated to the next side.
      spiral: [at(6, 6), at(6, 8), at(4, 8), at(4, 4), at(8, 4), at(8, 9), at(3, 9)],
    };

    return Object.entries(shapes).map(([name, points]) => ({
      id: `variety-${name}`,
      name: `variety-${name}`,
      points: points.map((p) => ({ x: p.x, y: p.y })),
      colors: palette,
    }));
  });

  fs.writeFileSync('patterns/variety.json', JSON.stringify(result, null, 2));
  console.log('wrote patterns/variety.json with', result.length, 'patterns:', result.map((p) => p.id).join(', '));
} finally {
  await browser.close();
  server.close();
}
