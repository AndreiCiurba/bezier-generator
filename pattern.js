import { storedCurves, getCurrentColors } from './colors.js';
import { selectedPoints } from './interactions.js';
import { points } from './grid.js';

let savedPatterns = [];
let pendingPatternToPlace = null;
export let patternInUse = false

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

  // Open submenu
  openPatternBtn.addEventListener('click', () => {
    patternSubmenu.classList.remove('hidden');
  });

  // Close submenu
  closePatternBtn.addEventListener('click', () => {
    patternSubmenu.classList.add('hidden');
  });

  // Export saved patterns
  exportBtn.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(savedPatterns, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'patterns.json';
    a.click();
    URL.revokeObjectURL(url);
  });

  // Trigger file input
  importBtn.addEventListener('click', () => importInput.click());

  // Handle import
  importInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (Array.isArray(data)) {
          data.forEach(p => {
            if (p.name && p.points && p.colors) {
              savedPatterns.push({
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

  // Save current pattern
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
      name,
      points: selectedPoints.map(p => ({ x: p.x, y: p.y })),
      colors: getCurrentColors()
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
        pendingPatternToPlace = pattern;
        patternInUse = true;
        li.style.borderStyle = 'solid';
      });
      savedList.appendChild(li);
    });
  }
}

export function resetPattern() {
  patternInUse = false;
  resetSelectedPatterns();
}

function resetSelectedPatterns() {
  const listItems = document.querySelectorAll('#savedPatternsList li');
  listItems.forEach(li => {
    li.style.border = 'none';
  });
}

export function renderPattern(origin) {
  if (!pendingPatternToPlace) return;

  const offsetX = pendingPatternToPlace.points[0].x - origin.x;
  const offsetY = pendingPatternToPlace.points[0].y - origin.y;

  const newPoints = pendingPatternToPlace.points.map(p =>
    createVector(p.x - offsetX, p.y - offsetY)
  );

  console.log(origin)
  console.log(newPoints)

  storedCurves.push({
    points: newPoints,
    colors: pendingPatternToPlace.colors
  });
}