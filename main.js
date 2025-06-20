import { generateGrid, points } from './grid.js';
import { selectedPoints, drawSelectedPath, resetSelectedPoints } from './interactions.js';
import { drawStringArtCurve, generateZigzagFromGrid } from './bezier.js';
import { handleMousePressed } from './interactions.js';

let panX = 0, panY = 0, zoom = 1;
let isDragging = false, prevMouse;

let currentStrokeColor1 = '#0000ff';
let currentStrokeColor2 = '#00ff00'; 
let currentStrokeColor3 = '#ff0000';   // default stroke color
const storedCurves = [];

function setup() {
  // Grid parameters
  const rows = 25;
  const cols = 25;
  const s = 60;  // side length of triangle
  const h = (s * Math.sqrt(3)) / 2;

  createCanvas(windowWidth, windowHeight);
  generateGrid(rows, cols, s, h, createVector);

  const resetBtn = document.getElementById('resetBtn');

  // Setup UI elements
  const colorPicker1 = document.getElementById('strokeColor1');
  const colorPicker2 = document.getElementById('strokeColor2');
  const colorPicker3 = document.getElementById('strokeColor3');
 

  colorPicker1.value = currentStrokeColor1;
  colorPicker1.addEventListener('input', (e) => {
    currentStrokeColor1 = e.target.value;
  });

  
  colorPicker2.value = currentStrokeColor2;
  colorPicker2.addEventListener('input', (e) => {
    currentStrokeColor2 = e.target.value;
  });

  
  colorPicker3.value = currentStrokeColor3;
  colorPicker3.addEventListener('input', (e) => {
    currentStrokeColor3 = e.target.value;
  });

  resetBtn.addEventListener('click', () => {
    if (selectedPoints.length >= 3) {
      // Save current curve with its color
      storedCurves.push({
        points: selectedPoints.map(p => p.copy()),
        colors: [currentStrokeColor1, currentStrokeColor2, currentStrokeColor3]
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
      windowWidth,
      s,
      [currentStrokeColor1, currentStrokeColor2, currentStrokeColor3],
      (curve) => storedCurves.push(curve)
    );
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
    drawStringArtCurve(selectedPoints, [currentStrokeColor1, currentStrokeColor2, currentStrokeColor3]);
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
