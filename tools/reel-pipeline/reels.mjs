#!/usr/bin/env node
// The content pipeline's one entry point. A "batch" is a folder under
// batches/ (normally named for the day) that a set of candidate reels moves
// through:
//
//   ideas   -> batches/<name>/recipes/*.json     draft recipes to start from
//   check   -> (console)                         can it be built? strings through other figures' nails, drone crashes
//   sheets  -> batches/<name>/sheets/<id>.jpg    5 frames of each, side by side, to judge without rendering
//   batch   -> batches/<name>/previews/ + index.html   small captioned clips with sound + the review page
//   finish  -> batches/<name>/final/             the picked ones at full 1080x1920, plus their post text
//
// Run `node reels.mjs help` for the commands. See README.md ("Content
// pipeline") and docs/reel-content-pipeline-epic.md for the whole design.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRecipe, renderClip, renderStills, runFfmpeg, FULL_SIZE, PREVIEW_SIZE } from './lib/capture.mjs';
import { editClip } from './lib/edit.mjs';
import { buildIdeas, ARCHETYPE_NAMES } from './lib/ideas.mjs';
import { loadColorHunt, refreshColorHunt, COLORHUNT_FILE } from './lib/colorhunt.mjs';
import { galleryHtml } from './lib/gallery.mjs';
import { readHistory, recordBatch, pickRates, archetypeWeights } from './lib/feedback.mjs';
import { startReviewServer } from './lib/reviewServer.mjs';
import { spawn } from 'node:child_process';
import { nailClashes, flyCrashes } from '../../src/arrange/arrangeReelFrame.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const BATCHES = path.join(ROOT, 'batches');
const HISTORY = path.join(ROOT, 'feedback', 'history.jsonl');
const SHEET_TIMES = [0.02, 0.25, 0.5, 0.75, 0.98];
const SHEET_FRAME = { width: 360, height: 640 };

const HELP = `Usage: node reels.mjs <command>

  ideas  <batch> [--count 20] [--seed N] [--archetypes hours,making-of]
                                           write draft recipes into batches/<batch>/recipes/
  check  <batch> [--only 03,07]            physical check of arrange recipes: a string running through another
                                           figure's nail, two figures' nails in one spot, a fly camera hitting a nail
  sheets <batch> [--only 03,07] [--times 0.1,0.3,0.9]
                                           contact sheet per recipe (5 frames unless --times) -> batches/<batch>/sheets/
  batch  <batch> [--only 03,07]            preview clips (720x1280, captions + sound) and the review page
  finish <batch> <id> [<id> ...] [--edit-only] [--no-record]
                                           full-size reels for the picked ids -> batches/<batch>/final/
  finish <batch> --none                    record that nothing was picked from this batch
  review <batch> [--port 5520] [--no-open] [--model claude-opus-5-5] [--effort medium]
                                           serve the review page on localhost; its "Send to Claude" button
                                           runs the finishing agent headlessly
  render <recipe.json> [--preview] [--out file.mp4]
                                           one recipe, outside any batch
  taste                                    pick rates so far, by archetype and palette
  colorhunt                                re-fetch the palettes drafts are colored from (colorhunt.co) -> palettes/colorhunt.json

Add --software to any rendering command to use the CPU renderer instead of the GPU.
<batch> is a folder name under batches/ (e.g. 2026-11-11) or a path.`;

// ---- small helpers ----

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) positional.push(arg);
    else if (argv[i + 1] === undefined || argv[i + 1].startsWith('--')) flags[arg.slice(2)] = true;
    else flags[arg.slice(2)] = argv[++i];
  }
  return { positional, flags };
}

function batchDir(name) {
  if (!name) throw new Error('Missing <batch>.\n\n' + HELP);
  return path.isAbsolute(name) || name.includes('/') || name.includes('\\') ? path.resolve(name) : path.join(BATCHES, name);
}

/** Every recipe in a batch, in id order: `{ id, slug, file, recipe }`. The id is the file name's leading number. */
function batchRecipes(dir, only = null) {
  const recipesDir = path.join(dir, 'recipes');
  if (!fs.existsSync(recipesDir)) throw new Error(`No recipes folder at ${recipesDir} - run "ideas" first, or write recipes there.`);
  const wanted = only ? new Set(String(only).split(',').map((id) => id.trim())) : null;
  return fs
    .readdirSync(recipesDir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => {
      const slug = path.basename(name, '.json');
      const file = path.join(recipesDir, name);
      return { id: slug.split('-')[0], slug, file, recipe: loadRecipe(file) };
    })
    .filter((entry) => !wanted || wanted.has(entry.id));
}

