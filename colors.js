// colors.js
export const storedCurves = [];
export const favoriteTriplets = [];
let favoriteColors = [];


let currentStrokeColor1 = '#AEC8A4';
let currentStrokeColor2 = '#8A784E';
let currentStrokeColor3 = '#3B3B1A';

export function getCurrentColors() {
  return [currentStrokeColor1, currentStrokeColor2, currentStrokeColor3];
}

export function setCurrentColor(index, value) {
  if (index === 0) currentStrokeColor1 = value;
  else if (index === 1) currentStrokeColor2 = value;
  else if (index === 2) currentStrokeColor3 = value;
}

export function setUpColorUI() {
  const colorPicker1 = document.getElementById('strokeColor1');
  const colorPicker2 = document.getElementById('strokeColor2');
  const colorPicker3 = document.getElementById('strokeColor3');
  const resetBtn = document.getElementById('resetBtn');
  const clearAllBtn = document.getElementById('clearAllBtn');
  const generateZigzagFromGridBtn = document.getElementById('generateZigzagFromGridBtn');

  const openFavoritesBtn = document.getElementById('openFavoritesBtn');
  const saveColorBtn = document.getElementById('saveCurrentColorBtn');
  const exportColorsBtn = document.getElementById('exportColorsBtn');
  const importColorsBtn = document.getElementById('importColorsBtn');
  const importColorsInput = document.getElementById('importColorsInput');
  const favoritesSubmenu = document.getElementById('colorFavoritesSubmenu');
  
  const colorBurgerBtn = document.getElementById('closeColorSubmenuBtn');
  const colorSubmenu = document.getElementById('colorFavoritesSubmenu');
  const closeColorSubmenuBtn = document.getElementById('closeColorSubmenuBtn');
  
  colorBurgerBtn.addEventListener('click', () => {
    colorSubmenu.classList.remove('hidden');  // show submenu
    colorBurgerBtn.classList.add('hidden');   // hide burger button
  });
  
  
  closeColorSubmenuBtn.addEventListener('click', () => {
    colorSubmenu.classList.add('hidden');     // hide submenu
    colorBurgerBtn.classList.remove('hidden'); // show burger button
  });



  colorPicker1.value = currentStrokeColor1;
  colorPicker2.value = currentStrokeColor2;
  colorPicker3.value = currentStrokeColor3;

  colorPicker1.addEventListener('input', (e) => currentStrokeColor1 = e.target.value);
  colorPicker2.addEventListener('input', (e) => currentStrokeColor2 = e.target.value);
  colorPicker3.addEventListener('input', (e) => currentStrokeColor3 = e.target.value);

  resetBtn.addEventListener('click', () => {
    if (window.selectedPoints?.length >= 3) {
      storedCurves.push({
        points: window.selectedPoints.map(p => p.copy()),
        colors: [currentStrokeColor1, currentStrokeColor2, currentStrokeColor3]
      });
    }
    window.resetSelectedPoints?.();
  });

  clearAllBtn.addEventListener('click', () => {
    window.selectedPoints.length = 0;
    storedCurves.length = 0;
  });
  
  generateZigzagFromGridBtn.addEventListener('click', () => {
    window.generateZigzagFromGrid?.(
      window.points,
      window.s * window.rows,
      window.s,
      [currentStrokeColor1, currentStrokeColor2, currentStrokeColor3],
      (curve) => storedCurves.push(curve)
    );
  });

  openFavoritesBtn.addEventListener('click', () => {
    favoritesSubmenu.classList.toggle('hidden');
  });

  saveColorBtn.addEventListener("click", () => {
    const triplet = [currentStrokeColor1, currentStrokeColor2, currentStrokeColor3];
    if (!favoriteTriplets.some(fav => JSON.stringify(fav) === JSON.stringify(triplet))) {
      favoriteTriplets.push(triplet);
      renderFavoriteTriplets();
    }
  });

  exportColorsBtn.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(favoriteTriplets)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'favorite-triplets.json';
    a.click();
    URL.revokeObjectURL(url);
  });

  importColorsBtn.addEventListener('click', () => {
    importColorsInput.click();
  });
  
  importColorsInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(reader.result);
        if (
          Array.isArray(imported) &&
          imported.every(
            triplet => Array.isArray(triplet) &&
                       triplet.length === 3 &&
                       triplet.every(c => typeof c === 'string')
          )
        ) {
          favoriteTriplets.length = 0;
          favoriteTriplets.push(...imported);
          renderFavoriteTriplets();
        } else {
          alert('Invalid file format. Please import an array of color triplets.');
        }
      } catch {
        alert('Invalid file format');
      }
    };
    reader.readAsText(file);
  });
  

}
export function renderFavoriteTriplets() {
    const container = document.getElementById("favoriteTripletsContainer");
    container.innerHTML = "";  // Only clear this sub-container, not the whole submenu
  
    favoriteTriplets.forEach(triplet => {
      const tripletDiv = document.createElement("div");
      tripletDiv.style.display = "flex";
      tripletDiv.style.gap = "6px";
      tripletDiv.style.marginBottom = "6px";
  
      triplet.forEach((color, idx) => {
        const colorBtn = document.createElement("button");
        colorBtn.style.width = "24px";
        colorBtn.style.height = "24px";
        colorBtn.style.border = "1px solid #999";
        colorBtn.style.backgroundColor = color;
        colorBtn.title = color;
  
        colorBtn.addEventListener("click", () => {
          if (idx === 0) currentStrokeColor1 = color;
          if (idx === 1) currentStrokeColor2 = color;
          if (idx === 2) currentStrokeColor3 = color;
  
          // Update the color pickers too:
          document.getElementById('strokeColor1').value = currentStrokeColor1;
          document.getElementById('strokeColor2').value = currentStrokeColor2;
          document.getElementById('strokeColor3').value = currentStrokeColor3;
        });
  
        tripletDiv.appendChild(colorBtn);
      });
  
      container.appendChild(tripletDiv);
    });
  }
  
