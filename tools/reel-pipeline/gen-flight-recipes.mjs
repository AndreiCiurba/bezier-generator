// Generates the "flight" recipe family: full 360 orbit -> small dive to the
// center -> reverse direction -> another full 360 orbit, star pattern
// auto-stamped across the whole grid, 25-color palette. Only the `colors`
// track differs between the four variants (red/green/blue shades, and a
// full ROYGBIV rainbow spread across the 25 layers) - everything else is
// shared, so it's generated once and reused.
import fs from 'node:fs';

const DURATION_SECONDS = 16;
const COLOR_COUNT = 25;

// Standard HSL -> hex, s/l in [0,1], h in degrees.
function hslToHex(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = ((h % 360) + 360) % 360 / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let [r, g, b] = [0, 0, 0];
  if (hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = l - c / 2;
  const toHex = (v) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** A flat color track (same color at t=0 and t=1) for one layer. */
function staticLayer(layer, hex) {
  return { layer, keyframes: [{ t: 0, color: hex }, { t: 1, color: hex }] };
}

/** 25 shades of one hue, sweeping lightness dark -> bright across the layers. */
function shadesOf(hue) {
  return Array.from({ length: COLOR_COUNT }, (_, i) => {
    const lightness = 0.22 + (i / (COLOR_COUNT - 1)) * 0.6; // 22% -> 82%
    return staticLayer(i, hslToHex(hue, 0.85, lightness));
  });
}

/** A full ROYGBIV spread across the 25 layers, red at layer 0 to violet at the last. */
function rainbowGradient() {
  return Array.from({ length: COLOR_COUNT }, (_, i) => {
    const hue = (i / (COLOR_COUNT - 1)) * 280; // 0=red ... ~280=violet, matches R-O-Y-G-B-I-V order in HSL hue space
    return staticLayer(i, hslToHex(hue, 0.85, 0.55));
  });
}

// Shared camera: 0->360 orbit, a brief dive to the board's center around the
// midpoint (small angular creep during the dive itself - the "small
// flythrough" - not another full revolution), then the *same* 360 swept
// backwards (370 -> 10) for the reverse leg. Radius/height dip mirrors
// flythrough.json's dive depth.
const camera = {
  angleKeyframes: [
    { t: 0, value: 0 },
    { t: 0.45, value: 360 },
    { t: 0.5, value: 372 },
    { t: 0.55, value: 372 },
    { t: 1, value: 12 },
  ],
  easing: 'easeInOutQuad',
  radius: { keyframes: [
    { t: 0, value: 900 }, { t: 0.42, value: 900 }, { t: 0.5, value: 35 }, { t: 0.58, value: 900 }, { t: 1, value: 900 },
  ], easing: 'easeInOutQuad' },
  height: { keyframes: [
    { t: 0, value: 500 }, { t: 0.42, value: 500 }, { t: 0.5, value: 20 }, { t: 0.58, value: 500 }, { t: 1, value: 500 },
  ], easing: 'easeInOutQuad' },
  wobble: {
    radius: { amplitude: 20, frequency: 6, seed: 5 },
    height: { amplitude: 14, frequency: 4.5, seed: 8 },
    angleDegrees: { amplitude: 2.5, frequency: 5, seed: 12 },
  },
};

function buildRecipe(colors) {
  return {
    durationSeconds: DURATION_SECONDS,
    pattern: '../patterns/variety.json',
    patternId: 'variety-star',
    strokeWeight: null,
    colorCount: COLOR_COUNT,
    camera,
    colors,
  };
}

const variants = {
  'flight-red.json': shadesOf(0),
  'flight-green.json': shadesOf(130),
  'flight-blue.json': shadesOf(220),
  'flight-rainbow.json': rainbowGradient(),
};

for (const [filename, colors] of Object.entries(variants)) {
  fs.writeFileSync(`recipes/${filename}`, JSON.stringify(buildRecipe(colors), null, 2));
  console.log('wrote', `recipes/${filename}`);
}