const hookOf = (recipe) => (recipe.edit?.captions?.[0]?.text ?? '').replace(/\*/g, '').replace(/\n/g, ' ');
const glOf = (flags) => (flags.software ? 'software' : 'hardware');

/** Captures a recipe and runs the edit step on it. Returns how long the capture took. */
async function produce({ recipe, size, rawPath, outPath, workDir, gl, editOnly = false }) {
  const preview = size === PREVIEW_SIZE;
  let seconds = 0;
  if (!editOnly || !fs.existsSync(rawPath)) {
    ({ seconds } = await renderClip(recipe, rawPath, { ...size, gl, crf: preview ? 17 : 15 }));
  }
  await editClip({ rawPath, recipe, outPath, workDir, ...size, crf: preview ? 22 : 18 });
  // Twenty candidates a day adds up: a preview's scratch files go as soon as
  // the preview exists. A final keeps its raw capture so `--edit-only` can
  // redo captions or sound without rendering again.
  fs.rmSync(workDir, { recursive: true, force: true });
  if (preview) fs.rmSync(rawPath, { force: true });
  return seconds;
}

// ---- commands ----

/**
 * The problems with one recipe a real board would have, as printable lines
 * (empty when it could be built as drawn). Only arrange recipes have figures.
 */
function buildProblems(recipe) {
  if (recipe.scene !== 'arrange') return [];
  const lines = [];
  const { clashes, figures } = nailClashes(recipe);
  const strings = clashes.filter((c) => c.kind === 'string');
  const nails = clashes.filter((c) => c.kind === 'nails');
  const shapes = (list) => [...new Set(list.flatMap((c) => c.shapes))].sort((a, b) => a - b).join(', ');
  if (strings.length) lines.push(`${strings.length} figure pair(s) with strings through another figure's nails (shapes ${shapes(strings)} of ${figures} figures)`);
  if (nails.length) lines.push(`${nails.length} figure pair(s) with nails in the same spot (shapes ${shapes(nails)})`);
  const raised = (recipe.shapes ?? []).map((shape, i) => [shape, i]).filter(([shape]) => !recipe.weave?.layerSpacing && shape.base !== undefined && shape.base !== 0).map(([, i]) => i);
  if (raised.length) lines.push(`shapes ${raised.join(', ')} start above the board (base): every figure's strings start at board level`);
  const crashes = flyCrashes(recipe);
  if (crashes.length) {
    const times = crashes.map((c) => `${c.t.toFixed(2)} ${c.what}`);
    lines.push(`fly camera crashes at t = ${times.slice(0, 6).join(', ')}${times.length > 6 ? ', ...' : ''}`);
  }
  return lines;
}

function check({ positional, flags }) {
  const dir = batchDir(positional[0]);
  let bad = 0;
  for (const { slug, recipe } of batchRecipes(dir, flags.only)) {
    const problems = buildProblems(recipe);
    if (problems.length) bad += 1;
    console.log(problems.length ? [slug, ...problems.map((line) => `  - ${line}`)].join('\n') : `${slug}: ok`);
  }
  if (bad) {
    console.log(`\n${bad} recipe(s) could not be built as drawn.`);
    process.exitCode = 1;
  }
}

function warnProblems(slug, recipe) {
  for (const line of buildProblems(recipe)) console.warn(`  ! ${slug}: ${line}`);
}

function ideas({ positional, flags }) {
  const dir = batchDir(positional[0]);
  const recipesDir = path.join(dir, 'recipes');
  if (fs.existsSync(recipesDir) && fs.readdirSync(recipesDir).length > 0) {
    throw new Error(`${recipesDir} already has recipes - pick a new batch name, or empty that folder first.`);
  }
  const count = Number(flags.count ?? 20);
  // Seeded from the batch name by default, so each day gets different drafts but re-running a day reproduces them.
  const seed = Number(flags.seed ?? [...path.basename(dir)].reduce((sum, ch) => (sum * 31 + ch.charCodeAt(0)) >>> 0, 7));
  let weights = archetypeWeights(readHistory(HISTORY), ARCHETYPE_NAMES);
  if (flags.archetypes) {
    // Only these archetypes, in equal shares - for trying particular ideas out.
    const wanted = String(flags.archetypes).split(',').map((name) => name.trim());
    const unknown = wanted.filter((name) => !ARCHETYPE_NAMES.includes(name));
    if (unknown.length) throw new Error(`Unknown archetype ${unknown.join(', ')} - expected any of: ${ARCHETYPE_NAMES.join(', ')}`);
    weights = Object.fromEntries(ARCHETYPE_NAMES.map((name) => [name, wanted.includes(name) ? 1 : 0]));
  }
  fs.mkdirSync(recipesDir, { recursive: true });
  const palettes = loadColorHunt();
  if (!palettes) console.log('No Color Hunt palettes saved yet (run "colorhunt") - using the built-in fallback palettes.');
  for (const { id, recipe } of buildIdeas({ count, seed, weights, ...(palettes ? { palettes } : {}) })) {
    fs.writeFileSync(path.join(recipesDir, `${id}-${recipe.meta.archetype}-${recipe.meta.palette}.json`), JSON.stringify(recipe, null, 2) + '\n');
  }
  console.log(`Wrote ${count} draft recipes to ${recipesDir}`);
  if (weights) console.log(flags.archetypes ? 'Archetypes drafted from:' : 'Archetype weights from pick history:', Object.fromEntries(Object.entries(weights).map(([k, v]) => [k, Number(v.toFixed(2))])));
}

