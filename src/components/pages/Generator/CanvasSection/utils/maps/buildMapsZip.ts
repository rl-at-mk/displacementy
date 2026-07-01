import {encode} from 'fast-png';
import {zipSync} from 'fflate';
import {encodeHeightmap8, encodeHeightmap16} from '../heightmapPng';
import {toNormalMapRGB8} from './normalMap';
import {toColorMapRGB8} from './colorMap';

export type HeightDepth = 8 | 16;

export type BuildMapsZipParams = {
  heights: Float32Array;
  width: number;
  height: number;
  /** Gradient palette as RGB triplets (see `paletteFromRowRGBA`). */
  palette: Uint8Array;
  normalStrength: number;
  heightDepth: HeightDepth;
  /** Filename stem shared by the zip and its members, e.g. `DisplacementY_…`. */
  fileBase: string;
  /** Coarse per-stage progress in `0..1` (drives the shared progress bar). */
  onProgress?: (fraction: number) => void;
};

/**
 * Derive the height + normal + color maps from the retained float buffer and pack
 * them into a single zip. Pure and synchronous — the Worker wraps this so the
 * (potentially multi-second, 8192²) work stays off the main thread. Deriving every
 * map from the float `heights` avoids the double-quantization of re-reading the
 * 8-bit canvas.
 */
export const buildMapsZip = ({
  heights,
  width,
  height,
  palette,
  normalStrength,
  heightDepth,
  fileBase,
  onProgress,
}: BuildMapsZipParams): Uint8Array => {
  onProgress?.(0.05);

  // Height — 1-channel grayscale, depth per the global selector.
  const heightPng =
    heightDepth === 16
      ? encodeHeightmap16(heights, width, height)
      : encodeHeightmap8(heights, width, height);
  onProgress?.(0.4);

  // Normal — RGB (alpha dropped), Sobel from the float heights.
  const normalPng = encode({
    width,
    height,
    data: toNormalMapRGB8(heights, width, height, normalStrength),
    depth: 8,
    channels: 3,
  });
  onProgress?.(0.7);

  // Color — RGB (alpha dropped), palette LUT over the float heights.
  const colorPng = encode({
    width,
    height,
    data: toColorMapRGB8(heights, palette, width, height),
    depth: 8,
    channels: 3,
  });
  onProgress?.(0.9);

  // PNGs are already deflate-compressed, so store them (level 0) rather than
  // waste time re-compressing.
  const zip = zipSync(
    {
      [`${fileBase}_height.png`]: heightPng,
      [`${fileBase}_normal.png`]: normalPng,
      [`${fileBase}_color.png`]: colorPng,
    },
    {level: 0},
  );
  onProgress?.(1);

  return zip;
};
