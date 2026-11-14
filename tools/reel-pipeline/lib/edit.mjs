// The "CapCut step": takes a silent raw clip and the recipe's `edit` section
// and produces the finished reel - captions burned in, soundtrack underneath,
// optional fades. Kept apart from capture so an edit can be redone (new
// caption wording, different sound) in seconds without re-rendering the 3D.
//
// recipe.edit:
// - captions: [{ text, start, end, position, size, style, color, accent }]
//     text      `*stars*` mark words to draw in the accent color; "\n" breaks a line
//     start/end seconds into the clip (end defaults to the end of the clip)
//     position  "top" | "center" | "bottom", or a number 0..1 down the frame
//     size      "xl" | "l" | "m" | "s"
//     style     "plain" (white text, soft shadow) | "pill" (on a dark rounded plate)
// - handle: small account tag held at the foot of the frame for the whole clip
// - audio:
//     { file, start, volume }   a track of your own, path relative to tools/reel-pipeline/audio/
//     { synth: {...} }          synthesized plucked strings - see audio.mjs#synthesizeTrack
//     false                     silent
//   Left out entirely, a synthesized track with default settings is used.
// - fadeIn / fadeOut: seconds of fade from/to black (default 0 - a reel should
//   open on its strongest frame and loop cleanly)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { runFfmpeg, FPS } from './capture.mjs';
import { synthesizeTrack, writeWav } from './audio.mjs';
import { resolveTrack } from '../../../src/cardioid/cardioidReelFrame.js';

const PIPELINE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CAPTION_FADE = 0.25;

// Fractions of frame height. "top" and "bottom" sit inside the band Instagram
// and TikTok leave clear of their own interface (roughly the top 12% and the
// bottom 22% are covered by the account row, caption and buttons).
const POSITIONS = { top: 0.16, center: 0.5, bottom: 0.76 };
// Font size as a fraction of frame width.
const SIZES = { xl: 0.105, l: 0.08, m: 0.058, s: 0.04 };

const escapeHtml = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function captionHtml(caption, width, height) {
  const size = (SIZES[caption.size] ?? SIZES.l) * width;
  const y = (typeof caption.position === 'number' ? caption.position : POSITIONS[caption.position] ?? POSITIONS.top) * height;
  const accent = caption.accent ?? '#ffd166';
  const text = escapeHtml(caption.text)
    .replace(/\*(.+?)\*/g, `<span style="color:${accent}">$1</span>`)
    .replace(/\n/g, '<br>');
  const pill = caption.style === 'pill';
  return `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;width:${width}px;height:${height}px;background:transparent;overflow:hidden">
    <div style="position:absolute;left:0;right:0;top:${y}px;transform:translateY(-50%);display:flex;justify-content:center;padding:0 ${width * 0.08}px">
      <div style="
        font-family:'Segoe UI','Helvetica Neue',Arial,sans-serif;font-weight:${caption.size === 's' ? 600 : 900};
        font-size:${size}px;line-height:1.12;letter-spacing:-0.01em;text-align:center;text-wrap:balance;
        color:${caption.color ?? '#ffffff'};
        ${pill
          ? `background:rgba(8,8,12,0.72);padding:${size * 0.28}px ${size * 0.5}px;border-radius:${size * 0.4}px;`
          : `text-shadow:0 0 ${size * 0.25}px rgba(0,0,0,0.9),0 ${size * 0.04}px ${size * 0.08}px rgba(0,0,0,0.9);`}
      ">${text}</div>
    </div></body></html>`;
}

/** Renders each caption to a transparent full-frame PNG, the same size as the video. */
async function renderCaptionImages(captions, width, height, workDir) {
  if (captions.length === 0) return [];
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    const files = [];
    for (let i = 0; i < captions.length; i++) {
      await page.setContent(captionHtml(captions[i], width, height));
      const file = path.join(workDir, `caption-${i}.png`);
      await page.screenshot({ path: file, omitBackground: true });
      files.push(file);
    }
    return files;
  } finally {
    await browser.close();
  }
}

/**
 * The synthesized track's two cues, read off the recipe: how complete the
 * weave is at each moment, and whether strings are being added right then. A
 * recipe with no build-up (`weave.drawProgress` constant or absent) plays
 * steadily and climbs across the whole clip instead.
 */
function soundCuesFor(recipe) {
  const duration = recipe.durationSeconds ?? 8;
  const track = recipe.weave?.drawProgress;
  if (!track || typeof track === 'number') {
    return { activity: () => 0.6, progress: (seconds) => seconds / duration, accents: [] };
  }
  const progress = (seconds) => resolveTrack(track, Math.min(1, seconds / duration), 1);
  const activity = (seconds) => (progress(seconds + 0.12) - progress(seconds) > 1e-4 ? 1 : 0);
  // An accent lands where the weave completes.
  let finished = null;
  for (let seconds = 0; seconds < duration; seconds += 0.05) {
    if (progress(seconds) >= 0.999) {
      finished = seconds;
      break;
    }
  }
  return { activity, progress, accents: finished !== null && finished > 0.5 ? [finished] : [] };
}

/**
 * A making-of recipe's workshop sounds, read off its `making` tracks: a knock
 * for each hammer blow (three per nail, thinned out once the nails are going
 * in faster than a hammer could be heard to), and a hiss while paint is going on.
 */