async function sheets({ positional, flags }) {
  const dir = batchDir(positional[0]);
  const workDir = path.join(dir, 'work');
  let failed = 0;
  for (const { id, slug, recipe } of batchRecipes(dir, flags.only)) {
    warnProblems(slug, recipe);
    const times = flags.times ? String(flags.times).split(',').map(Number) : SHEET_TIMES;
    const frames = times.map((t, i) => ({ t, file: path.join(workDir, `${id}-sheet-${i}.jpg`) }));
    const out = path.join(dir, 'sheets', `${id}.jpg`);
    try {
      await renderStills(recipe, frames, { ...SHEET_FRAME, gl: glOf(flags) });
      fs.mkdirSync(path.dirname(out), { recursive: true });
      // hstack needs two or more inputs; a single time is just that frame.
      if (frames.length === 1) fs.copyFileSync(frames[0].file, out);
      else await runFfmpeg([...frames.flatMap((f) => ['-i', f.file]), '-filter_complex', `hstack=inputs=${frames.length}`, '-q:v', '3', out]).finished;
      for (const frame of frames) fs.rmSync(frame.file, { force: true });
      console.log(`sheet ${slug} -> ${out}`);
    } catch (err) {
      failed += 1;
      console.error(`sheet ${slug} FAILED: ${err.message}`);
    }
  }
  if (failed) process.exitCode = 1;
}

async function batch({ positional, flags }) {
  const dir = batchDir(positional[0]);
  const name = path.basename(dir);
  const entries = batchRecipes(dir, flags.only);
  let failed = 0;
  for (const { id, slug, recipe } of entries) {
    warnProblems(slug, recipe);
    const outPath = path.join(dir, 'previews', `${id}.mp4`);
    try {
      const seconds = await produce({
        recipe, size: PREVIEW_SIZE, gl: glOf(flags),
        rawPath: path.join(dir, 'work', `${id}-preview-raw.mp4`), outPath, workDir: path.join(dir, 'work', `${id}-preview`),
      });
      const poster = path.join(dir, 'previews', `${id}.jpg`);
      await runFfmpeg(['-ss', String((recipe.durationSeconds ?? 8) * 0.6), '-i', outPath, '-frames:v', '1', '-q:v', '3', poster]).finished;
      console.log(`preview ${slug} (${seconds.toFixed(0)}s to capture)`);
    } catch (err) {
      failed += 1;
      console.error(`preview ${slug} FAILED: ${err.message}`);
      // An older preview of this recipe would otherwise still show on the page as if it were current.
      fs.rmSync(outPath, { force: true });
      fs.mkdirSync(path.join(dir, 'previews'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'previews', `${id}.error.txt`), String(err.stack ?? err));
    }
  }

  // The page always lists the whole batch, whichever subset was just rendered.
  const items = batchRecipes(dir).map(({ id, slug, recipe }) => {
    const errorFile = path.join(dir, 'previews', `${id}.error.txt`);
    const hasVideo = fs.existsSync(path.join(dir, 'previews', `${id}.mp4`));
    return {
      id, title: recipe.meta?.title ?? slug, archetype: recipe.meta?.archetype ?? '', palette: recipe.meta?.palette ?? '',
      hook: hookOf(recipe), seconds: recipe.durationSeconds ?? 8, video: `previews/${id}.mp4`, poster: `previews/${id}.jpg`,
      error: hasVideo ? undefined : fs.existsSync(errorFile) ? fs.readFileSync(errorFile, 'utf8').slice(0, 600) : 'not rendered yet',
    };
  });
  const page = path.join(dir, 'index.html');
  fs.writeFileSync(page, galleryHtml({ batch: name, items }));
  console.log(`\nReview page: ${page}`);
  if (failed) {
    console.error(`${failed} of ${entries.length} previews failed.`);
    process.exitCode = 1;
  }
}

