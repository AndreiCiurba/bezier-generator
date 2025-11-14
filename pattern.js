import { storedCurves, getCurrentColors } from './colors.js';
import { selectedPoints } from './interactions.js';
import { drawStringArtCurve } from './bezier.js';
import { panX, panY, zoom } from './main.js';
import { points } from './grid.js'
import { v4 as uuidv4 } from "https://unpkg.com/uuid@9.0.1/dist/esm-browser/index.js";

export let savedPatterns = [];

export function findPatternById(id) {
  for (let p of savedPatterns) {
    if (p.id == id) {
      return p;
    }
  }
  return null;
}

export let selectedPatternId = null;
export let patternInUse = false

export function getSelectedPatternId() {
  return selectedPatternId;
}

export function setSelectedPatternId(id, inUse) {
  selectedPatternId = id;
  patternInUse = inUse;
}


export function setUpPatternUI() {
  const patternSubmenu = document.getElementById('patternSubmenu');
  const openPatternBtn = document.getElementById('openPatternBtn');
  const closePatternBtn = document.getElementById('closePatternSubmenuBtn');

  const exportBtn = document.getElementById('exportPatternBtn');
  const importBtn = document.getElementById('importPatternBtn');
  const importInput = document.getElementById('importPatternInput');
  const saveCurrentBtn = document.getElementById('saveCurrentPatternBtn');

  const nameInput = document.getElementById('patternNameInput');
  const savedList = document.getElementById('savedPatternsList');

  openPatternBtn.addEventListener('click', () => {
    patternSubmenu.classList.remove('hidden');
  });

  closePatternBtn.addEventListener('click', () => {
    patternSubmenu.classList.add('hidden');
  });

  exportBtn.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(savedPatterns, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'patterns.json';
    a.click();
    URL.revokeObjectURL(url);
  });

  importBtn.addEventListener('click', () => importInput.click());
  importInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (Array.isArray(data)) {
          data.forEach(p => {
            if (p.name && p.points && p.id) {
              savedPatterns.push({
                id: p.id,
                name: p.name,
                points: p.points,
                colors: p.colors
              });
            }
          });
          renderSavedPatternList();
        }
      } catch (err) {
        alert('Invalid pattern file.');
        console.error(err);
      }
    };
    reader.readAsText(file);
  });

  saveCurrentBtn.addEventListener('click', () => {
    const name = nameInput.value.trim();
    if (!name) {
      alert("Please enter a name for the pattern.");
      return;
    }

    if (selectedPoints.length < 3) {
      alert("At least 3 points required.");
      return;
    }

    const pattern = {
      id: uuidv4(),
      name,
      points: selectedPoints.map(p => ({ x: p.x, y: p.y })),
      colors: getCurrentColors().slice()
    };

    savedPatterns.push(pattern);
    renderSavedPatternList();
    nameInput.value = '';
  });

  function renderSavedPatternList() {
    savedList.innerHTML = '';
    savedPatterns.forEach((pattern, idx) => {
      const li = document.createElement('li');
      li.textContent = pattern.name;
      li.style.cursor = 'pointer';
      li.style.marginBottom = '4px';
      li.addEventListener('click', () => {
        resetSelectedPatterns();
        selectedPatternId = pattern.id;
        patternInUse = true;
        li.style.borderStyle = 'solid';
        renderPatternThroughoutTheGrid()
      });
      savedList.appendChild(li);
    });
  }
}

export function resetPattern() {
  patternInUse = false;
  selectedPatternId = null;
  resetSelectedPatterns();
}

function resetSelectedPatterns() {
  const listItems = document.querySelectorAll('#savedPatternsList li');
  listItems.forEach(li => {
    li.style.border = 'none';
  });
}

export function renderPattern(click) {
  let selectedPattern = findPatternById(selectedPatternId);
  if (selectedPattern == null) {
    return;
  }

  const worldMouse = createVector(
    (click.x - panX) / zoom,
    (click.y - panY) / zoom
  );

  let closestGridPoint;
  for (let p of points) {
    if (dist(worldMouse.x, worldMouse.y, p.x, p.y) < 10) {
      closestGridPoint = p.copy()
      break;
    }
  }

  const offsetX = selectedPattern.points[0].x - closestGridPoint.x;
  const offsetY = selectedPattern.points[0].y - closestGridPoint.y;

  const newPoints = selectedPattern.points.map(p =>
    createVector(p.x - offsetX, p.y - offsetY)
  );

  storedCurves.push({
    points: newPoints,
    colors: selectedPattern.colors,
    patternId: selectedPatternId
  });
}

export function renderPatternThroughoutTheGrid() {
  let selectedPattern = findPatternById(selectedPatternId);
  if (selectedPattern == null) {
    return;
  }

  if (storedCurves.some(c => c.patternId === selectedPatternId)) {
    return;
  }

  for (let p of points) {
    const offsetX = selectedPattern.points[0].x - p.x;
    const offsetY = selectedPattern.points[0].y - p.y;

    const newPoints = selectedPattern.points.map(point =>
      createVector(point.x - offsetX, point.y - offsetY)
    );

    storedCurves.push({
      points: newPoints,
      colors: selectedPattern.colors,
      patternId: selectedPatternId
    });
  }
}

export function drawPatternPreview() {
  const mousePos = createVector(mouseX, mouseY);
  const patternOrigin = createVector(
    selectedPatternId.points[0].x,
    selectedPatternId.points[0].y
  );
  const offset = p5.Vector.sub(mousePos, patternOrigin);

  const translated = selectedPatternId.points.map(p =>
    createVector(p.x + offset.x, p.y + offset.y)
  );

  strokeWeight(2);
  stroke(0);
  noFill();
  beginShape();
  drawStringArtCurve(translated, getCurrentColors());

  endShape();
}
