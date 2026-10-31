import { compile } from './index.js';

self.onmessage = function (e) {
  const { id, source, options } = e.data || {};
  try {
    const result = compile(source, options);
    self.postMessage({ id, success: true, result });
  } catch (error) {
    self.postMessage({
      id,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
