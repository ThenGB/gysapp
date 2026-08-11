import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

afterEach(() => cleanup());

// Polyfill minimal untuk pdfjs-dist yang dirujuk saat import modul viewer
// di environment test (jsdom). Matriks identitas cukup untuk import-time.
if (typeof globalThis.DOMMatrix === 'undefined') {
  class DOMMatrixStub {
    constructor(_init?: string | number[]) {}
    get a() {
      return 1;
    }
    get b() {
      return 0;
    }
    get c() {
      return 0;
    }
    get d() {
      return 1;
    }
    get e() {
      return 0;
    }
    get f() {
      return 0;
    }
    multiplySelf(_other: unknown) {
      return this;
    }
    translate(_tx: number, _ty: number) {
      return this;
    }
    scale(_sx: number, _sy: number) {
      return this;
    }
  }
  (globalThis as Record<string, unknown>).DOMMatrix = DOMMatrixStub;
}
