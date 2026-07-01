import {encode} from 'fast-png';

/**
 * Quantize a float height buffer (`0..1`) to 16-bit unsigned (`0..65535`).
 * This is where the precision of the float core actually reaches the file:
 * 65,536 levels instead of 8-bit's 256, so smooth gradients export without the
 * terracing that breaks 3D displacement.
 */
export const quantizeTo16 = (heights: Float32Array): Uint16Array => {
  const out = new Uint16Array(heights.length);
  for (let i = 0; i < heights.length; i++) {
    const v = heights[i];
    const clamped = v < 0 ? 0 : v > 1 ? 1 : v;
    out[i] = Math.round(clamped * 65535);
  }
  return out;
};

/** Quantize a float height buffer (`0..1`) to 8-bit unsigned (`0..255`). */
export const quantizeTo8 = (heights: Float32Array): Uint8Array => {
  const out = new Uint8Array(heights.length);
  for (let i = 0; i < heights.length; i++) {
    const v = heights[i];
    const clamped = v < 0 ? 0 : v > 1 ? 1 : v;
    out[i] = Math.round(clamped * 255);
  }
  return out;
};

/**
 * Encode a float height buffer as a **16-bit grayscale PNG** (single channel) —
 * the natural lossless format for a displacement heightmap. Returns the PNG bytes.
 */
export const encodeHeightmap16 = (
  heights: Float32Array,
  width: number,
  height: number,
): Uint8Array => {
  const data = quantizeTo16(heights);
  return encode({width, height, data, depth: 16, channels: 1});
};

/**
 * Encode a float height buffer as an **8-bit grayscale PNG** (single channel).
 * Semantically correct and smaller than the old `canvas.toDataURL` path, which
 * wrote a 4-channel RGBA PNG (value duplicated across R=G=B + a constant alpha).
 */
export const encodeHeightmap8 = (
  heights: Float32Array,
  width: number,
  height: number,
): Uint8Array => {
  const data = quantizeTo8(heights);
  return encode({width, height, data, depth: 8, channels: 1});
};
