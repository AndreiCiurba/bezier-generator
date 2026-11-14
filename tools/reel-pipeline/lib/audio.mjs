// Soundtrack synthesis for a reel - no samples, no licensed music: plucked
// strings (Karplus-Strong, the classic "a burst of noise in a short feedback
// loop sounds like a plucked string" algorithm) over a soft pad, written out
// as a WAV file the edit step muxes under the picture.
//
// The plucks follow the picture: `activity(t)` says how busily strings are
// being added at clip time `t` (the edit step derives it from the recipe's
// own `weave.drawProgress` track), so the weave is *heard* being strung and
// the music settles into held notes once it is finished. `progress(t)` walks
// the melody up the scale as the weave completes.
//
// Deterministic for a given spec (seeded noise), so re-rendering a recipe
// reproduces the same track.
import fs from 'node:fs';

const SAMPLE_RATE = 44100;

/** Scales as semitone offsets from the root - all chosen so any note sounds fine against any other. */
export const SCALES = {
  pentatonic: [0, 2, 4, 7, 9],
  minorPentatonic: [0, 3, 5, 7, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  hirajoshi: [0, 2, 3, 7, 8],
};

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const midiToHz = (midi) => 440 * 2 ** ((midi - 69) / 12);

/** Note `degree` steps up the scale from `rootMidi` (degrees past the top of the scale carry into the next octave). */
export function scaleNote(rootMidi, scale, degree) {
  const octave = Math.floor(degree / scale.length);
  return rootMidi + 12 * octave + scale[((degree % scale.length) + scale.length) % scale.length];
}

/** Adds one plucked note into the stereo buffers. `pan` is 0 (left) .. 1 (right). */
function addPluck(left, right, { startSeconds, hz, gain, pan, seconds = 2.2, brightness = 0.5 }, random) {
  const period = Math.max(2, Math.round(SAMPLE_RATE / hz));
  const line = new Float32Array(period);
  for (let i = 0; i < period; i++) line[i] = random() * 2 - 1;
  // A duller pluck starts from smoother noise.
  for (let pass = 0; pass < Math.round((1 - brightness) * 4); pass++) {
    for (let i = 1; i < period; i++) line[i] = (line[i] + line[i - 1]) / 2;
  }
  const start = Math.round(startSeconds * SAMPLE_RATE);
  const length = Math.min(Math.round(seconds * SAMPLE_RATE), left.length - start);
  const decay = 0.996;
  const gainL = gain * Math.cos((pan * Math.PI) / 2);
  const gainR = gain * Math.sin((pan * Math.PI) / 2);
  for (let i = 0, p = 0; i < length; i++) {
    const next = p + 1 === period ? 0 : p + 1;
    const sample = line[p];
    line[p] = decay * 0.5 * (line[p] + line[next]);
    p = next;
    left[start + i] += sample * gainL;
    right[start + i] += sample * gainR;
  }
}

/** Adds a soft sustained chord (detuned sines, slow attack and release) under everything. */
function addPad(left, right, { startSeconds, seconds, midiNotes, gain }) {
  const start = Math.round(startSeconds * SAMPLE_RATE);
  const length = Math.min(Math.round(seconds * SAMPLE_RATE), left.length - start);
  const fade = Math.min(length / 2, 0.8 * SAMPLE_RATE);
  for (let i = 0; i < length; i++) {
    const envelope = Math.min(1, i / fade, (length - i) / fade);
    const time = i / SAMPLE_RATE;
    let l = 0;
    let r = 0;
    for (const midi of midiNotes) {
      const hz = midiToHz(midi);
      l += Math.sin(2 * Math.PI * hz * 0.997 * time);
      r += Math.sin(2 * Math.PI * hz * 1.003 * time);
    }
    left[start + i] += (l / midiNotes.length) * gain * envelope;
    right[start + i] += (r / midiNotes.length) * gain * envelope;
  }
}

/** One hammer blow on a nail: a dull thump from the board with a short bright ring from the steel. */
function addKnock(left, right, { startSeconds, gain, pan }, random) {
  const start = Math.round(startSeconds * SAMPLE_RATE);
  const length = Math.min(Math.round(0.16 * SAMPLE_RATE), left.length - start);
  const gainL = gain * Math.cos((pan * Math.PI) / 2);
  const gainR = gain * Math.sin((pan * Math.PI) / 2);
  for (let i = 0; i < length; i++) {
    const time = i / SAMPLE_RATE;
    const thump = Math.sin(2 * Math.PI * 170 * time) * Math.exp(-time * 38);
    const ring = Math.sin(2 * Math.PI * 2350 * time) * Math.exp(-time * 70) * 0.35;
    const click = (random() * 2 - 1) * Math.exp(-time * 260) * 0.5;
    const sample = thump + ring + click;
    left[start + i] += sample * gainL;
    right[start + i] += sample * gainR;
  }
}

/** A spray can held open: bright noise that swells in and tails off. */
function addHiss(left, right, { startSeconds, seconds, gain }, random) {
  const start = Math.round(startSeconds * SAMPLE_RATE);
  const length = Math.min(Math.round(seconds * SAMPLE_RATE), left.length - start);
  const fade = Math.min(length / 2, 0.12 * SAMPLE_RATE);
  let previousL = 0;
  let previousR = 0;
  for (let i = 0; i < length; i++) {
    const envelope = Math.min(1, i / fade, (length - i) / fade);
    // The difference of successive noise samples keeps only the high end - a hiss rather than a roar.
    const noiseL = random() * 2 - 1;
    const noiseR = random() * 2 - 1;
    left[start + i] += (noiseL - previousL) * 0.5 * gain * envelope;
    right[start + i] += (noiseR - previousR) * 0.5 * gain * envelope;
    previousL = noiseL;
    previousR = noiseR;
  }
}

/** A feedback echo that bounces between the two sides - cheap "room" around the dry plucks. */
function addPingPongDelay(left, right, seconds, feedback, mix) {
  const delay = Math.round(seconds * SAMPLE_RATE);
  const wetL = new Float32Array(left.length);
  const wetR = new Float32Array(right.length);
  for (let i = delay; i < left.length; i++) {
    wetL[i] = right[i - delay] + wetR[i - delay] * feedback;
    wetR[i] = left[i - delay] + wetL[i - delay] * feedback;
  }
  for (let i = 0; i < left.length; i++) {
    left[i] += wetL[i] * mix;
    right[i] += wetR[i] * mix;
  }
}

/**
 * @param {{
 *   durationSeconds: number,
 *   bpm?: number, rootMidi?: number, scale?: keyof typeof SCALES, seed?: number,
 *   brightness?: number, // 0 (soft, harp-like) .. 1 (bright, metallic)
 *   pad?: number,        // pad level, 0 turns it off
 *   accents?: number[],  // clip times (seconds) to land a low "arrival" note on - e.g. the moment the weave completes
 *   knocks?: number[],   // clip times (seconds) of hammer blows (a making-of reel's nails going in)
 *   hisses?: {start:number, end:number}[], // stretches (seconds) of spray-can hiss
 * }} spec
 * @param {(seconds:number)=>number} activity 0..1 - how busily strings are being added at that moment
 * @param {(seconds:number)=>number} progress 0..1 - how complete the weave is at that moment
 * @returns {{left: Float32Array, right: Float32Array}}
 */
export function synthesizeTrack(spec, activity = () => 0, progress = () => 1) {
  const { durationSeconds, bpm = 96, rootMidi = 57, seed = 1, brightness = 0.5, pad = 0.5, accents = [], knocks = [], hisses = [] } = spec;
  const scale = SCALES[spec.scale] ?? SCALES.pentatonic;
  const random = mulberry32(seed);
  const length = Math.round(durationSeconds * SAMPLE_RATE);
  const left = new Float32Array(length);
  const right = new Float32Array(length);

  // Sixteenth-note grid. While strings are going on, every step plucks and the
  // melody climbs with the weave; once they stop, only the beat is marked.
  const step = 60 / bpm / 4;
  const contour = [0, 2, 1, 3, 2, 4, 1, 2]; // a small up-and-down figure, so the climb is a melody rather than a ramp
  for (let i = 0; i * step < durationSeconds - 0.1; i++) {
    const time = i * step;
    const busy = activity(time);
    const onBeat = i % 4 === 0;
    if (busy <= 0.02 && !onBeat) continue;
    if (busy <= 0.02 && i % 8 !== 0) continue;
    const climb = Math.floor(progress(time) * scale.length * 2);
    const degree = busy > 0.02 ? climb + contour[i % contour.length] : contour[(i / 8) % contour.length | 0] * 2;
    addPluck(left, right, {
      startSeconds: time,
      hz: midiToHz(scaleNote(rootMidi, scale, degree)),
      gain: (onBeat ? 0.34 : 0.22) * (busy > 0.02 ? 0.6 + 0.4 * busy : 0.7),
      pan: 0.25 + 0.5 * random(),
      brightness,
    }, random);
  }

  for (const time of accents) {
    if (time >= durationSeconds) continue;
    addPluck(left, right, { startSeconds: time, hz: midiToHz(rootMidi - 12), gain: 0.55, pan: 0.5, seconds: 4, brightness: 0.3 }, random);
    addPluck(left, right, { startSeconds: time, hz: midiToHz(scaleNote(rootMidi, scale, scale.length * 2)), gain: 0.3, pan: 0.5, seconds: 3, brightness: 0.8 }, random);
  }

  if (pad > 0) {
    addPad(left, right, {
      startSeconds: 0,
      seconds: durationSeconds,
      midiNotes: [rootMidi - 12, scaleNote(rootMidi, scale, 2), scaleNote(rootMidi, scale, 4)],
      gain: 0.1 * pad,
    });
  }

  addPingPongDelay(left, right, (60 / bpm) * 0.75, 0.35, 0.3);

  // Workshop sounds go on after the echo: a hammer in a room, not in a canyon.
  for (const time of knocks) {
    if (time < durationSeconds - 0.2) addKnock(left, right, { startSeconds: time, gain: 0.5, pan: 0.35 + 0.3 * random() }, random);
  }
  for (const { start, end } of hisses) {
    if (end > start) addHiss(left, right, { startSeconds: start, seconds: end - start, gain: 0.16 }, random);
  }

  // Fade the ends so the loop point of a reel does not click, then normalize.
  const edge = Math.round(0.4 * SAMPLE_RATE);
  let peak = 0;
  for (let i = 0; i < length; i++) {
    const envelope = Math.min(1, i / (edge / 8), (length - 1 - i) / edge);
    left[i] *= envelope;
    right[i] *= envelope;
    peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
  }
  const normalize = peak > 0 ? 0.89 / peak : 1;
  for (let i = 0; i < length; i++) {
    left[i] *= normalize;
    right[i] *= normalize;
  }
  return { left, right };
}

/** Writes 16-bit stereo PCM. */
export function writeWav(filePath, { left, right }) {
  const data = Buffer.alloc(left.length * 4);
  for (let i = 0; i < left.length; i++) {
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, left[i])) * 32767), i * 4);
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, right[i])) * 32767), i * 4 + 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(2, 22); // stereo
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * 4, 28);
  header.writeUInt16LE(4, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  fs.writeFileSync(filePath, Buffer.concat([header, data]));
}
