// The pipeline's memory of what got picked. Every time reels are finished
// from a batch, one line per recipe in that batch is appended to
// feedback/history.jsonl - picked or passed over - so tomorrow's batch can
// lean toward what has actually been chosen.
import fs from 'node:fs';
import path from 'node:path';

export function readHistory(historyFile) {
  if (!fs.existsSync(historyFile)) return [];
  return fs
    .readFileSync(historyFile, 'utf8')
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}

/**
 * Records a batch's outcome. Re-finishing the same batch replaces its earlier
 * lines rather than counting it twice.
 * @param {string} historyFile
 * @param {string} batch batch name (its folder name, normally the date)
 * @param {{id:string, archetype?:string, palette?:string, picked:boolean}[]} entries
 */
export function recordBatch(historyFile, batch, entries) {
  const kept = readHistory(historyFile).filter((entry) => entry.batch !== batch);
  const lines = [...kept, ...entries.map((entry) => ({ batch, ...entry }))].map((entry) => JSON.stringify(entry));
  fs.mkdirSync(path.dirname(historyFile), { recursive: true });
  fs.writeFileSync(historyFile, lines.join('\n') + '\n');
}

/**
 * Pick rate per value of `key` ("archetype" or "palette").
 * @returns {Record<string, {shown:number, picked:number, rate:number}>}
 */
export function pickRates(history, key) {
  const rates = {};
  for (const entry of history) {
    const value = entry[key];
    if (!value) continue;
    rates[value] ??= { shown: 0, picked: 0, rate: 0 };
    rates[value].shown += 1;
    if (entry.picked) rates[value].picked += 1;
  }
  for (const value of Object.values(rates)) value.rate = value.picked / value.shown;
  return rates;
}

/**
 * How often each archetype should come up in the next batch: its pick rate,
 * smoothed toward the average so a few early results do not decide
 * everything, and never below a floor, so an archetype that has been passed
 * over keeps getting the occasional chance to come back with a better idea.
 * @param {object[]} history
 * @param {string[]} archetypes
 * @returns {Record<string, number>|null} null until there is any history to learn from
 */
export function archetypeWeights(history, archetypes) {
  if (history.length === 0) return null;
  const rates = pickRates(history, 'archetype');
  const overall = history.filter((entry) => entry.picked).length / history.length;
  const PRIOR = 6; // as if every archetype had already been shown this many times at the average rate
  const FLOOR = 0.35;
  const weights = {};
  for (const name of archetypes) {
    const { shown = 0, picked = 0 } = rates[name] ?? {};
    const smoothed = (picked + PRIOR * overall) / (shown + PRIOR);
    weights[name] = Math.max(FLOOR, overall > 0 ? smoothed / overall : 1);
  }
  return weights;
}
