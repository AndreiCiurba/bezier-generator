import * as THREE from 'three';
import { WovenFrameView } from './WovenFrameView.js';
import { applyReelCamera, buildBloomComposer, frameSize, lineWidthScale, readPixelsBase64 } from './reelRender.js';

/**
 * The reel driver (`window.__reelTimeline`) for the scenes that resolve to
 * plain nails + woven segments: Arrange (`arrange/arrangeReelFrame.js`, on
 * /arrange) and Grid (`three-page/gridReelFrame.js`, on /3d). Same
 * `load` / `seek(t)` / `getFrameSize` / `readPixelsBase64` surface as
 * `CardioidReel` and `ReelTimeline`, so the headless capture drives all of
 * them alike; `seek(t)` is a pure function of `t`.
 *
 * `recipe.look`: `background`, `nailColor`, `nailThickness` (multiplier on
 * the app's own nail), `bloom` (see `reelRender.js#buildBloomComposer`).
 */
export class WovenReel {
  /**
   * @param {{
   *   camera: import('three').PerspectiveCamera, renderer: import('three').WebGLRenderer, scene: import('three').Scene,
   *   controls?: {enabled:boolean},
   *   resolve: (recipe:object, t:number, prepared:any) => object,
   *   prepare?: (recipe:object) => any,
   *   hide?: import('three').Object3D[], // the page's own scene objects, kept out of the shot
   * }} deps
   */
  constructor({ camera, renderer, scene, controls, resolve, prepare, hide = [] }) {
    Object.assign(this, { camera, renderer, scene, controls, resolve, prepare, hide });
    this.recipe = null;
    this.prepared = null;
    this.view = null;
    this.composer = null;
  }

  async load(recipe) {
    this.recipe = recipe;
    if (this.controls) this.controls.enabled = false;
    for (const object of this.hide) object.visible = false;
    const look = recipe.look ?? {};
    if (look.background) this.scene.background = new THREE.Color(look.background);
    this.view = new WovenFrameView(this.scene, { nailColor: look.nailColor, nailThickness: look.nailThickness ?? 1 });
    this.prepared = this.prepare ? this.prepare(recipe) : null;
    this.composer = look.bloom ? await buildBloomComposer(this.renderer, this.scene, this.camera, look.bloom) : null;
  }

  seek(t) {
    const frame = this.resolve(this.recipe, t, this.prepared);
    const { width, height } = frameSize(this.renderer);
    this.view.setViewportSize(width, height);
    this.view.render(frame, lineWidthScale(this.renderer));
    applyReelCamera(this.camera, frame.camera);
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  getFrameSize() {
    return frameSize(this.renderer);
  }

  readPixelsBase64() {
    return readPixelsBase64(this.renderer);
  }
}
