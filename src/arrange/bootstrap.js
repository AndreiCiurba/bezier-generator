import { ArrangeApp } from './ArrangeApp.js';

// No external lifecycle to bridge into (same reasoning as ThreeApp.js) -
// Three.js has no callback contract of its own, so this just constructs and
// initializes the app directly.
new ArrangeApp().init();
