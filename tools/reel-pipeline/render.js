#!/usr/bin/env node
// Headless capture half of the reel pipeline (see
// ../../src/three-page/ReelTimeline.js for the in-app half it drives).
//
// Usage: node render.js <recipe.json> [--keep-frames] [--port 5510] [--raw]
//
// For each output frame: seeks the /3d page's ReelTimeline to that frame's
// normalized time - deterministic frame-by-frame capture, not real-time
// recording, so a slow render never drops frames or skews timing.
//
// Two capture modes:
// - Default (PNG): screenshots the canvas to a PNG file per frame, then
//   ffmpeg reads the whole sequence back and encodes it. Simple, easy to
//   inspect frame-by-frame (`--keep-frames`), but each frame pays for a
//   PNG encode in Chrome and a PNG decode in ffmpeg, plus disk I/O for
//   every file.
// - `--raw`: reads raw RGBA pixels straight off the WebGL context
//   (`ReelTimeline#readPixelsBase64`) and pipes them directly into a
//   persistent ffmpeg process's stdin as they're captured - no per-frame
//   image codec, no intermediate files. See that method's own doc for why
//   the transport is base64 rather than a raw byte array. Nothing is
//   written to disk until the final encoded video.
//
// Needs network access once, the same as opening /3d in a normal browser:
// Three.js itself loads from a CDN import map (see 3d/index.html), not
// bundled into this repo.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import puppeteer from 'puppeteer';
import ffmpegPath from 'ffmpeg-static';
import { startStaticServer, REPO_ROOT } from './static-server.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FPS = 30;
const VIEWPORT = { width: 1080, height: 1920 };

function parseArgs(argv) {
  const args = { keepFrames: false, port: 5510, recipePath: null, raw: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--keep-frames') args.keepFrames = true;
    else if (arg === '--raw') args.raw = true;
    else if (arg === '--port') args.port = Number(argv[++i]);
    else if (!arg.startsWith('--')) args.recipePath = arg;
  }
  if (!args.recipePath) {
    throw new Error('Usage: node render.js <recipe.json> [--keep-frames] [--port 5510] [--raw]');
  }
  return args;
}

/**
 * Loads a recipe JSON file and rewrites its `pattern` field (if present)
 * from a path relative to the recipe file into a site-root-relative URL
 * path - so a recipe author can write the friendly `"./patterns/foo.json"`
 * on disk, while the in-browser `fetch(recipe.pattern)` in
 * ReelTimeline#load (which resolves relative to /3d/index.html, not to the
 * recipe file's location) still gets a path that actually works.
 */
function loadRecipe(recipePath) {
  const raw = JSON.parse(fs.readFileSync(recipePath, 'utf8'));
  if (!raw.pattern) return raw;

  const recipeDir = path.dirname(path.resolve(recipePath));
  const patternAbsPath = path.resolve(recipeDir, raw.pattern);
  const patternUrlPath = '/' + path.relative(REPO_ROOT, patternAbsPath).split(path.sep).join('/');
  return { ...raw, pattern: patternUrlPath };
}

function totalFramesFor(recipe) {
  return Math.max(1, Math.round((recipe.durationSeconds ?? 8) * FPS));
}

function logProgress(i, totalFrames) {
  if (i % FPS === 0 || i === totalFrames - 1) {
    process.stdout.write(`\r  captured frame ${i + 1}/${totalFrames}`);
  }
}

// ---- PNG-per-frame capture (default) ----

async function captureFramesToPng(page, recipe, framesDir) {
  const totalFrames = totalFramesFor(recipe);
  const canvas = await page.$('#three-canvas');
  if (!canvas) throw new Error('render.js: #three-canvas not found on the page - did /3d/index.html load correctly?');

  for (let i = 0; i < totalFrames; i++) {
    const t = totalFrames === 1 ? 0 : i / (totalFrames - 1);
    await page.evaluate((t) => window.__reelTimeline.seek(t), t);
    const framePath = path.join(framesDir, `frame_${String(i).padStart(5, '0')}.png`);
    await canvas.screenshot({ path: framePath });
    logProgress(i, totalFrames);
  }
  process.stdout.write('\n');
  return totalFrames;
}

