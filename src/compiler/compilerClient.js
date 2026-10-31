import { compile } from './index.js';

let worker = null;
let currentRequestId = 0;
let pendingCallbacks = new Map();

function getWorker() {
  if (typeof window === 'undefined' || typeof Worker === 'undefined') {
    return null;
  }
  if (!worker) {
    try {
      worker = new Worker(new URL('./compiler.worker.js', import.meta.url), {
        type: 'module',
      });
      worker.onmessage = (e) => {
        const { id, success, result, error } = e.data || {};
        const callback = pendingCallbacks.get(id);
        if (callback) {
          pendingCallbacks.delete(id);
          if (success) {
            callback.resolve(result);
          } else {
            callback.reject(new Error(error));
          }
        }
      };
      worker.onerror = (err) => {
        console.warn('Compiler worker error, falling back to sync execution:', err);
      };
    } catch (e) {
      console.warn('Failed to initialize compiler Web Worker:', e);
      worker = null;
    }
  }
  return worker;
}

export function compileAsync(source, options = {}) {
  const activeWorker = getWorker();
  if (!activeWorker) {
    // Synchronous execution fallback
    try {
      return Promise.resolve(compile(source, options));
    } catch (err) {
      return Promise.reject(err);
    }
  }

  const id = ++currentRequestId;
  return new Promise((resolve, reject) => {
    pendingCallbacks.set(id, { resolve, reject });
    activeWorker.postMessage({ id, source, options });
  });
}
