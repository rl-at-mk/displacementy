/**
 * A neighbor sampler for the float height buffer. When `seamless` is true it
 * **wraps** at the edges (so a tiling height map yields tiling derived maps);
 * otherwise it **clamps** to the border (replicated edge). Out-of-range
 * coordinates are the norm here — Sobel and HBAO both read beyond the edges.
 */
export const makeHeightSampler = (
  heights: Float32Array,
  width: number,
  height: number,
  seamless: boolean,
): ((x: number, y: number) => number) => {
  if (seamless) {
    return (x, y) => {
      let wx = x % width;
      if (wx < 0) wx += width;
      let wy = y % height;
      if (wy < 0) wy += height;
      return heights[wy * width + wx];
    };
  }
  return (x, y) => {
    const cx = x < 0 ? 0 : x >= width ? width - 1 : x;
    const cy = y < 0 ? 0 : y >= height ? height - 1 : y;
    return heights[cy * width + cx];
  };
};
