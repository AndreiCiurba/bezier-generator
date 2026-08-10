import { App } from './App.js';

// p5.js (loaded globally via CDN in index.html) runs in "global mode": it
// looks for functions like `setup`/`draw` on `window` and calls them as its
// sketch lifecycle. This is the one place that bridges p5's global-mode
// expectations to the App instance that actually implements them.
const app = new App();

window.setup = app.setup;
window.draw = app.draw;
window.mousePressed = app.mousePressed;
window.mouseDragged = app.mouseDragged;
window.mouseReleased = app.mouseReleased;
window.mouseWheel = app.mouseWheel;
window.windowResized = app.windowResized;
window.touchStarted = app.touchStarted;
window.touchEnded = app.touchEnded;
