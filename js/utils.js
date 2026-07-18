/* ============================================================
   DM BOARD — Utilities (image storage, DOM helpers, UID)
   ============================================================ */

/** Generate a short unique ID. */
export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/**
 * Store an image file as a data URL. Only downscales if the
 * longest side exceeds 3200px. Original format preserved
 * (PNG stays lossless, JPEG gets 95% quality).
 */
export function compressImage(file, maxDim = 3200) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      return reject(new Error('El archivo no es una imagen.'));
    }

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        // Keep original format: PNG stays lossless, JPEG at 95%
        const isPng = file.type === 'image/png';
        const dataUrl = canvas.toDataURL(
          isPng ? 'image/png' : 'image/jpeg',
          isPng ? undefined : 0.95
        );
        resolve({ dataUrl, width, height });
      };
      img.onerror = () => reject(new Error('No se pudo cargar la imagen.'));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.readAsDataURL(file);
  });
}

/** Clamp a number between min and max. */
export function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

/** Debounce a function call. */
export function debounce(fn, ms = 150) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/** Simple event emitter. */
export function createEmitter() {
  const listeners = {};
  return {
    on(event, fn) { (listeners[event] || (listeners[event] = [])).push(fn); },
    off(event, fn) { const ls = listeners[event]; if (ls) { const i = ls.indexOf(fn); if (i >= 0) ls.splice(i, 1); } },
    emit(event, ...args) { (listeners[event] || []).forEach(fn => fn(...args)); },
  };
}
