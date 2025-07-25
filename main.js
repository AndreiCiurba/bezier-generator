import { generateGrid, points } from './grid.js';
import { selectedPoints, drawSelectedPath, resetSelectedPoints } from './interactions.js';
import { drawStringArtCurve, generateZigzagFromGrid } from './bezier.js';
import { handleMousePressed } from './interactions.js';
import {
  getCurrentColors,
  storedCurves,
  setUpColorUI,
  setCurrentColor,
  renderFavoriteTriplets
} from './colors.js';

import {
  setUpPatternUI,
  patternInUse,
  resetPattern,
  renderPattern,
  drawPatternPreview,
  pendingPatternToPlace,
} from './pattern.js'

export let panX = 0, panY = 0, zoom = 1;
let isDragging = false, prevMouse;

function setup() {
  setUpColorUI();
  setUpPatternUI();
  renderFavoriteTriplets()
  // Grid parameters
  const rows = 15;
  const cols = 12;
  const s = 60;  // side length of triangle
  const h = (s * Math.sqrt(3)) / 2;

  createCanvas(windowWidth, windowHeight);
  generateGrid(rows, cols, s, h, createVector);

  const resetBtn = document.getElementById('resetBtn');

  // Setup UI elements
  const colorPicker1 = document.getElementById('strokeColor1');
  const colorPicker2 = document.getElementById('strokeColor2');
  const colorPicker3 = document.getElementById('strokeColor3');

  const [c1, c2, c3] = getCurrentColors();
  colorPicker1.value = c1;
  colorPicker2.value = c2;
  colorPicker3.value = c3;

  colorPicker1.addEventListener('input', e => setCurrentColor(0, e.target.value));
  colorPicker2.addEventListener('input', e => setCurrentColor(1, e.target.value));
  colorPicker3.addEventListener('input', e => setCurrentColor(2, e.target.value));

  resetBtn.addEventListener('click', () => {
    resetPattern()
    if (selectedPoints.length >= 3) {
      storedCurves.push({
        points: selectedPoints.map(p => p.copy()),
        colors: [colorPicker1.value, colorPicker2.value, colorPicker3.value]
      });
    }
    resetSelectedPoints();
  });


  const clearAllBtn = document.getElementById('clearAllBtn');

  clearAllBtn.addEventListener('click', () => {
    selectedPoints.length = 0;
    storedCurves.length = 0;
  });

  const undoBtn = document.getElementById('undoBtn');
  undoBtn.addEventListener('click', () => {
    if (storedCurves.length > 0) {
      storedCurves.pop();
    }
    resetSelectedPoints();
  });

  const burger = document.getElementById('burger');
  const ui = document.getElementById('ui');
  const closeBtn = document.getElementById('closeUiBtn');

  burger.addEventListener('click', () => {
    ui.classList.remove('hidden');
    burger.classList.add('hidden');
  });

  closeBtn.addEventListener('click', () => {
    ui.classList.add('hidden');
    burger.classList.remove('hidden');
  });
}

function draw() {
  background(255);
  translate(panX, panY);
  scale(zoom);

  // if (pendingPatternToPlace) {
  //   // Optional: show preview at mouse
  //   drawPatternPreview();
  //   return; // Don't allow other drawing while a pattern is pending
  // }

  drawGrid();
  for (const curve of storedCurves) {
    drawStringArtCurve(curve.points, curve.colors);
  }

  if (selectedPoints.length >= 3) {
    drawStringArtCurve(selectedPoints, getCurrentColors());
  }

  drawSelectedPath();
}

function drawGrid() {
  stroke(0);
  strokeWeight(1);
  for (const p of points) {
    ellipse(p.x, p.y, 5, 5);
  }
}

function mousePressed() {
  if (touchesMenus()) return;

  if (mouseButton === CENTER) {
    isDragging = true;
    prevMouse = createVector(mouseX, mouseY);
  } else {
    const worldMouse = createVector(
      (mouseX - panX) / zoom,
      (mouseY - panY) / zoom
    );
    if (patternInUse) {
      renderPattern(worldMouse)
    } else {
      handleMousePressed(worldMouse);
    }
  }
}

function touchEnded() {
  const tapDuration = millis() - touchStartTime;
  const movedDistance = dist(mouseX, mouseY, touchStartX, touchStartY);

  if (tapDuration < 200 && movedDistance < 10) {
    const worldTouch = screenToWorld(mouseX, mouseY);
    if (patternInUse) {
      renderPattern(worldTouch)
    } else {
      handleMousePressed(worldTouch);
    }
  }

  return false;
}


function mouseDragged() {
  if (touches.length === 0 && isDragging) {
    let dx = mouseX - prevMouse.x;
    let dy = mouseY - prevMouse.y;
    panX += dx;
    panY += dy;
    prevMouse.set(mouseX, mouseY);
  }
}


function mouseReleased() {
  isDragging = false;
}

function mouseWheel(event) {
  zoom *= event.delta > 0 ? 0.9 : 1.1;
  return false;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function touchStarted() {
  touchStartTime = millis();
  touchStartX = mouseX;
  touchStartY = mouseY;
  return false;
}

function screenToWorld(x, y) {
  return createVector((x - panX) / zoom, (y - panY) / zoom);
}

function touchesMenus() {
  const el = document.elementFromPoint(mouseX, mouseY);
  if (el && (el.closest('button') || el.closest('input') || el.closest('#patternSubmenu') || el.closest('#colorFavoritesSubmenu') || el.closest('#ui') || el.closest('#burger'))) {
    return true;
  }
  return false;
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.getElementById('resetBtn')?.click();
  }
});

// Expose p5 lifecycle methods globally
window.setup = setup;
window.draw = draw;
window.mousePressed = mousePressed;
window.mouseDragged = mouseDragged;
window.mouseReleased = mouseReleased;
window.mouseWheel = mouseWheel;
window.windowResized = windowResized;
window.touchEnded = touchEnded;
window.touchStarted = touchStarted;
