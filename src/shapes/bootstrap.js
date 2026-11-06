import { ShapeDesignerApp } from './ShapeDesignerApp.js';

// Bridges p5's global-mode lifecycle to a ShapeDesignerApp instance - the
// same role src/app/bootstrap.js plays for the grid tool.
const app = new ShapeDesignerApp();

window.setup = app.setup;
window.draw = app.draw;
window.mousePressed = app.mousePressed;
window.mouseDragged = app.mouseDragged;
window.mouseReleased = app.mouseReleased;
window.mouseWheel = app.mouseWheel;
