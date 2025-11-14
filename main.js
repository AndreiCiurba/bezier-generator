import { generateGrid, generateGridRotated, points } from './grid.js';
import { selectedPoints, drawSelectedPath, resetSelectedPoints } from './interactions.js';
import { drawStringArtCurve, generateZigzagFromGrid } from './bezier.js';
import { handleMousePressed } from './interactions.js';
import {
  getCurrentColors,
  storedCurves,
  setUpColorUI,
  setCurrentColor,
  renderFavoriteBundles
} from './colors.js';

import {
  setUpPatternUI,
  patternInUse,
  resetPattern,
  renderPattern,
  getSelectedPatternId,
  setSelectedPatternId,
  renderPatternThroughoutTheGrid,
} from './pattern.js'

export let panX = 0, panY = 0, zoom = 1;
let isDragging = false, prevMouse;

function setup() {
  setUpColorUI();
  setUpPatternUI();
  renderFavoriteBundles()
  // Grid parameters
  const rows = 15;
  const cols = 13;
  const s = 60;
  const h = (s * Math.sqrt(3)) / 2;

  createCanvas(windowWidth, windowHeight);
  // generateGrid(rows, cols, s, h, createVector);
  generateGridRotated(rows, cols, s, h, createVector);

  const resetBtn = document.getElementById('resetBtn');

  // Setup UI elements
  const container = document.getElementById('colorPickerContainer');
  const colorPickers = container.querySelectorAll('input[type="color"]');


  let currentColors =  getCurrentColors();
  for (let i = 0; i < colorPickers.length; i++) {
    colorPickers[i].value = currentColors[i]
    colorPickers[i].addEventListener('input', e => setCurrentColor(i, e.target.value));
  }

  resetBtn.addEventListener('click', () => {
    resetPattern()
    let curveColors = []
    for(let i=0;i<colorPickers.length; i++) {
      curveColors.push(colorPickers[i].value)
    }
    if (selectedPoints.length >= 3) {
      storedCurves.push({
        points: selectedPoints.map(p => p.copy()),
        colors: curveColors
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
  background(12);
  translate(panX, panY);
  scale(zoom);

  drawGrid();
  for (const curve of storedCurves) {
    if (curve.patternId === getSelectedPatternId()) {
      curve.colors = getCurrentColors().slice();
    }

    drawStringArtCurve(curve.points, curve.colors);
  }

  if (selectedPoints.length >= 3) {
    drawStringArtCurve(selectedPoints, getCurrentColors());
  }

  drawSelectedPath();
}

function drawGrid() {
  stroke(100);
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
    
    // if (patternInUse) {
    //   // renderPattern(worldMouse)
    //   renderPatternThroughoutTheGrid()
    // } else {
      handleMousePressed(worldMouse);
    // }
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
    setSelectedPatternId(null, false)
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
