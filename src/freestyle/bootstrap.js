import { FreestyleApp } from './FreestyleApp.js';

// Same bridge as src/app/bootstrap.js: p5.js (global mode) looks for
// setup/draw/etc. on `window` and calls them as its sketch lifecycle.
// No windowResized here - the canvas is a fixed, user-chosen size (see
// CanvasSizeUI), not tied to the browser window.
const app = new FreestyleApp();

window.setup = app.setup;
window.draw = app.draw;
window.mousePressed = app.mousePressed;
window.mouseDragged = app.mouseDragged;
window.mouseReleased = app.mouseReleased;
window.mouseWheel = app.mouseWheel;
window.touchStarted = app.touchStarted;
window.touchEnded = app.touchEnded;
