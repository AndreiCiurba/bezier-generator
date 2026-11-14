// Palettes from Color Hunt (colorhunt.co), the source the reels take their
// colors from. `refreshColorHunt` pulls the most-liked palettes under a set of
// tags from the site's own feed and saves the ones that suit strings on a
// dark background to palettes/colorhunt.json, which is tracked in git so a
// batch never depends on the site being reachable.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FEED = 'https://colorhunt.co/php/feed.php';
export const COLORHUNT_FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'palettes', 'colorhunt.json');

// Moods that read well as glowing thread. Pastel/"light" palettes are left
// to the general "popular" feed, where only the strongest survive the cut.
const TAGS = ['neon', 'sunset', 'gradient', 'rainbow', 'retro', 'night', 'warm', 'cold', 'gold', 'summer', 'space', 'popular'];
const PER_TAG = 6;

function luminance(hex) {
  const channel = (i) => {
    const v = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}

/**
 * A Color Hunt code is four hex colors run together. Colors too dark to show
 * as thread on a near-black background are dropped (the site's order of the
 * rest is kept - it is part of the palette's design).
 * @param {string} code e.g. "222831393e4600adb5eeeeee"
 * @returns {string[]} the usable colors, as "#rrggbb"
 */
export function usableColors(code) {
  const colors = [0, 6, 12, 18].map((i) => '#' + code.slice(i, i + 6));
  return colors.filter((color) => luminance(color) >= 0.07);
}

async function fetchFeed(tag) {
  const body = new URLSearchParams({ step: '0', sort: 'popular', tags: tag === 'popular' ? '' : tag, timeframe: '4000' });
  const response = await fetch(FEED, { method: 'POST', body, headers: { 'User-Agent': 'string-art-reel-pipeline' } });
  if (!response.ok) throw new Error(`Color Hunt feed for "${tag}" answered ${response.status}`);
  return response.json();
}

/**
 * Fetches and saves the palette list.
 * @returns {Promise<object[]>} the saved palettes
 */
export async function refreshColorHunt() {
  const seen = new Set();
  const palettes = [];
  for (const tag of TAGS) {
    const feed = await fetchFeed(tag);
    let taken = 0;
    for (const { code, likes } of feed) {
      if (taken >= PER_TAG) break;
      if (seen.has(code)) continue;
      const colors = usableColors(code);
      if (colors.length < 3) continue; // a gradient up the layers wants at least three stops
      seen.add(code);
      taken += 1;
      palettes.push({ name: `${tag}-${code.slice(0, 6)}`, tag, colors, likes: Number(likes), source: `https://colorhunt.co/palette/${code}` });
    }
  }
  fs.mkdirSync(path.dirname(COLORHUNT_FILE), { recursive: true });
  fs.writeFileSync(COLORHUNT_FILE, JSON.stringify(palettes, null, 2) + '\n');
  return palettes;
}

/** The saved palettes as `{ name: colors }`, or null if none have been fetched yet. */
export function loadColorHunt() {
  if (!fs.existsSync(COLORHUNT_FILE)) return null;
  const palettes = JSON.parse(fs.readFileSync(COLORHUNT_FILE, 'utf8'));
  return palettes.length ? Object.fromEntries(palettes.map((palette) => [palette.name, palette.colors])) : null;
}