async function finish({ positional, flags }) {
  const dir = batchDir(positional[0]);
  const ids = new Set(positional.slice(1));
  if (ids.size === 0 && !flags.none) throw new Error('finish needs at least one id, e.g. "finish 2026-11-11 03 07" (or --none to record that nothing was picked).');
  const all = batchRecipes(dir);
  const unknown = [...ids].filter((id) => !all.some((entry) => entry.id === id));
  if (unknown.length) throw new Error(`No recipe with id ${unknown.join(', ')} in ${dir}`);

  let failed = 0;
  for (const { id, slug, recipe } of all.filter((entry) => ids.has(entry.id))) {
    const outPath = path.join(dir, 'final', `${slug}.mp4`);
    try {
      const seconds = await produce({
        recipe, size: FULL_SIZE, gl: glOf(flags), editOnly: Boolean(flags['edit-only']),
        rawPath: path.join(dir, 'raw', `${id}.mp4`), outPath, workDir: path.join(dir, 'work', `${id}-final`),
      });
      const post = recipe.post ?? {};
      fs.writeFileSync(path.join(dir, 'final', `${slug}.txt`), [post.caption ?? '', '', (post.hashtags ?? []).join(' ')].join('\n').trim() + '\n');
      console.log(`final ${outPath}${seconds ? ` (${seconds.toFixed(0)}s to capture)` : ' (edit only)'}`);
    } catch (err) {
      failed += 1;
      console.error(`final ${slug} FAILED: ${err.message}`);
    }
  }

  if (!flags['no-record']) {
    recordBatch(HISTORY, path.basename(dir), all.map(({ id, recipe }) => ({ id, archetype: recipe.meta?.archetype, palette: recipe.meta?.palette, picked: ids.has(id) })));
    console.log(`Recorded picks in ${HISTORY}`);
  }
  if (failed) process.exitCode = 1;
}

async function render({ positional, flags }) {
  if (!positional[0]) throw new Error('render needs a recipe file.\n\n' + HELP);
  const recipe = loadRecipe(positional[0]);
  const slug = path.basename(positional[0], '.json');
  const outPath = path.resolve(flags.out ?? path.join(ROOT, 'output', `${slug}${flags.preview ? '-preview' : ''}.mp4`));
  const workDir = path.join(ROOT, 'output', 'work', slug);
  const seconds = await produce({
    recipe, size: flags.preview ? PREVIEW_SIZE : FULL_SIZE, gl: glOf(flags),
    rawPath: path.join(workDir, 'raw.mp4'), outPath, workDir,
  });
  console.log(`${outPath} (${seconds.toFixed(0)}s to capture)`);
}

function taste() {
  const history = readHistory(HISTORY);
  if (history.length === 0) {
    console.log('No picks recorded yet - history fills in each time "finish" runs.');
    return;
  }
  for (const key of ['archetype', 'palette']) {
    console.log(`\nBy ${key}:`);
    const rows = Object.entries(pickRates(history, key)).sort((a, b) => b[1].rate - a[1].rate);
    for (const [value, { shown, picked, rate }] of rows) console.log(`  ${value.padEnd(16)} ${picked}/${shown} picked (${Math.round(rate * 100)}%)`);
  }
}

async function review({ positional, flags }) {
  const dir = batchDir(positional[0]);
  if (!fs.existsSync(path.join(dir, 'index.html'))) throw new Error(`No review page in ${dir} - run "batch" first.`);
  const { url } = await startReviewServer({
    batchDir: dir,
    repoRoot: path.resolve(ROOT, '..', '..'),
    pipelineRoot: ROOT,
    port: Number(flags.port ?? 5520),
    model: flags.model ?? 'claude-opus-5-5',
    effort: flags.effort ?? 'medium',
    dryRun: Boolean(flags['dry-run']),
  });
  console.log(`Review page: ${url}  (stops by itself after 20 idle hours; Ctrl+C to stop now)`);
  if (!flags['no-open']) spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
}

async function colorhunt() {
  const palettes = await refreshColorHunt();
  console.log(`Saved ${palettes.length} palettes to ${COLORHUNT_FILE}`);
}

const COMMANDS = { ideas, check, sheets, batch, finish, render, taste, colorhunt, review };

const [command, ...rest] = process.argv.slice(2);
if (!command || command === 'help' || !COMMANDS[command]) {
  console.log(HELP);
  process.exitCode = command && command !== 'help' ? 1 : 0;
} else {
  try {
    await COMMANDS[command](parseArgs(rest));
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
  }
}
