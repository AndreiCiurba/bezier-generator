import { isCardioid } from '../models/shapeFromJSON.js';
import { placedNails, placedSegments } from './placedShape.js';
import { threadGeometry, expandToStrands } from '../core/threadWrap.js';

/**
 * PNG export for the Arrange board - the plan-view (top-down) equivalent of
 * `core/ExportRenderer.js`, which can't be reused here: that one draws onto a
 * p5.Graphics, and this page has no p5. So this draws onto a plain 2D canvas,
 * but shares the exact same geometry the 3D scene is built from
 * (`transformAnchors` -> `resampleClosedOutline` -> `closedWeaveSegmentsForCurve`),
 * so the export always matches what's on the board.
 */

// Long side of the exported image, in pixels - the board is far bigger than
// any sensible image, so the content is scaled to fit this instead.
export const EXPORT_MAX_SIZE_PX = 2400;
const EXPORT_PADDING_FRACTION = 0.05;
const BACKGROUND_COLOR = '#ffffff';
const DOT_COLOR = '#000000';
// Each nail is marked by a small exact point at its centre (not a fat dot),
// so its position can be marked precisely on the real board.
export const NAIL_POINT_RADIUS_PX = 1.5;
// Strings are drawn at the real thread width scaled into the image, the same
// as on the board - but never thinner than this, or they would vanish.
const MIN_LINE_WIDTH_PX = 0.75;

/**
 * Every placed instance's nails + weave segments in board (world) space.
 * @param {{shapeSnapshot: import('../models/FreeformShape.js').FreeformShape, position:{x:number,y:number}, rotationRadians:number, scale:number}[]} instances
 * Each connection becomes its two real strands (see core/threadWrap.js).
 * @param {{threadWidthMm:number, nailDiameterMm:number, technique:string}} threadSettings
 * @returns {{nails: {x:number,y:number}[], segments: {from:{x:number,y:number}, to:{x:number,y:number}, color:string, layerIndex:number}[], lineWidth: number}[]}
 */
export function arrangeExportGeometry(instances, threadSettings) {
  return instances.map((instance) => {
    const shape = instance.shapeSnapshot;
    const nails = placedNails(instance);
    const thread = threadGeometry(threadSettings, instance.nailScale ?? 1);
    let segments = placedSegments(instance, nails);
    // The export draws higher layerIndex first (underneath). A cardioid's
    // layer 0 sits at the board, i.e. underneath, so flip its numbering here -
    // and within a layer its first run is lowest, so it goes under the rest.
    if (isCardioid(shape)) {
      const depth = Math.max(1, ...segments.map((s) => s.stackIndex + 1));
      segments = segments.map((s) => ({ ...s, layerIndex: shape.layerCount - 1 - s.layerIndex + (depth - 1 - s.stackIndex) / depth }));
    }
    return {
      nails,
      segments: expandToStrands(segments, thread.wrapRadius, thread.technique),
      lineWidth: thread.lineWidth,
    };
  });
}

/**
 * Bounding box of every nail, or null when there are none. Strings never
 * leave their shape's nail ring, so nails alone bound the whole drawing.
 * @param {{nails: {x:number,y:number}[]}[]} geometry
 */
export function exportBounds(geometry) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const { nails } of geometry) {
    for (const p of nails) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
  }
  if (!Number.isFinite(minX)) return null;
  return { minX, minY, maxX, maxY };
}

/**
 * Image size + world->pixel mapping that fits `bounds` into
 * `EXPORT_MAX_SIZE_PX` on its long side, with a margin all around.
 * @param {{minX:number,minY:number,maxX:number,maxY:number}} bounds
 * @returns {{width:number, height:number, scale:number, offsetX:number, offsetY:number}}
 */
export function exportLayout(bounds) {
  const spanX = Math.max(bounds.maxX - bounds.minX, 1);
  const spanY = Math.max(bounds.maxY - bounds.minY, 1);
  const usable = EXPORT_MAX_SIZE_PX * (1 - 2 * EXPORT_PADDING_FRACTION);
  const scale = usable / Math.max(spanX, spanY);
  const margin = EXPORT_MAX_SIZE_PX * EXPORT_PADDING_FRACTION;
  return {
    width: Math.round(spanX * scale + 2 * margin),
    height: Math.round(spanY * scale + 2 * margin),
    scale,
    offsetX: margin - bounds.minX * scale,
    offsetY: margin - bounds.minY * scale,
  };
}

/**
 * Draws the arrangement onto a fresh canvas. Returns null when nothing is
 * placed. Strings are drawn last-layer-first so layer 0 ends up on top,
 * matching the Arrange board's own stacking.
 * @param {ReturnType<typeof arrangeExportGeometry>} geometry
 * @param {{withStrings: boolean}} options `false` = nails only
 * @returns {HTMLCanvasElement | null}
 */
export function renderArrangeExport(geometry, { withStrings }) {
  const bounds = exportBounds(geometry);
  if (!bounds) return null;
  const layout = exportLayout(bounds);

  const canvas = document.createElement('canvas');
  canvas.width = layout.width;
  canvas.height = layout.height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = BACKGROUND_COLOR;
  ctx.fillRect(0, 0, layout.width, layout.height);

  const toX = (x) => x * layout.scale + layout.offsetX;
  const toY = (y) => y * layout.scale + layout.offsetY;

  if (withStrings) {
    ctx.lineCap = 'round';
    for (const { segments, lineWidth } of geometry) {
      ctx.lineWidth = Math.max(MIN_LINE_WIDTH_PX, lineWidth * layout.scale);
      for (const { from, to, color } of [...segments].sort((a, b) => b.layerIndex - a.layerIndex)) {
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(toX(from.x), toY(from.y));
        ctx.lineTo(toX(to.x), toY(to.y));
        ctx.stroke();
      }
    }
  }

  ctx.fillStyle = DOT_COLOR;
  for (const { nails } of geometry) {
    for (const p of nails) {
      ctx.beginPath();
      ctx.arc(toX(p.x), toY(p.y), NAIL_POINT_RADIUS_PX, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return canvas;
}
