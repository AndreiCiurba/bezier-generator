export let points = [];

export function generateGrid(rows, cols, s, h, createVector) {
  points.length = 0; // clear previous points
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      let x = col * s + (row % 2) * (s / 2);
      let y = row * h;
      points.push(createVector(x, y));
    }
  }
}
