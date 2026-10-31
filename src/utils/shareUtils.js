import LZString from 'lz-string';
import { downloadFile } from './exportUtils.js';

export function encodeShareUrl(code) {
  if (!code) return window.location.href;
  const compressed = LZString.compressToEncodedURIComponent(code);
  const url = new URL(window.location.href);
  url.hash = `code=${compressed}`;
  return url.toString();
}

export function decodeShareUrl() {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash;
  if (!hash || !hash.startsWith('#code=')) return null;

  try {
    const compressed = hash.slice('#code='.length);
    const decompressed = LZString.decompressFromEncodedURIComponent(compressed);
    return decompressed || null;
  } catch (e) {
    console.warn('Failed to decode share URL:', e);
    return null;
  }
}

export function exportIRJson(rawIR, optIR, ast) {
  const data = {
    circuitName: ast?.circuitName || 'Circuit',
    rawIR: rawIR || [],
    optimizedIR: optIR || [],
    ast: {
      inputs: ast?.expandedInputs || [],
      outputs: ast?.expandedOutputs || [],
      wires: ast?.expandedWires || [],
    },
  };
  const jsonStr = JSON.stringify(data, null, 2);
  downloadFile(jsonStr, `${data.circuitName}_ir.json`, 'application/json');
}

export function exportSchematicSVG(svgSelector, filename = 'circuit_schematic.svg') {
  const svg = document.querySelector(svgSelector);
  if (!svg) return;
  const serializer = new XMLSerializer();
  const source = serializer.serializeToString(svg);
  downloadFile(source, filename, 'image/svg+xml');
}
