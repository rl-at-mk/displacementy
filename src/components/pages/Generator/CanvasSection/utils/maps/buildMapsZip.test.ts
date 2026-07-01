import {describe, expect, it} from 'vitest';
import {unzipSync} from 'fflate';
import {decode} from 'fast-png';
import {buildMapsZip} from './buildMapsZip';

const makeHeights = (w: number, h: number): Float32Array => {
  const heights = new Float32Array(w * h);
  for (let i = 0; i < heights.length; i++)
    heights[i] = i / (heights.length - 1);
  return heights;
};

const palette = new Uint8Array([0, 0, 0, 255, 255, 255]); // black → white

describe('buildMapsZip', () => {
  it('produces a zip of three correctly-named, decodable maps', () => {
    const w = 8;
    const h = 6;
    const zip = buildMapsZip({
      heights: makeHeights(w, h),
      width: w,
      height: h,
      palette,
      normalStrength: 1,
      heightDepth: 16,
      fileBase: 'test',
    });

    const files = unzipSync(zip);
    expect(Object.keys(files).sort()).toEqual([
      'test_color.png',
      'test_height.png',
      'test_normal.png',
    ]);

    const height = decode(files['test_height.png']);
    expect(height.width).toBe(w);
    expect(height.height).toBe(h);
    expect(height.channels).toBe(1);
    expect(height.depth).toBe(16); // follows heightDepth

    const normal = decode(files['test_normal.png']);
    expect(normal.channels).toBe(3);
    expect(normal.depth).toBe(8);

    const color = decode(files['test_color.png']);
    expect(color.channels).toBe(3);
    expect(color.depth).toBe(8);
  });

  it('honors the 8-bit height depth', () => {
    const zip = buildMapsZip({
      heights: makeHeights(4, 4),
      width: 4,
      height: 4,
      palette,
      normalStrength: 1,
      heightDepth: 8,
      fileBase: 'test',
    });
    const height = decode(unzipSync(zip)['test_height.png']);
    expect(height.depth).toBe(8);
    expect(height.channels).toBe(1);
  });

  it('reports monotonic progress ending at 1', () => {
    const fractions: number[] = [];
    buildMapsZip({
      heights: makeHeights(4, 4),
      width: 4,
      height: 4,
      palette,
      normalStrength: 1,
      heightDepth: 8,
      fileBase: 'test',
      onProgress: (f) => fractions.push(f),
    });
    expect(fractions.length).toBeGreaterThan(0);
    expect(fractions[fractions.length - 1]).toBe(1);
    for (let i = 1; i < fractions.length; i++)
      expect(fractions[i]).toBeGreaterThanOrEqual(fractions[i - 1]);
  });
});
