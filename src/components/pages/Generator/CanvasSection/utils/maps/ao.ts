/**
 * Ambient occlusion from a float height field via **Horizon-Based Ambient
 * Occlusion (HBAO)** — the method Substance 3D Designer's AO node uses. For each
 * pixel we sweep a set of directions; along each we march outward to `radius` and
 * track the steepest upward slope (the "horizon"). More/steeper nearby terrain →
 * more occlusion → darker. Grayscale 8-bit (255 = fully open, 0 = fully occluded).
 *
 * Cost is `directions × steps` taps per pixel, so it's heavier than the Sobel
 * normal (hence AO is off by default in the export UI).
 */

import {makeHeightSampler} from './sampleHeights';

const DIRECTIONS = 8;
const STEPS = 8;

/**
 * Compute the AO map (1 channel, 8-bit). `radius` is the sampling reach in
 * pixels; `strength` scales the occlusion (0 = none); `seamless` wraps edge
 * sampling so a tiling height map yields a tiling AO map. Returns `Uint8Array`
 * of length `width * height`.
 */
export const toAO8 = (
  heights: Float32Array,
  width: number,
  height: number,
  radius: number,
  strength: number,
  seamless = false,
): Uint8Array => {
  const out = new Uint8Array(width * height);
  const angleStep = (Math.PI * 2) / DIRECTIONS;
  const sample = makeHeightSampler(heights, width, height, seamless);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const hCenter = heights[y * width + x];
      let occlusion = 0;

      for (let d = 0; d < DIRECTIONS; d++) {
        const angle = d * angleStep;
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);

        // Steepest upward slope along this direction = the horizon.
        let horizon = 0;
        for (let s = 1; s <= STEPS; s++) {
          const dist = (s / STEPS) * radius;
          const hs = sample(
            Math.round(x + dx * dist),
            Math.round(y + dy * dist),
          );
          // Normalize height delta against distance (near occluders weigh more).
          const tangent = ((hs - hCenter) * radius) / dist;
          if (tangent > horizon) horizon = tangent;
        }

        // sin(atan(horizon)) — the occluded fraction of the sky in this sweep.
        occlusion += horizon / Math.sqrt(1 + horizon * horizon);
      }

      occlusion = (occlusion / DIRECTIONS) * strength;
      const ao = 1 - occlusion;
      out[y * width + x] = Math.round((ao < 0 ? 0 : ao > 1 ? 1 : ao) * 255);
    }
  }

  return out;
};

/** Above this dimension, compute AO downsampled then upscale (see `toAO8Auto`). */
const AO_COMPUTE_CAP = 2048;

/** Box-average `heights` down by an integer `factor`. */
const downsampleHeights = (
  heights: Float32Array,
  width: number,
  height: number,
  factor: number,
): {data: Float32Array; width: number; height: number} => {
  const sw = Math.max(1, Math.ceil(width / factor));
  const sh = Math.max(1, Math.ceil(height / factor));
  const data = new Float32Array(sw * sh);
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      let sum = 0;
      let n = 0;
      for (let dy = 0; dy < factor; dy++) {
        const sy = y * factor + dy;
        if (sy >= height) break;
        for (let dx = 0; dx < factor; dx++) {
          const sx = x * factor + dx;
          if (sx >= width) break;
          sum += heights[sy * width + sx];
          n++;
        }
      }
      data[y * sw + x] = sum / n;
    }
  }
  return {data, width: sw, height: sh};
};

/**
 * Bilinearly upscale a grayscale map from (sw×sh) to (dw×dh). When `seamless`,
 * edge samples wrap to the opposite edge so the upscaled map still tiles.
 */
const upscaleGray = (
  src: Uint8Array,
  sw: number,
  sh: number,
  dw: number,
  dh: number,
  seamless: boolean,
): Uint8Array => {
  const out = new Uint8Array(dw * dh);
  const scaleX = sw / dw;
  const scaleY = sh / dh;
  const wrap = (v: number, n: number): number => {
    const m = v % n;
    return m < 0 ? m + n : m;
  };
  for (let y = 0; y < dh; y++) {
    const fy = (y + 0.5) * scaleY - 0.5;
    let y0: number;
    let y1: number;
    let wyf: number;
    if (seamless) {
      const f = Math.floor(fy);
      wyf = fy - f;
      y0 = wrap(f, sh);
      y1 = wrap(f + 1, sh);
    } else {
      const cy = fy < 0 ? 0 : fy > sh - 1 ? sh - 1 : fy;
      y0 = Math.floor(cy);
      y1 = Math.min(y0 + 1, sh - 1);
      wyf = cy - y0;
    }
    for (let x = 0; x < dw; x++) {
      const fx = (x + 0.5) * scaleX - 0.5;
      let x0: number;
      let x1: number;
      let wxf: number;
      if (seamless) {
        const f = Math.floor(fx);
        wxf = fx - f;
        x0 = wrap(f, sw);
        x1 = wrap(f + 1, sw);
      } else {
        const cx = fx < 0 ? 0 : fx > sw - 1 ? sw - 1 : fx;
        x0 = Math.floor(cx);
        x1 = Math.min(x0 + 1, sw - 1);
        wxf = cx - x0;
      }
      const a = src[y0 * sw + x0];
      const b = src[y0 * sw + x1];
      const c = src[y1 * sw + x0];
      const d = src[y1 * sw + x1];
      const top = a + (b - a) * wxf;
      const bot = c + (d - c) * wxf;
      out[y * dw + x] = Math.round(top + (bot - top) * wyf);
    }
  }
  return out;
};

/**
 * AO with automatic downsampling for large maps: HBAO is `O(pixels)` with a big
 * constant, so above {@link AO_COMPUTE_CAP} we box-average the heights down,
 * compute AO there (radius scaled to match), then bilinearly upscale. AO is
 * low-frequency, so the result is visually ~identical at a fraction of the cost
 * (e.g. 8192² drops from ~50s to a few seconds). `seamless` wraps sampling in
 * both the AO pass and the upscale so a tiling height map yields a tiling AO.
 */
export const toAO8Auto = (
  heights: Float32Array,
  width: number,
  height: number,
  radius: number,
  strength: number,
  seamless = false,
): Uint8Array => {
  const factor = Math.ceil(Math.max(width, height) / AO_COMPUTE_CAP);
  if (factor <= 1)
    return toAO8(heights, width, height, radius, strength, seamless);

  const small = downsampleHeights(heights, width, height, factor);
  const smallAO = toAO8(
    small.data,
    small.width,
    small.height,
    Math.max(1, radius / factor),
    strength,
    seamless,
  );
  return upscaleGray(
    smallAO,
    small.width,
    small.height,
    width,
    height,
    seamless,
  );
};

/** Preview adapter: AO expanded to opaque grayscale RGBA. */
export const toAORGBA = (
  heights: Float32Array,
  width: number,
  height: number,
  radius: number,
  strength: number,
  seamless = false,
): Uint8ClampedArray => {
  const gray = toAO8Auto(heights, width, height, radius, strength, seamless);
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let i = 0, p = 0; i < gray.length; i++, p += 4) {
    rgba[p] = gray[i];
    rgba[p + 1] = gray[i];
    rgba[p + 2] = gray[i];
    rgba[p + 3] = 255;
  }
  return rgba;
};
