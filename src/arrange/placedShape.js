import { resampleClosedOutline } from '../core/bezierOutline.js';
import { transformAnchors, anchorsCentroid } from '../core/shapeTransform.js';
import { closedWeaveSegmentsForCurve } from '../core/closedWeaveMath.js';
import { isCardioid } from '../models/shapeFromJSON.js';

/**
 * Where a placed shape's nails and strings land on the Arrange board, for
 * either kind of library shape - a Shape Designer outline or a Cardioid page
 * cardioid. The 3D board, the PNG export and click-picking all read it from
 * here, so the two kinds can never drift apart between them.
 */

const asAnchors = (points) => points.map((p) => ({ x: p.x, y: p.y, handleIn: null, handleOut: null }));

/** @param {{position:{x:number,y:number}, rotationRadians:number, scale:number}} instance */
function transformOf(instance) {
  return { position: instance.position, rotationRadians: instance.rotationRadians, scale: instance.scale };
}

/**
 * The instance's nails in board space.
 * @param {{shapeSnapshot: any, position:{x:number,y:number}, rotationRadians:number, scale:number}} instance
 * @returns {{x:number,y:number}[]}
 */
export function placedNails(instance) {
  const shape = instance.shapeSnapshot;
  if (isCardioid(shape)) {
    // Cardioid nails are centred on the origin, which is also their centroid,
    // so transforming them as corner anchors pivots about the middle.
    return transformAnchors(asAnchors(shape.resampledOutline()), transformOf(instance)).map(({ x, y }) => ({ x, y }));
  }
  return resampleClosedOutline(transformAnchors(shape.anchors, transformOf(instance)), shape.nailCount);
}

/**
 * Every string of the instance in board space, before thread wrapping.
 * `layerIndex` is the stacking layer: for an outline it's the color layer, for
 * a cardioid the cardioid's own layer, with `stackIndex` (which run of the
 * layer's stack, 0 = lowest) and `single` (the last chord of a run, strung
 * one way only).
 * @returns {{from:{x:number,y:number}, to:{x:number,y:number}, color:string, layerIndex:number}[]}
 */
export function placedSegments(instance, nails = placedNails(instance)) {
  const shape = instance.shapeSnapshot;
  if (isCardioid(shape)) {
    return shape.chords().map(({ fromIndex, toIndex, color, layerIndex, stackIndex, single }) => ({
      from: nails[fromIndex], to: nails[toIndex], color, layerIndex, stackIndex, single,
    }));
  }
  return closedWeaveSegmentsForCurve(nails, 0, shape.leap, shape.colors, shape.weaveRule);
}

/** The outline drawn as the placement ghost for a library shape at `position`. */
export function ghostOutline(shape, position, scale) {
  const instance = { shapeSnapshot: shape, position, rotationRadians: 0, scale };
  if (isCardioid(shape)) return placedNails(instance);
  return resampleClosedOutline(transformAnchors(shape.anchors, transformOf(instance)), Math.max(shape.nailCount, 24));
}

/** Farthest a shape's outline reaches from its own centre, at scale 1 - the click-pick radius. */
export function shapeRadius(shape) {
  const points = isCardioid(shape) ? shape.resampledOutline() : shape.anchors;
  const centroid = anchorsCentroid(points);
  let max = 0;
  for (const p of points) max = Math.max(max, Math.hypot(p.x - centroid.x, p.y - centroid.y));
  return max;
}
