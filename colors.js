// colors.js
export const storedCurves = [];
export const favoriteColorBundles = [];

let currentStrokeColors = ['#AEC8A4', '#8A784E', '#3B3B1A', '#33eaa2', '#11ff11', '#1111ff', '#ff1111'];

export function getCurrentColors() {
  return currentStrokeColors;
}

export function setCurrentColor(index, value) {
  currentStrokeColors[index] = value;
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
    colorPickers[i].value = currentStrokeColors[i];
    colorPickers[i].addEventListener('input', (e) => currentStrokeColors[i] = e.target.value);
  }

  openFavoritesBtn.addEventListener('click', () => {
    favoritesSubmenu.classList.toggle('hidden');
  });

  saveColorBtn.addEventListener("click", () => {
    const colorBundles = getCurrentColors();
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
    bundleDiv.style.display = "flex";
    bundleDiv.style.gap = "2px";
    bundleDiv.style.marginBottom = "6px";
    bundleDiv.style.width = "100%";
    bundleDiv.style.alignItems = "stretch";

    bundle.forEach((color, idx) => {
      const colorBtn = document.createElement("button");

      colorBtn.style.flex = "1 1 0";
      colorBtn.style.minWidth = "0"; 
      colorBtn.style.boxSizing = "border-box";
      colorBtn.style.aspectRatio = "1 / 1";
      colorBtn.style.backgroundColor = color;
      colorBtn.style.cursor = "pointer";
      colorBtn.style.padding = "0";
      colorBtn.title = color;

      bundleDiv.addEventListener("click", () => {
        currentStrokeColors[idx] = color;
        const pickers = document.querySelectorAll('#colorPickerContainer input[type="color"]');
        if (pickers[idx]) {
          pickers[idx].value = color;
        }

        for (let i = 0; i < currentStrokeColors.length; i++) {
          pickers[i].value = currentStrokeColors[i];
        }
      });

      bundleDiv.appendChild(colorBtn);
    });
    container.appendChild(bundleDiv);
  });
}

