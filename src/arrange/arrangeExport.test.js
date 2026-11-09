import { describe, it, expect } from 'vitest';
import { arrangeExportGeometry, exportBounds, exportLayout, EXPORT_MAX_SIZE_PX } from './arrangeExport.js';
import { FreeformShape } from '../models/FreeformShape.js';
import { rectAnchors } from '../core/shapePresets.js';

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
  it('produces one entry per instance with nailCount nails and a weave segment per nail per enabled layer', () => {
    const [entry] = arrangeExportGeometry([instance({ x: 0, y: 0 })], 0.6);
    expect(entry.nails).toHaveLength(8);
    expect(entry.segments).toHaveLength(8 * 2);
  });

  it('falls back to the board weight only when the instance has no override, so export matches the board', () => {
    const [a, b] = arrangeExportGeometry([instance({ x: 0, y: 0 }), instance({ x: 0, y: 0 }, { weight: 3 })], 0.6);
    expect(a.weight).toBe(0.6);
    expect(b.weight).toBe(3);
  });

  it('applies the instance position so shapes land where they sit on the board', () => {
    const near = exportBounds(arrangeExportGeometry([instance({ x: 0, y: 0 })], 1));
    const moved = exportBounds(arrangeExportGeometry([instance({ x: 1000, y: 0 })], 1));
    expect(moved.minX - near.minX).toBeCloseTo(1000);
  });
});

describe('exportBounds', () => {
  it('is null with nothing placed, which lets the caller skip an empty export', () => {
    expect(exportBounds([])).toBeNull();
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