function encodeVideoFromPngSequence(framesDir, outputPath) {
  return new Promise((resolve, reject) => {
    const ff = spawn(ffmpegPath, [
      '-y',
      '-framerate', String(FPS),
      '-i', path.join(framesDir, 'frame_%05d.png'),
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      outputPath,
    ]);
    ff.stderr.on('data', (chunk) => process.stderr.write(chunk));
    ff.on('error', reject);
    ff.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited with code ${code}`))));
  });
}

// ---- Raw pixel pipe capture (--raw) ----

/** Resolves once `stream.write(buffer)` has actually drained, not just been queued - correct backpressure handling for a stream ffmpeg reads slower than we might produce frames. */
function writeAsync(stream, buffer) {
  return new Promise((resolve, reject) => {
    const ok = stream.write(buffer, (err) => (err ? reject(err) : undefined));
    if (ok) resolve();
    else stream.once('drain', resolve);
  });
}

/**
 * Spawns ffmpeg once, configured to read a raw RGBA byte stream from stdin
 * (rather than an encoded image sequence from disk) and encode it straight
 * to the final MP4. `vflip` corrects WebGL's bottom-to-top row order (see
 * `ReelTimeline#readPixelsBase64`) - cheaper to let ffmpeg do it once per
 * frame during encode than to flip rows in JS on every capture.
 * @returns {{proc: import('node:child_process').ChildProcess, finished: Promise<void>}}
 */
function startRawEncoder({ width, height, outputPath }) {
  const proc = spawn(ffmpegPath, [
    '-y',
    '-f', 'rawvideo',
    '-pixel_format', 'rgba',
    '-video_size', `${width}x${height}`,
    '-framerate', String(FPS),
    '-i', 'pipe:0',
    '-vf', 'vflip',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    outputPath,
  ]);
  proc.stderr.on('data', (chunk) => process.stderr.write(chunk));
  const finished = new Promise((resolve, reject) => {
    proc.on('error', reject);
    proc.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited with code ${code}`))));
  });
  return { proc, finished };
}

async function captureFramesRaw(page, recipe, outputPath) {
  const totalFrames = totalFramesFor(recipe);
  const { width, height } = await page.evaluate(() => window.__reelTimeline.getFrameSize());

  const { proc, finished } = startRawEncoder({ width, height, outputPath });

  for (let i = 0; i < totalFrames; i++) {
    const t = totalFrames === 1 ? 0 : i / (totalFrames - 1);
    // One evaluate call does both the seek and the pixel readback, instead
    // of two separate round-trips to the page per frame.
    const base64 = await page.evaluate((t) => {
      window.__reelTimeline.seek(t);
      return window.__reelTimeline.readPixelsBase64();
    }, t);
    await writeAsync(proc.stdin, Buffer.from(base64, 'base64'));
    logProgress(i, totalFrames);
  }
  process.stdout.write('\n');

  proc.stdin.end();
  await finished;
  return totalFrames;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const recipe = loadRecipe(args.recipePath);
  const recipeName = path.basename(args.recipePath, '.json');

  const outputDir = path.join(__dirname, 'output');
  fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, `${recipeName}-${Date.now()}.mp4`);

  const framesDir = args.raw ? null : path.join(__dirname, 'frames', `${recipeName}-${Date.now()}`);
  if (framesDir) fs.mkdirSync(framesDir, { recursive: true });

  console.log(`Starting static server for ${REPO_ROOT} ...`);
  const server = await startStaticServer(args.port);

  console.log('Launching headless Chrome ...');
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      // Software WebGL fallback for headless Chrome - real GPU access is
      // rarely available in a headless/CI context. Flagged in the plan as a
      // "validate first" risk: if frames come out black, this is the first
      // thing to revisit (try '--use-gl=angle', '--use-angle=gl', or a
      // machine with real GPU passthrough instead).
      '--enable-unsafe-swiftshader',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--no-sandbox',
    ],
  });

  try {
    const page = await browser.newPage();
    page.on('console', (msg) => console.log(`  [page] ${msg.text()}`));
    page.on('pageerror', (err) => console.error(`  [page error] ${err}`));
    await page.setViewport({ ...VIEWPORT, deviceScaleFactor: 1 });

    console.log(`Navigating to /3d/index.html?reel=1 on port ${args.port} ...`);
    await page.goto(`http://localhost:${args.port}/3d/index.html?reel=1`, { waitUntil: 'networkidle0' });
    await page.waitForFunction('window.__reelTimeline !== undefined', { timeout: 15000 });

    console.log('Loading recipe ...');
    await page.evaluate((recipe) => window.__reelTimeline.load(recipe), recipe);

    if (args.raw) {
      console.log('Capturing frames (raw pixel pipe) ...');
      const totalFrames = await captureFramesRaw(page, recipe, outputPath);
      console.log(`Done: ${outputPath} (${totalFrames} frames)`);
    } else {
      console.log('Capturing frames (PNG per frame) ...');
      const totalFrames = await captureFramesToPng(page, recipe, framesDir);
      console.log(`Encoding ${totalFrames} frames -> ${outputPath} ...`);
      await encodeVideoFromPngSequence(framesDir, outputPath);
      console.log(`Done: ${outputPath}`);
    }
  } finally {
    await browser.close();
    server.close();
    if (framesDir && !args.keepFrames) fs.rmSync(framesDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
