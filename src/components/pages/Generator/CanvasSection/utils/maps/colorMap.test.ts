import {describe, expect, it} from 'vitest';
import {paletteFromRowRGBA, toColorMapRGB8} from './colorMap';

describe('paletteFromRowRGBA', () => {
  it('extracts RGB triplets and drops alpha', () => {
    const row = new Uint8ClampedArray([
      0, 0, 0, 255, 255, 0, 0, 255, 0, 255, 0, 128,
    ]);
    const palette = paletteFromRowRGBA(row);
    expect([...palette]).toEqual([0, 0, 0, 255, 0, 0, 0, 255, 0]);
  });
});

describe('toColorMapRGB8', () => {
  it('maps height 0..1 across the palette endpoints', () => {
    // 4-entry palette: black, red, green, blue.
    const palette = new Uint8Array([0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255]);
    const heights = new Float32Array([0, 0.5, 1]);
    const rgb = toColorMapRGB8(heights, palette, 3, 1);
    // 0 → index 0 (black); 0.5 → round(0.5*3)=2 (green); 1 → index 3 (blue).
    expect([...rgb]).toEqual([0, 0, 0, 0, 255, 0, 0, 0, 255]);
  });

  it('clamps out-of-range heights to the palette ends', () => {
    const palette = new Uint8Array([10, 20, 30, 40, 50, 60]); // 2 entries
    const heights = new Float32Array([-1, 2]);
    const rgb = toColorMapRGB8(heights, palette, 2, 1);
    expect([...rgb]).toEqual([10, 20, 30, 40, 50, 60]);
  });
});
