import { describe, it, expect } from 'vitest';
import { arrangeExportGeometry, exportBounds, exportLayout, EXPORT_MAX_SIZE_PX } from './arrangeExport.js';
import { FreeformShape } from '../models/FreeformShape.js';
import { CardioidShape } from '../models/CardioidShape.js';
import { rectAnchors } from '../core/shapePresets.js';

const thread = { threadWidthMm: 0.25, nailDiameterMm: 1.5, technique: '8' };

const colors = [
  { color: '#ff0000', enabled: true },
  { color: '#00ff00', enabled: true },
];

function instance(position, { weight = null, scale = 1 } = {}) {
  const shapeSnapshot = new FreeformShape({
    id: 's', name: 'Rect', anchors: rectAnchors({ x: 0, y: 0 }, 10), nailCount: 8, leap: 2, colors, weight,
  });
  return { id: 'i', shapeId: 's', shapeSnapshot, position, rotationRadians: 0, scale };
}

describe('arrangeExportGeometry', () => {
  it('produces one entry per instance with nailCount nails and two thread strands per weave connection', () => {
    const [entry] = arrangeExportGeometry([instance({ x: 0, y: 0 })], thread);
    expect(entry.nails).toHaveLength(8);
    expect(entry.segments).toHaveLength(8 * 2 * 2);
  });

  it('uses the real thread width in world units, ignoring the shape pixel stroke weight, so export matches the board', () => {
    const [entry] = arrangeExportGeometry([instance({ x: 0, y: 0 }, { weight: 3 })], thread);
    expect(entry.lineWidth).toBe(2.5);
  });

  it('applies the instance position so shapes land where they sit on the board', () => {
    const near = exportBounds(arrangeExportGeometry([instance({ x: 0, y: 0 })], thread));
    const moved = exportBounds(arrangeExportGeometry([instance({ x: 1000, y: 0 })], thread));
    expect(moved.minX - near.minX).toBeCloseTo(1000);
  });
});

describe('exportBounds', () => {
  it('is null with nothing placed, which lets the caller skip an empty export', () => {
    expect(exportBounds([])).toBeNull();
  });
});

describe('arrangeExportGeometry with a cardioid run stack', () => {
  const run = (color, changes = {}) => ({ color, enabled: true, rangeStart: 1, rangeEnd: 6, rotation: 0, multiplier: null, leap: null, ...changes });
  const shapeSnapshot = new CardioidShape({
    id: 'c', name: 'C', nailCount: 48, layerCount: 2, leap: 1, multiplier: 3, radius: 1000,
    runs: [run('#a'), run('#b', { rotation: 16 })],
  });
  const [entry] = arrangeExportGeometry([{ shapeSnapshot, position: { x: 0, y: 0 }, rotationRadians: 0, scale: 1 }], thread);
  const drawOrder = [...entry.segments].sort((a, b) => b.layerIndex - a.layerIndex);

  it('draws layer 0 first and, within a layer, its first run under the later ones', () => {
    const firstLayer0 = drawOrder.findIndex((s) => s.color === '#a');
    expect(drawOrder.slice(0, 11).every((s) => s.color === '#a')).toBe(true); // 6 chords, the last one single
    expect(drawOrder[firstLayer0 + 11].color).toBe('#b');
  });

  it('strings the last chord of each run once: 5 doubled + 1 single per run per layer', () => {
    expect(entry.segments).toHaveLength((5 * 2 + 1) * 2 * 2);
  });
});

describe('exportLayout', () => {
  it('fits the long side to the max export size and keeps the aspect ratio', () => {
    const layout = exportLayout({ minX: 0, minY: 0, maxX: 4000, maxY: 1000 });
    expect(layout.width).toBe(EXPORT_MAX_SIZE_PX);
    // Content keeps its 4:1 shape; only the fixed margin makes the image slightly squarer.
    expect(layout.height).toBeLessThan(layout.width / 3);
    expect(layout.height).toBeGreaterThan(layout.width / 4);
  });

  it('maps the bounds minimum inside the image so nothing is clipped at the margin', () => {
    const layout = exportLayout({ minX: -500, minY: -500, maxX: 500, maxY: 500 });
    expect(-500 * layout.scale + layout.offsetX).toBeGreaterThan(0);
    expect(500 * layout.scale + layout.offsetX).toBeLessThan(layout.width);
  });
});
