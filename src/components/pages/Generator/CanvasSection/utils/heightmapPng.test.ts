import {describe, expect, it} from 'vitest';
import {decode} from 'fast-png';
import {quantizeTo16, encodeHeightmap16} from './heightmapPng';

describe('quantizeTo16', () => {
  it('maps 0..1 onto the full 0..65535 range', () => {
    const q = quantizeTo16(new Float32Array([0, 0.5, 1]));
    expect(q[0]).toBe(0);
    expect(q[1]).toBe(Math.round(0.5 * 65535));
    expect(q[2]).toBe(65535);
  });

  it('clamps out-of-range values', () => {
    const q = quantizeTo16(new Float32Array([-0.2, 1.7]));
    expect(q[0]).toBe(0);
    expect(q[1]).toBe(65535);
  });

  it('preserves >256 distinct levels for a smooth ramp (no 8-bit banding)', () => {
    const n = 4096;
    const heights = new Float32Array(n);
    for (let i = 0; i < n; i++) heights[i] = i / (n - 1);
    const distinct = new Set(quantizeTo16(heights));
    // 8-bit would cap at 256; 16-bit keeps them all.
    expect(distinct.size).toBeGreaterThan(256);
  });
});

describe('encodeHeightmap16', () => {
  it('produces a valid 16-bit grayscale PNG that round-trips with full precision', () => {
    const width = 64;
    const height = 64;
    const heights = new Float32Array(width * height);
    for (let i = 0; i < heights.length; i++)
      heights[i] = i / (heights.length - 1);

    const png = encodeHeightmap16(heights, width, height);
    const decoded = decode(png);

    expect(decoded.width).toBe(width);
    expect(decoded.height).toBe(height);
    expect(decoded.depth).toBe(16);
    expect(decoded.channels).toBe(1);
    expect(new Set(decoded.data).size).toBeGreaterThan(256);
  });
});
