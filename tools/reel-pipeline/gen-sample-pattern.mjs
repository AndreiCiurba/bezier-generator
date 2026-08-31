// One-off generator for patterns/sample.json - builds a small diamond shape
// out of *real* current-grid nail positions (read live from the running
// page), so every translated copy stamped by stampThroughoutGrid is
// guaranteed to land on real nails without having to hand-derive the
// rotated-lattice math (see ThreeApp.js's buildGridConfig/GRID_SPACING).
// Not part of the ongoing pipeline - run once, inspect the output, done.
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

  const pattern = await page.evaluate(() => {
    const points = window.__reelTimeline.sceneSync.grid.points;
    // Pick 4 real nails forming a small diamond: an anchor, its neighbor two
    // steps to the right, and two rows down - all well inside the grid so
    // the shape's edges also land on real nails almost everywhere it's
    // translated to.
    const cols = Math.round(Math.sqrt(points.length));
    const idx = (row, col) => row * cols + col;
    const shape = [points[idx(5, 5)], points[idx(5, 7)], points[idx(7, 6)], points[idx(5, 5)]];
    return shape.map((p) => ({ x: p.x, y: p.y }));
  });

  const palette = await page.evaluate(() => window.__reelTimeline.palette.snapshot());

  const raw = [
    {
      id: 'sample-diamond',
      name: 'sample-diamond',
      points: pattern,
      colors: palette,
    },
  ];
  fs.writeFileSync('patterns/sample.json', JSON.stringify(raw, null, 2));
  console.log('wrote patterns/sample.json:', JSON.stringify(raw));
} finally {
  await browser.close();
  server.close();
}
