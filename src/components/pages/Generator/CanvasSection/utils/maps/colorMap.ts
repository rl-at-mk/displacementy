/**
 * Color (visualization) map: the float height drives a lookup into the gradient
 * palette. The palette LUT is inherently ≤256 bands, so 8-bit RGB is the correct,
 * lossless-enough target here. Working from the float `heights` (not the 8-bit
 * canvas) keeps the index selection consistent with the other maps.
 */

/**
 * Extract the RGB palette from a gradient canvas's top row (RGBA source, alpha
 * dropped). Returns a `Uint8Array` of RGB triplets. Run on the main thread (needs
 * the DOM canvas); the result is passed to the export Worker.
 */
export const paletteFromRowRGBA = (rowRGBA: Uint8ClampedArray): Uint8Array => {
  const count = Math.floor(rowRGBA.length / 4);
  const palette = new Uint8Array(count * 3);
  for (let i = 0; i < count; i++) {
    palette[i * 3] = rowRGBA[i * 4];
    palette[i * 3 + 1] = rowRGBA[i * 4 + 1];
    palette[i * 3 + 2] = rowRGBA[i * 4 + 2];
  }
  return palette;
};

/**
 * Compute the RGB color map (3 channels, 8-bit) by mapping each height in `0..1`
 * to a palette entry. Returns a `Uint8Array` of length `width * height * 3`.
 */
export const toColorMapRGB8 = (
  heights: Float32Array,
  palette: Uint8Array,
  width: number,
  height: number,
): Uint8Array => {
  const out = new Uint8Array(width * height * 3);
  const lastIndex = Math.max(palette.length / 3 - 1, 0);

  for (let i = 0; i < heights.length; i++) {
    const v = heights[i];
    const clamped = v < 0 ? 0 : v > 1 ? 1 : v;
    const p = Math.round(clamped * lastIndex) * 3;
    const o = i * 3;
    out[o] = palette[p];
    out[o + 1] = palette[p + 1];
    out[o + 2] = palette[p + 2];
  }

  return out;
};

/**
 * Preview adapter: the RGB color map expanded to opaque RGBA, ready for
 * `putImageData` onto the visible canvas.
 */
export const toColorMapRGBA = (
  heights: Float32Array,
  palette: Uint8Array,
  width: number,
  height: number,
): Uint8ClampedArray => {
  const rgb = toColorMapRGB8(heights, palette, width, height);
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let p = 0, q = 0; q < rgb.length; p += 4, q += 3) {
    rgba[p] = rgb[q];
    rgba[p + 1] = rgb[q + 1];
    rgba[p + 2] = rgb[q + 2];
    rgba[p + 3] = 255;
  }
  return rgba;
};
