import { generateGrid, points } from './grid.js';
import { selectedPoints, drawSelectedPath, resetSelectedPoints } from './interactions.js';
import { drawStringArtCurve, generateZigzagFromGrid } from './bezier.js';
import { handleMousePressed } from './interactions.js';
import {
  getCurrentColors,
  storedCurves,
  setUpColorUI,
  setCurrentColor ,
  renderFavoriteTriplets
} from './colors.js';

let panX = 0, panY = 0, zoom = 1;
let isDragging = false, prevMouse;

function setup() {
  setUpColorUI();
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
    if (selectedPoints.length >= 3) {
      // Save current curve with its color
      storedCurves.push({
        points: selectedPoints.map(p => p.copy()),
        colors: [colorPicker1.value, colorPicker2.value, colorPicker3.value]
      });
    }
    resetSelectedPoints();
  });


  const clearAllBtn = document.getElementById('clearAllBtn');

  clearAllBtn.addEventListener('click', () => {
    selectedPoints.length = 0;   // Clear selected points array
    storedCurves.length = 0;     // Clear stored curves array
  });


  document.getElementById('generateZigzagFromGridBtn').addEventListener('click', () => {
    generateZigzagFromGrid(
      points,
      s * rows,
      s,
      [colorPicker1.value, colorPicker2.value, colorPicker3.value],
      (curve) => storedCurves.push(curve)
    );
  });

  const undoBtn = document.getElementById('undoBtn');
  undoBtn.addEventListener('click', () => {
    if (storedCurves.length > 0) {
      storedCurves.pop();
    }
    resetSelectedPoints();  // clear current drawing when undoing
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

  drawGrid();

  // Draw all stored curves with their saved colors
  for (const curve of storedCurves) {
    // drawBezierCurve(curve.points, curve.color);
    drawStringArtCurve(curve.points, curve.colors);
  }

  // Draw the current in-progress curve with the currently selected color
  if (selectedPoints.length >= 3) {
    // drawBezierCurve(selectedPoints, currentStrokeColor);
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
    if (mouseButton === CENTER) {
      isDragging = true;
      prevMouse = createVector(mouseX, mouseY);
    } else {
      const worldMouse = createVector(
        (mouseX - panX) / zoom,
        (mouseY - panY) / zoom
      );
      handleMousePressed(worldMouse);
    }
  }
  

  function touchStarted() {
  // Touch events do not set mouseButton, so we skip isDragging for now
  const worldTouch = createVector(
    (touchX - panX) / zoom,
    (touchY - panY) / zoom
  );
  handleMousePressed(worldTouch);
  return false; // prevent default scroll/zoom behavior
}

function mouseDragged() {
  if (isDragging) {
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

// Expose p5 lifecycle methods globally
window.setup = setup;
window.draw = draw;
window.mousePressed = mousePressed;
window.mouseDragged = mouseDragged;
window.mouseReleased = mouseReleased;
window.mouseWheel = mouseWheel;
window.windowResized = windowResized;
