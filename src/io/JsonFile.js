/**
 * Small file I/O helpers. The original colors.js and pattern.js each had their
 * own near-identical copy of "serialize to a Blob and trigger a download" and
 * "read a File and JSON.parse it" - this is the one shared implementation.
 * Domain-specific validation of the parsed data stays with each caller.
 */

/**
 * Triggers a browser download of `data` as a JSON file.
 * @param {unknown} data
 * @param {string} filename
 * @param {number} [indent] passed straight to JSON.stringify
 */
export function downloadJson(data, filename, indent) {
  const blob = new Blob([JSON.stringify(data, null, indent)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Reads a File as text and JSON.parses it.
 * @param {File} file
 * @returns {Promise<unknown>}
 */
export function readJsonFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(JSON.parse(reader.result));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
