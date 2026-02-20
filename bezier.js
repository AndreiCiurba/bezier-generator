export function drawBezierCurve(pointsArray, strokeColor = '#0000ff') {
  noFill();
  stroke(strokeColor);
  strokeWeight(2);

  for (let i = 0; i < pointsArray.length - 2; i++) {
    let p1 = pointsArray[i];
    let p2 = pointsArray[i + 1];
    let p3 = pointsArray[i + 2];
    bezier(p1.x, p1.y, p2.x, p2.y, p2.x, p2.y, p3.x, p3.y);
  }
}

export function drawStringArtCurve(pointsArray, strokes, segments = 8) {
  strokeWeight(0.6)
  noFill();

  for (let i = 0; i < pointsArray.length - 2; i++) {
    let p1 = pointsArray[i];
    let p2 = pointsArray[i + 1];
    let p3 = pointsArray[i + 2];

    // Generate points between p1 and p2
    let line1Points = [];
    for (let j = 0; j <= segments; j++) {
      let t = j / segments;
      let x = lerp(p1.x, p2.x, t);
      let y = lerp(p1.y, p2.y, t);
      line1Points.push(createVector(x, y));
    }

    // Generate points between p2 and p3
    let line2Points = [];
    for (let j = 0; j <= segments; j++) {
      let t = j / segments;
      let x = lerp(p2.x, p3.x, t);
      let y = lerp(p2.y, p3.y, t);
      line2Points.push(createVector(x, y));
    }

    // Draw connecting lines
    for (let j = 0; j < strokes.length; j++) {
      if (!strokes[j].enabled) continue;
      
      stroke(strokes[j].color);

      // 'segments' is 8 in your case (points 0-8)
      for (let k = 0; k < segments; k++) {
        // Current mapping: AB[k] connects to BC[k + 1 - j]
        // For the base layer (j=0), this results in:
        // AB0 -> BC1, AB1 -> BC2 ... AB7 -> BC8
        
        let fromIndex = k;
        let toIndex = (k + 1) - j; 

        // Safety check to ensure we stay within the nail array (0 to 8)
        if (toIndex > 0 && toIndex <= segments) {
          let from = line1Points[fromIndex];
          let to = line2Points[toIndex];
          line(from.x, from.y, to.x, to.y);
        }
      }
    }
  }
}

export function generateZigzagFromGrid(points, windowWidth, s, strokeColors, storeCallback) {
  const x1 = 0;
  const x2 = windowWidth;
  const bandWidth = s / 2;

  let bandIndex = 0;
  for (let xStart = x1; xStart < x2; xStart += bandWidth, bandIndex++) {
    const xEnd = Math.min(xStart + bandWidth, x2);
    const bandPoints = points.filter(p => p.x >= xStart && p.x <= xEnd);

    // Group points by row (y)
    const rowMap = new Map();
    for (const p of bandPoints) {
      const yKey = Math.round(p.y);
      if (!rowMap.has(yKey)) rowMap.set(yKey, []);
      rowMap.get(yKey).push(p);
    }

    const sortedY = [...rowMap.keys()].sort((a, b) => a - b);
    const path = [];

    // Alternate band direction
    const bandGoesLeftToRight = bandIndex % 2 === 0;

    for (const y of sortedY) {
      let row = rowMap.get(y).sort((a, b) => a.x - b.x);
      if (!bandGoesLeftToRight) {
        row = row.reverse();
      }
      path.push(...row);
    }

    if (path.length >= 3) {
      storeCallback({
        points: path,
        colors: strokeColors
      });
    }
  }
}
