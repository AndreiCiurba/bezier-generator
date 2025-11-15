
export const storedCurves = [];
export const favoriteColorBundles = [];

let currentStrokeColors = [
  { color: '#AEC8A4', enabled: true },
  { color: '#8A784E', enabled: true },
  { color: '#3B3B1A', enabled: true },
  { color: '#33eaa2', enabled: true },
  { color: '#11ff11', enabled: true },
  { color: '#1111ff', enabled: true },
  { color: '#ff1111', enabled: true }
];

export function getCurrentColorList() {
  return currentStrokeColors
    .filter(entry => entry.enabled)
    .map(entry => entry.color);
}


export function getCurrentStrokes() {
  return currentStrokeColors;
}

export function setCurrentColor(index, value) {
  currentStrokeColors[index].color = value;
}

export function setUpColorUI() {
  const container = document.getElementById('colorPickerContainer');
  const colorPickers = container.querySelectorAll('input[type="color"]');


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
    colorSubmenu.classList.remove('hidden');
    colorBurgerBtn.classList.add('hidden');
  });


  closeColorSubmenuBtn.addEventListener('click', () => {
    colorSubmenu.classList.add('hidden');
    colorBurgerBtn.classList.remove('hidden');
  });

  for (let i = 0; i < colorPickers.length; i++) {
    colorPickers[i].value = currentStrokeColors[i].color;
    colorPickers[i].addEventListener('input', (e) => currentStrokeColors[i].color = e.target.value);
  }

  openFavoritesBtn.addEventListener('click', () => {
    favoritesSubmenu.classList.toggle('hidden');
  });

  saveColorBtn.addEventListener("click", () => {
    const colorBundles = getCurrentColorList();
    if (!favoriteColorBundles.some(fav => JSON.stringify(fav) === JSON.stringify(colorBundles))) {
      favoriteColorBundles.push(colorBundles);
      renderFavoriteBundles();
    }
  });

  exportColorsBtn.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(favoriteColorBundles)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'color-lists.json';
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
        if (Array.isArray(imported) &&
          imported.every(bundle => Array.isArray(bundle) && bundle.every(c => typeof c === 'string'))) {
          favoriteColorBundles.length = 0;
          favoriteColorBundles.push(...imported);
          renderFavoriteBundles();
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

export function renderFavoriteBundles() {
  const container = document.getElementById("favoriteBundlesContainer");
  container.innerHTML = "";  // Only clear this sub-container, not the whole submenu

  favoriteColorBundles.forEach(bundle => {
    const bundleDiv = document.createElement("div");
    bundleDiv.classList.add("bundle");

    bundle.forEach((color, idx) => {
      const colorBtn = document.createElement("button");
      colorBtn.classList.add("color-btn");
      colorBtn.style.backgroundColor = color;
      colorBtn.title = color;

      bundleDiv.addEventListener("click", () => {

        document.querySelectorAll(".bundle").forEach(b => {
          b.classList.remove("selected");
        });
        bundleDiv.classList.add("selected");


        setCurrentColor(idx, color);
        const pickers = document.querySelectorAll('#colorPickerContainer input[type="color"]');
        if (pickers[idx]) {
          pickers[idx].value = color;
        }
      });

      bundleDiv.appendChild(colorBtn);
    });
    container.appendChild(bundleDiv);
  });
}