function workshopCuesFor(recipe) {
  const making = recipe.making;
  if (!making) return { knocks: [], hisses: [] };
  const duration = recipe.durationSeconds ?? 8;
  const nailCount = Math.round(resolveTrack(recipe.weave?.nailCount, 0, 120));
  const STEP = 1 / 120;
  const MIN_KNOCK_GAP = 0.075;
  const knocks = [];
  const hisses = [];
  let blows = 0;
  let hissStart = null;
  for (let seconds = 0; seconds <= duration; seconds += STEP) {
    const t = seconds / duration;
    const done = Math.floor(Math.min(1, Math.max(0, resolveTrack(making.nails, t, 1))) * nailCount * 3 + 1e-6);
    if (done > blows && seconds > 0 && (knocks.length === 0 || seconds - knocks[knocks.length - 1] >= MIN_KNOCK_GAP)) knocks.push(seconds);
    blows = done;

    const paint = resolveTrack(making.paint, t, 1);
    const spraying = paint > 0 && paint < 1;
    if (spraying && hissStart === null) hissStart = seconds;
    if (!spraying && hissStart !== null) {
      hisses.push({ start: hissStart, end: seconds });
      hissStart = null;
    }
  }
  // A recipe that opens with every nail already in has nothing to knock in.
  if (resolveTrack(making.nails, 0, 1) >= 1) knocks.length = 0;
  return { knocks, hisses };
}

/** Resolves the soundtrack for a recipe to ffmpeg input args + an audio filter, or null for a silent clip. */
function prepareAudio(recipe, workDir) {
  const audio = recipe.edit?.audio;
  const duration = recipe.durationSeconds ?? 8;
  // Silent unless a recipe asks for sound: Andrei attaches music in the app, if at all.
  if (!audio) return null;

  if (audio?.file) {
    const file = path.resolve(PIPELINE_ROOT, 'audio', audio.file);
    if (!fs.existsSync(file)) throw new Error(`edit.audio.file not found: ${file}`);
    return {
      inputArgs: ['-ss', String(audio.start ?? 0), '-i', file],
      filter: `volume=${audio.volume ?? 1},afade=t=in:d=0.05,afade=t=out:st=${Math.max(0, duration - 0.5)}:d=0.5`,
    };
  }

  const cues = soundCuesFor(recipe);
  const synth = audio?.synth ?? {};
  const wav = path.join(workDir, 'soundtrack.wav');
  writeWav(wav, synthesizeTrack({ durationSeconds: duration, accents: cues.accents, ...workshopCuesFor(recipe), ...synth }, cues.activity, cues.progress));
  return { inputArgs: ['-i', wav], filter: `volume=${audio?.volume ?? 1}` };
}

/**
 * @param {{rawPath:string, recipe:object, outPath:string, workDir:string, width:number, height:number, crf?:number}} params
 *   `width`/`height` are the raw clip's own size (captions are drawn to match).
 *   `crf` is x264's quality setting (lower = better and bigger): thousands of
 *   thin moving strings are about the most expensive picture there is to
 *   compress, so a review preview is given far fewer bits than a final, and
 *   every clip is capped at 12 Mbit/s (a fly-through would otherwise run to
 *   several times that - far more than a phone or the platforms keep).
 */
export async function editClip({ rawPath, recipe, outPath, workDir, width, height, crf = 20 }) {
  fs.mkdirSync(workDir, { recursive: true });
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const edit = recipe.edit ?? {};
  const duration = recipe.durationSeconds ?? 8;

  const captions = [...(edit.captions ?? [])];
  if (edit.handle) captions.push({ text: edit.handle, start: 0, end: duration, position: 0.815, size: 's', color: 'rgba(255,255,255,0.7)', hold: true });
  const captionFiles = await renderCaptionImages(captions, width, height, workDir);
  const audio = prepareAudio(recipe, workDir);

  const inputs = ['-i', rawPath];
  for (const file of captionFiles) inputs.push('-loop', '1', '-framerate', String(FPS), '-t', String(duration), '-i', file);
  if (audio) inputs.push(...audio.inputArgs);

  const filters = [];
  let last = '0:v';
  const videoFades = [];
  if (edit.fadeIn) videoFades.push(`fade=t=in:d=${edit.fadeIn}`);
  if (edit.fadeOut) videoFades.push(`fade=t=out:st=${duration - edit.fadeOut}:d=${edit.fadeOut}`);
  if (videoFades.length) {
    filters.push(`[0:v]${videoFades.join(',')}[faded]`);
    last = 'faded';
  }
  captions.forEach((caption, i) => {
    const start = caption.start ?? 0;
    const end = Math.min(duration, caption.end ?? duration);
    // A held caption (the handle) is simply there; the rest fade in and out
    // and settle upward a few pixels as they arrive.
    const fade = caption.hold ? '' : `,fade=t=in:st=${start}:d=${CAPTION_FADE}:alpha=1,fade=t=out:st=${end - CAPTION_FADE}:d=${CAPTION_FADE}:alpha=1`;
    const rise = caption.hold ? '0' : `H*0.012*pow(1-min(1\\,max(0\\,(t-${start})/0.35))\\,2)`;
    filters.push(`[${i + 1}:v]format=rgba${fade}[cap${i}]`);
    filters.push(`[${last}][cap${i}]overlay=x=0:y='${rise}':enable='between(t,${start},${end})'[v${i}]`);
    last = `v${i}`;
  });
  const audioIndex = 1 + captionFiles.length;
  if (audio) filters.push(`[${audioIndex}:a]${audio.filter}[aout]`);

  const args = [...inputs];
  if (filters.length) args.push('-filter_complex', filters.join(';'));
  args.push('-map', last === '0:v' ? '0:v' : `[${last}]`);
  if (audio) args.push('-map', '[aout]', '-c:a', 'aac', '-b:a', '192k');
  args.push('-t', String(duration), '-c:v', 'libx264', '-preset', 'medium', '-crf', String(crf), '-maxrate', '12M', '-bufsize', '24M', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', outPath);
  await runFfmpeg(args).finished;
}
