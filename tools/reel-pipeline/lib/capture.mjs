// Shared headless-capture core for the content pipeline (reels.mjs): opens a
// reel-mode page for a recipe, seeks it frame by frame, and either pipes the
// frames into ffmpeg (a clip) or saves single frames (stills).
//
// render.js / preview-frame.mjs are the original single-recipe tools for the
// /3d page and are left as they were; this module does the same job for any
// scene (see SCENES), at any size, and on the real GPU when there is one.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import puppeteer from 'puppeteer';
import ffmpegPath from 'ffmpeg-static';
import { startStaticServer, REPO_ROOT } from '../static-server.js';

export const FPS = 30;
export const FULL_SIZE = { width: 1080, height: 1920 };
export const PREVIEW_SIZE = { width: 720, height: 1280 };
// Clips render at this multiple of their size and are scaled down by ffmpeg
// (area averaging) - supersampling, so fine strings are smooth, not grainy.
export const SUPERSAMPLE = 2;

/** Which page a recipe's `scene` field loads, and the canvas it draws on. `3d` is the default (recipes written before `scene` existed). */
export const SCENES = {
  '3d': { url: '/3d/index.html?reel=1', canvas: '#three-canvas' },
  cardioid: { url: '/cardioid/index.html?reel=1', canvas: '#cardioid-canvas' },
  // Woven shapes composed on the Arrange board (src/arrange/arrangeReelFrame.js).
  arrange: { url: '/arrange/index.html?reel=1', canvas: '#arrange-canvas' },
  // The /3d page's nail lattice, every cell woven (src/three-page/gridReelFrame.js).
  grid: { url: '/3d/index.html?reel=1', canvas: '#three-canvas' },
};

// `hardware` renders on the machine's own GPU through ANGLE/D3D11 - many
// times faster than `software` (SwiftShader, the CPU rasterizer render.js
// uses), which stays available for a machine or CI box with no usable GPU.
const GL_ARGS = {
  hardware: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'],
  software: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
};

/**
 * Reads a recipe file. A `pattern` path (written relative to the recipe file)
 * is rewritten to a site-root URL, because the page - not Node - fetches it.
 */
export function loadRecipe(recipePath) {
  const raw = JSON.parse(fs.readFileSync(recipePath, 'utf8'));
  if (!raw.pattern) return raw;
  const patternAbsPath = path.resolve(path.dirname(path.resolve(recipePath)), raw.pattern);
  return { ...raw, pattern: '/' + path.relative(REPO_ROOT, patternAbsPath).split(path.sep).join('/') };
}

export function frameCount(recipe, fps = FPS) {
  return Math.max(1, Math.round((recipe.durationSeconds ?? 8) * fps));
}

/**
 * Opens the recipe's page in headless Chrome with the recipe loaded.
 * @param {object} recipe
 * @param {{width?:number, height?:number, gl?:'hardware'|'software'}} [options]
 */
export async function openSession(recipe, { width = FULL_SIZE.width, height = FULL_SIZE.height, gl = 'hardware', scale = 1 } = {}) {
  const scene = SCENES[recipe.scene ?? '3d'];
  if (!scene) throw new Error(`Unknown scene "${recipe.scene}" - expected one of: ${Object.keys(SCENES).join(', ')}`);

  const server = await startStaticServer(0); // any free port, so several captures can run side by side
  const port = server.address().port;
  const browser = await puppeteer.launch({ headless: true, args: [...GL_ARGS[gl], '--no-sandbox'] });
  const close = async () => {
    await browser.close();
    server.close();
  };

  try {
    const page = await browser.newPage();
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(String(err)));
    // The pages render at devicePixelRatio (capped at 2), so this is how supersampling is asked for.
    await page.setViewport({ width, height, deviceScaleFactor: scale });
    await page.goto(`http://localhost:${port}${scene.url}`, { waitUntil: 'networkidle0' });
    await page.waitForFunction('window.__reelTimeline !== undefined', { timeout: 20000 });
    await page.evaluate((r) => window.__reelTimeline.load(r), recipe);
    if (pageErrors.length) throw new Error(`Page errors while loading the recipe:\n${pageErrors.join('\n')}`);

    /** Seeks to normalized time `t` and returns that frame as JPEG bytes. */
    const grabJpeg = async (t) => {
      const dataUrl = await page.evaluate(
        (time, selector) => {
          window.__reelTimeline.seek(time);
          return document.querySelector(selector).toDataURL('image/jpeg', 0.95);
        },
        t,
        scene.canvas
      );
      return Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
    };
    return { page, grabJpeg, close, pageErrors };
  } catch (err) {
    await close();
    throw err;
  }
}

