import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import * as THREE from 'three';
import { worldColorLayerHeight } from '../core/curveZLayers.js';
import { computeWeaveSegments } from '../core/weaveMath.js';
import { closedWeaveSegmentsForCurve } from '../core/closedWeaveMath.js';
import { BASELINE_STROKE_WEIGHT } from '../core/strokeWeight.js';

/**
 * Builds the "fat line" (`LineSegments2`/`LineMaterial`) Three.js object for
 * one curve's full woven string-art, open-triplet (`buildWeaveLineObject`) or
 * closed-polygon leap-weave (`buildClosedWeaveLineObject`) alike - extracted
 * out of `SceneSync.js`'s own `#buildWeaveObject`/`#buildClosedWeaveObject`
 * (mechanical extraction, no behavior change there) so a second Three.js page
 * (the Arrange board, which weaves hand-drawn freeform shapes rather than
 * grid cells) can build the exact same kind of object without duplicating
 * this geometry-assembly code.
 *
 * `SceneSync.js` always passes its own `this.nailHeight` as `maxHeight` and
 * `this.toWorldPosition` as `toWorldPosition` (unchanged behavior); the
 * Arrange board instead passes a *per-shape-instance* max height and its own
 * origin-less world mapping - the one behavioral generalization this
 * extraction exists for (see this repo's own `docs/epic-freeform-weave.md`).
 */

// Screen-space pixel width for every woven string - see SceneSync.js's own
// (now-historical) doc for why a curve's `renderWeight` (a 2D p5
// `strokeWeight()` unit) isn't itself a sensible `LineMaterial.linewidth`:
// both are screen-space pixels, but a sub-1px value reads as barely-there on
// most GPUs, hence scaling by this factor to reproduce the previous fixed-2px
// look at the baseline weight while still scaling proportionally as the user
// changes it.
const BASELINE_CURVE_LINE_WIDTH = 2;
const STROKE_WEIGHT_TO_LINE_WIDTH_SCALE = BASELINE_CURVE_LINE_WIDTH / BASELINE_STROKE_WEIGHT;

// Same "slightly greyed out" saturation cut as the 2D page's own
// WEAVE_DIMMED_SATURATION (45%, i.e. multiply saturation by 0.45).
const WEAVE_DIMMED_SATURATION_FACTOR = 0.45;

// Scratch objects reused across calls rather than allocated per segment -
// same reasoning as SceneSync.js's own module-level `_matrix`/`_position`/etc.
const _color = new THREE.Color();
const _hsl = { h: 0, s: 0, l: 0 };

/** Desaturates `threeColor` in place toward WEAVE_DIMMED_SATURATION_FACTOR of its own saturation - a no-op at alpha >= 1 (nothing dimmed). */
function desaturateForDimming(threeColor, alpha) {
  if (alpha >= 1) return;
  threeColor.getHSL(_hsl);
  threeColor.setHSL(_hsl.h, _hsl.s * WEAVE_DIMMED_SATURATION_FACTOR, _hsl.l);
}

/** Shared `LineSegments2` assembly once "here are the world-space vertex positions/colors" is known - identical for the open and closed weave builders below. */
function assembleWeaveLineObject(positions, vertexColors, weight, lineResolution, alpha = 1) {
  if (positions.length === 0) return null;

  const geometry = new LineSegmentsGeometry();
  geometry.setPositions(positions);
  geometry.setColors(vertexColors);

  const material = new LineMaterial({
    vertexColors: true,
    linewidth: weight * STROKE_WEIGHT_TO_LINE_WIDTH_SCALE,
    resolution: lineResolution,
    transparent: alpha < 1,
    opacity: alpha,
  });

  const object = new LineSegments2(geometry, material);
  object.computeLineDistances();
  return object;
}

/**
 * One `LineSegments2` for an open-triplet curve's (or an in-progress
 * selection's) full weave - every enabled color layer's segments via the
 * shared, pure `computeWeaveSegments`, each layer's world Y baked directly
 * into its own vertices via `worldColorLayerHeight(layerIndex, colors.length,
 * 0, maxHeight)`.
 * @param {{
 *   points: {x:number,y:number}[],
 *   colors: {color:string,enabled:boolean}[],
 *   weight: number,
 *   maxHeight: number,
 *   toWorldPosition: (point2: {x:number,y:number}, height?: number) => {x:number,y:number,z:number},
 *   lineResolution: import('three').Vector2,
 *   alpha?: number,
 * }} params
 * @returns {LineSegments2 | null} null if there are fewer than 3 points (no weave segments to draw)
 */
export function buildWeaveLineObject({ points, colors, weight, maxHeight, toWorldPosition, lineResolution, alpha = 1 }) {
  if (points.length < 3) return null;
  const colorCount = colors.length;

  const positions = [];
  const vertexColors = [];
  for (let i = 0; i < points.length - 2; i++) {
    const [p1, p2, p3] = [points[i], points[i + 1], points[i + 2]];
    colors.forEach((layer, layerIndex) => {
      if (!layer.enabled) return;
      const y = worldColorLayerHeight(layerIndex, colorCount, 0, maxHeight);
      _color.set(layer.color);
      desaturateForDimming(_color, alpha);
      for (const { from, to } of computeWeaveSegments(p1, p2, p3, layerIndex, colorCount)) {
        const worldFrom = toWorldPosition(from, y);
        const worldTo = toWorldPosition(to, y);
        positions.push(worldFrom.x, worldFrom.y, worldFrom.z, worldTo.x, worldTo.y, worldTo.z);
        vertexColors.push(_color.r, _color.g, _color.b, _color.r, _color.g, _color.b);
      }
    });
  }
  return assembleWeaveLineObject(positions, vertexColors, weight, lineResolution, alpha);
}

/**
 * The closed-polygon leap-weave equivalent of `buildWeaveLineObject` - same
 * per-layer world-Y height baking, sourcing its segments from
 * `closedWeaveSegmentsForCurve` (any closed ring of corners - a grid cell's,
 * or a Shape Designer shape's own resampled bezier outline) instead of
 * `computeWeaveSegments`'s open-triplet walk.
 * @param {{
 *   cellCorners: {x:number,y:number}[], n: number, leap: number,
 *   colors: {color:string,enabled:boolean}[],
 *   weight: number,
 *   maxHeight: number,
 *   toWorldPosition: (point2: {x:number,y:number}, height?: number) => {x:number,y:number,z:number},
 *   lineResolution: import('three').Vector2,
 *   alpha?: number,
 * }} params
 * @returns {LineSegments2 | null}
 */
export function buildClosedWeaveLineObject({ cellCorners, n, leap, colors, weight, maxHeight, toWorldPosition, lineResolution, alpha = 1 }) {
  const colorCount = colors.length;
  const positions = [];
  const vertexColors = [];

  for (const { from, to, color, layerIndex } of closedWeaveSegmentsForCurve(cellCorners, n, leap, colors)) {
    const y = worldColorLayerHeight(layerIndex, colorCount, 0, maxHeight);
    _color.set(color);
    desaturateForDimming(_color, alpha);
    const worldFrom = toWorldPosition(from, y);
    const worldTo = toWorldPosition(to, y);
    positions.push(worldFrom.x, worldFrom.y, worldFrom.z, worldTo.x, worldTo.y, worldTo.z);
    vertexColors.push(_color.r, _color.g, _color.b, _color.r, _color.g, _color.b);
  }
  return assembleWeaveLineObject(positions, vertexColors, weight, lineResolution, alpha);
}
