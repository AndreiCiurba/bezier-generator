// Single point of contact for ID generation. The original code imported uuid
// straight from a CDN inline inside pattern.js; centralizing it here means the
// rest of the app never needs to know (or care) that it comes from a CDN at all.
import { v4 as uuidv4 } from 'https://unpkg.com/uuid@9.0.1/dist/esm-browser/index.js';

export function generateId() {
  return uuidv4();
}
