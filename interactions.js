import { points } from './grid.js';

export let selectedPoints = [];

export function resetSelectedPoints() {
  selectedPoints = [];
}

export function handleMousePressed(worldMouse) {
  for (let p of points) {
    if (dist(worldMouse.x, worldMouse.y, p.x, p.y) < 10) {
      selectedPoints.push(p.copy());
      break;
    }
  }
}



export function drawSelectedPath() {
  noFill();
  stroke(0);
  strokeWeight(2);
  for (let i = 0; i < selectedPoints.length - 1; i++) {
    let p1 = selectedPoints[i];
    let p2 = selectedPoints[i + 1];
    line(p1.x, p1.y, p2.x, p2.y);
  }
}
