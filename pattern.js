export function setUpPatternUI() {
  const patternSubmenu = document.getElementById('patternSubmenu');
  const closePatternSubmenuBtn = document.getElementById('closePatternSubmenuBtn');
  const openFavoritesBtn = document.getElementById('openPatternBtn');
  
  closePatternSubmenuBtn.addEventListener('click', () => {
    patternSubmenu.classList.remove('hidden');
    closePatternSubmenuBtn.classList.add('hidden');
  });
  
  
  closePatternSubmenuBtn.addEventListener('click', () => {
    patternSubmenu.classList.add('hidden');
    closePatternSubmenuBtn.classList.remove('hidden');
  });

  openFavoritesBtn.addEventListener('click', () => {
    patternSubmenu.classList.toggle('hidden');
  });


  const savePatternBtn = document.getElementById('saveCurrentPatternBtn');
  const exportPatternsBtn = document.getElementById('exportPatternBtn');
  const importPatternsBtn = document.getElementById('importPatternBtn');
  const importPatternsInput = document.getElementById('importPatternInput');

  savePatternBtn.addEventListener("click", () => {
  if (window.selectedPoints?.length >= 3) {
    const pattern = window.selectedPoints.map(p => ({ x: p.x, y: p.y }));
    if (!favoritePatterns.some(p => JSON.stringify(p) === JSON.stringify(pattern))) {
    favoritePatterns.push(pattern);
    renderFavoritePatterns();
    }
  }
  });

  exportPatternsBtn.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(favoritePatterns)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'favorite-patterns.json';
    a.click();
    URL.revokeObjectURL(url);
  });

  importPatternsBtn.addEventListener('click', () => importPatternsInput.click());
  importPatternsInput?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(reader.result);
        if (Array.isArray(imported) &&
            imported.every(p => Array.isArray(p) &&
              p.every(pt => pt && typeof pt.x === 'number' && typeof pt.y === 'number'))) {
          favoritePatterns.length = 0;
          favoritePatterns.push(...imported);
          renderFavoritePatterns();
        } else {
          alert('Invalid pattern file format');
        }
      } catch {
        alert('Invalid pattern file');
      }
    };
    reader.readAsText(file);
  });

}