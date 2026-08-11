/**
 * Triggers a browser download of a canvas's contents as a PNG file. Mirrors
 * `downloadJson` in JsonFile.js - a Blob, an object URL, and a throwaway
 * clicked `<a>` - just sourced from `canvas.toBlob` instead of `JSON.stringify`.
 * @param {HTMLCanvasElement} canvas
 * @param {string} filename
 */
export function downloadCanvasPng(canvas, filename) {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
}
