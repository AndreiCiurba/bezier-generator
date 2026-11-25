import { describe, it, expect } from 'vitest';
import { CardioidRunStore } from './CardioidRunStore.js';

describe('CardioidRunStore', () => {
  it('starts with one full run, so a fresh page weaves a whole cardioid', () => {
    const store = new CardioidRunStore(48);
    expect(store.runs).toEqual([expect.objectContaining({ rangeStart: 1, rangeEnd: 48, rotation: 0 })]);
  });

  it('adds a new run on top as a copy of the top run in a fresh color, so the next part continues from it', () => {
    const store = new CardioidRunStore(48);
    store.update(0, { rangeEnd: 24 });
    store.add(48);
    expect(store.count).toBe(2);
    expect(store.runs[1].rangeEnd).toBe(24);
    expect(store.runs[1].color).not.toBe(store.runs[0].color);
  });

  it("starts an added run at the nail where the top run ended, so it doesn't lie exactly on it", () => {
    const store = new CardioidRunStore(48);
    store.update(0, { rangeEnd: 24 });
    store.add(48);
    expect(store.runs[1].rotation).toBe(24); // threads 1-24 again, from nail 24: turned 180 degrees
  });

  it('starts a copy of a full run half way round, since a full run ends where it began', () => {
    const store = new CardioidRunStore(48);
    store.add(48);
    expect(store.runs[1].rotation).toBe(24);
  });

  it('moves a run up and down the stack, which decides which thread lies on top', () => {
    const store = new CardioidRunStore(48);
    store.add(48);
    const [first, second] = store.runs; // differ in color and point 0
    store.move(1, -1);
    expect(store.runs).toEqual([second, first]);
    store.move(0, -1); // already lowest: nothing happens
    expect(store.runs).toEqual([second, first]);
  });

  it('copies and deletes runs', () => {
    const store = new CardioidRunStore(48);
    store.duplicate(0);
    expect(store.runs[1]).toEqual(store.runs[0]);
    store.remove(0);
    expect(store.count).toBe(1);
  });

  it('notifies on every change, and hands out copies so runs only change through the store', () => {
    const store = new CardioidRunStore(48);
    let calls = 0;
    store.onChange(() => calls++);
    store.runs[0].rangeEnd = 5;
    expect(store.runs[0].rangeEnd).toBe(48);
    store.update(0, { rotation: 16 });
    store.fitToNailCount(48, 60);
    expect(calls).toBe(2);
    expect(store.runs[0]).toMatchObject({ rotation: 16, rangeEnd: 60 });
  });

  it('changes the threads of every linked run at once, so "threads 1-24" applies to the whole stack', () => {
    const store = new CardioidRunStore(48);
    store.add(48);
    store.add(48);
    store.update(1, { rangeStart: 1, rangeEnd: 24 });
    expect(store.runs.map((r) => [r.rangeStart, r.rangeEnd])).toEqual([[1, 24], [1, 24], [1, 24]]);
  });

  it('leaves a run with its own threads alone, and links it back to the shared threads when unticked', () => {
    const store = new CardioidRunStore(48);
    store.add(48);
    store.setOwnRange(1, true);
    store.update(1, { rangeEnd: 6 });
    store.update(0, { rangeEnd: 24 });
    expect(store.runs.map((r) => r.rangeEnd)).toEqual([24, 6]);
    store.setOwnRange(1, false);
    expect(store.runs[1].rangeEnd).toBe(24);
  });
});
