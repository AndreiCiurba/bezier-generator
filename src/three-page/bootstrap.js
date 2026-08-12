import { ThreeApp } from './ThreeApp.js';

// Unlike the p5 pages' bootstrap.js (which bridges into p5's global-mode
// sketch lifecycle via window.setup/draw/...), Three.js has no external
// lifecycle to bridge into - this just builds and starts the app directly.
const app = new ThreeApp();
app.init();
