import {describe, expect, it} from 'vitest';
import {encodeHeightmapRaw32} from './heightmapRaw';

describe('encodeHeightmapRaw32', () => {
  it('emits 4 little-endian bytes per float, round-tripping exactly', () => {
    const heights = new Float32Array([0, 0.5, 1]);
    const bytes = encodeHeightmapRaw32(heights);

    expect(bytes.byteLength).toBe(heights.length * 4);

    // Read back as explicit little-endian, independent of host endianness.
    const view = new DataView(
      bytes.buffer,
      bytes.byteOffset,
      bytes.byteLength,
    );
    expect(view.getFloat32(0, true)).toBe(0);
    expect(view.getFloat32(4, true)).toBe(0.5);
    expect(view.getFloat32(8, true)).toBe(1);
  });

  it('preserves values verbatim — no quantization, no clamping', () => {
    // Out-of-0..1 headroom and sub-16-bit deltas must survive untouched.
    const heights = new Float32Array([-0.25, 1.75, 0.123456789]);
    const bytes = encodeHeightmapRaw32(heights);
    const view = new DataView(
      bytes.buffer,
      bytes.byteOffset,
      bytes.byteLength,
    );

    // Math.fround: the value as actually stored in a Float32.
    expect(view.getFloat32(0, true)).toBe(Math.fround(-0.25));
    expect(view.getFloat32(4, true)).toBe(Math.fround(1.75));
    expect(view.getFloat32(8, true)).toBe(Math.fround(0.123456789));
  });

  it('keeps far more than 16-bit precision on a smooth ramp', () => {
    const n = 200000; // > 65536, so 16-bit quantization would collide
    const heights = new Float32Array(n);
    for (let i = 0; i < n; i++) heights[i] = i / (n - 1);

    const bytes = encodeHeightmapRaw32(heights);
    const view = new DataView(
      bytes.buffer,
      bytes.byteOffset,
      bytes.byteLength,
    );
    const distinct = new Set<number>();
    for (let i = 0; i < n; i++) distinct.add(view.getFloat32(i * 4, true));

    // 16-bit caps at 65536 levels; Float32 keeps every distinct ramp step.
    expect(distinct.size).toBeGreaterThan(65536);
  });
});
