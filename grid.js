export let points = [];

export function generateGrid(rows, cols, s, h, createVector) {
  points.length = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (row % 2 == 0 && col == 0) {
        continue  
      }
      let x = col * s + (row % 2) * (s / 2);
      let y = row * h;
      points.push(createVector(x, y));
    }
  }
}

export function generateGridRotated(rows, cols, s, h, createVector) {
  points.length = 0;
  const offsetY = cols * s;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (row % 2 == 0 && col == 0) continue;
      

      let x = row * h;
      let y = offsetY - (col * s + (row % 2) * (s / 2));
      points.push(createVector(x, y));
    }
  }
}