function writeAsync(stream, buffer) {
  return new Promise((resolve, reject) => {
    const ok = stream.write(buffer, (err) => (err ? reject(err) : undefined));
    if (ok) resolve();
    else stream.once('drain', resolve);
  });
}

/** Runs ffmpeg to completion; rejects with its last lines of output on failure. */
export function runFfmpeg(args, { stdin = 'ignore' } = {}) {
  const proc = spawn(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: [stdin, 'ignore', 'pipe'] });
  let stderr = '';
  proc.stderr.on('data', (chunk) => (stderr += chunk));
  const finished = new Promise((resolve, reject) => {
    proc.on('error', reject);
    proc.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited with code ${code}\n${stderr.slice(-2000)}`))));
  });
  return { proc, finished };
}

/**
 * Renders a whole recipe to a silent MP4 - the "raw clip" the edit step
 * (edit.mjs) then cuts, captions and scores.
 * @param {object} recipe
 * @param {string} outPath
 * @param {{width?:number, height?:number, gl?:'hardware'|'software', crf?:number, onFrame?:(done:number,total:number)=>void}} [options]
 * @returns {Promise<{frames:number, seconds:number}>} how many frames, and how long the capture took
 */
export async function renderClip(recipe, outPath, options = {}) {
  const started = Date.now();
  const total = frameCount(recipe);
  const session = await openSession(recipe, { ...options, scale: SUPERSAMPLE });
  const width = options.width ?? FULL_SIZE.width;
  const height = options.height ?? FULL_SIZE.height;
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const { proc, finished } = runFfmpeg(
    [
      '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(FPS), '-i', 'pipe:0',
      // JPEG frames are full-range; phones expect the usual TV range.
      '-vf', `scale=${width}:${height}:flags=area:out_range=tv,format=yuv420p`,
      '-c:v', 'libx264', '-preset', 'medium', '-crf', String(options.crf ?? 17), '-movflags', '+faststart',
      outPath,
    ],
    { stdin: 'pipe' }
  );
  try {
    for (let i = 0; i < total; i++) {
      await writeAsync(proc.stdin, await session.grabJpeg(total === 1 ? 0 : i / (total - 1)));
      options.onFrame?.(i + 1, total);
    }
    proc.stdin.end();
    await finished;
    if (session.pageErrors.length) throw new Error(`Page errors during capture:\n${session.pageErrors.join('\n')}`);
  } finally {
    proc.stdin.destroy();
    await session.close();
  }
  return { frames: total, seconds: (Date.now() - started) / 1000 };
}

/**
 * Saves single frames of a recipe - for judging a recipe without rendering it.
 * @param {object} recipe
 * @param {{t:number, file:string}[]} shots normalized clip times and where to save each (JPEG)
 * @param {{width?:number, height?:number, gl?:'hardware'|'software'}} [options]
 */
export async function renderStills(recipe, shots, options = {}) {
  const session = await openSession(recipe, options);
  try {
    for (const { t, file } of shots) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, await session.grabJpeg(t));
    }
    if (session.pageErrors.length) throw new Error(`Page errors during capture:\n${session.pageErrors.join('\n')}`);
  } finally {
    await session.close();
  }
}
