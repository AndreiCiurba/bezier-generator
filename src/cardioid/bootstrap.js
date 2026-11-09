import { CardioidApp } from './CardioidApp.js';

// No external lifecycle to bridge into (same reasoning as ArrangeApp/ThreeApp) -
// Three.js has no callback contract of its own, so this just constructs and
// initializes the app directly.
new CardioidApp().init();
