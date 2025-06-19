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

  export function drawStringArtCurve(pointsArray, strokeColors = ['#0000ff', '#00ff00', '#ff0000'], segments = 9) {
  // Use only the first color from the array
  const strokeColor = strokeColors[0];

  stroke(strokeColor);
  strokeWeight(0.6);
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

    stroke(strokeColors[0]);
    // strokeWeight(1);
    for (let j = 0; j <= segments; j++) {
      let from = line1Points[j];
      let to = line2Points[j];
      line(from.x, from.y, to.x, to.y);
    }

    stroke(strokeColors[1]);
    // strokeWeight(0.6);
    for (let j = 2; j <= segments; j++) {
      let from = line1Points[j];
      let to = line2Points[j - 2];
      line(from.x, from.y, to.x, to.y);
    }

    
    stroke(strokeColors[2]);
    // strokeWeight(0.4);
    for (let j = 4; j <= segments; j++) {
      let from = line1Points[j];
      let to = line2Points[j - 4];
      line(from.x, from.y, to.x, to.y);
    }

  }
}


export function zigzagStripePoints(gridPoints, selectedPoints) {
    if (selectedPoints.length < 2) return [];
  
    // Determine horizontal bounds from selected points
    const xs = selectedPoints.map(p => p.x);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
  
    // Filter grid points within horizontal bounds (+ small margin)
    const margin = 5;
    const stripePoints = gridPoints.filter(p => p.x >= minX - margin && p.x <= maxX + margin);
  
    // Group points by their y-coordinate (rows)
    const rowsMap = new Map();
    for (const p of stripePoints) {
      // Use y rounded to nearest integer to bucket rows (you may tweak this)
      const yKey = Math.round(p.y);
      if (!rowsMap.has(yKey)) rowsMap.set(yKey, []);
      rowsMap.get(yKey).push(p);
    }
  
    // Sort rows by y ascending
    const sortedRows = [...rowsMap.entries()].sort((a, b) => a[0] - b[0]);
  
    // For each row, sort points left-to-right, and reverse on odd rows to zigzag
    let zigzagPoints = [];
    sortedRows.forEach(([_, rowPoints], idx) => {
      rowPoints.sort((a, b) => a.x - b.x);
      if (idx % 2 === 1) rowPoints.reverse();  // reverse every odd row for zigzag
      zigzagPoints = zigzagPoints.concat(rowPoints);
    });
  
    return zigzagPoints;
  }

  