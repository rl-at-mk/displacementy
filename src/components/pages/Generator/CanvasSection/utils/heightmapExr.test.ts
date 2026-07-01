import {describe, expect, it} from 'vitest';
import {encodeHeightmapExr} from './heightmapExr';

/**
 * Independent, minimal EXR reader used only to validate the writer's output.
 * Deliberately shares no code with the encoder so it catches layout/offset bugs.
 * Assumes the writer's format: uncompressed, single FLOAT channel, scanline.
 */
const decodeExr = (bytes: Uint8Array) => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  // Magic + version.
  expect([bytes[0], bytes[1], bytes[2], bytes[3]]).toEqual([
    0x76, 0x2f, 0x31, 0x01,
  ]);
  expect(view.getUint32(4, true) & 0xff).toBe(2); // version number

  let pos = 8;
  const readStringZ = (): string => {
    let s = '';
    while (bytes[pos] !== 0) s += String.fromCharCode(bytes[pos++]);
    pos++; // skip null
    return s;
  };

  // Parse attributes until the empty-name terminator.
  const attrs: Record<string, {type: string; start: number; size: number}> = {};
  for (;;) {
    const name = readStringZ();
    if (name === '') break; // header terminator
    const type = readStringZ();
    const size = view.getInt32(pos, true);
    pos += 4;
    attrs[name] = {type, start: pos, size};
    pos += size;
  }

  // dataWindow → dimensions.
  const dw = attrs.dataWindow;
  const xMin = view.getInt32(dw.start, true);
  const yMin = view.getInt32(dw.start + 4, true);
  const xMax = view.getInt32(dw.start + 8, true);
  const yMax = view.getInt32(dw.start + 12, true);
  const width = xMax - xMin + 1;
  const height = yMax - yMin + 1;

  // channels: expect a single FLOAT channel then a terminator.
  const ch = attrs.channels;
  let cpos = ch.start;
  let chName = '';
  while (bytes[cpos] !== 0) chName += String.fromCharCode(bytes[cpos++]);
  cpos++;
  const pixelType = view.getInt32(cpos, true);

  // Offset table follows the header.
  const offsetTableStart = pos;
  const pixels = new Float32Array(width * height);
  for (let row = 0; row < height; row++) {
    const lo = view.getUint32(offsetTableStart + row * 8, true);
    const hi = view.getUint32(offsetTableStart + row * 8 + 4, true);
    const chunk = lo + hi * 0x100000000;
    const y = view.getInt32(chunk, true);
    const dataSize = view.getInt32(chunk + 4, true);
    expect(dataSize).toBe(width * 4);
    for (let x = 0; x < width; x++) {
      pixels[y * width + x] = view.getFloat32(chunk + 8 + x * 4, true);
    }
  }

  return {width, height, chName, pixelType, pixels, compression: attrs};
};

describe('encodeHeightmapExr', () => {
  it('produces a valid single-channel FLOAT EXR that round-trips exactly', () => {
    const width = 5;
    const height = 3;
    const heights = new Float32Array(width * height);
    for (let i = 0; i < heights.length; i++)
      heights[i] = i / (heights.length - 1);

    const exr = encodeHeightmapExr(heights, width, height);
    const decoded = decodeExr(exr);

    expect(decoded.width).toBe(width);
    expect(decoded.height).toBe(height);
    expect(decoded.chName).toBe('Y');
    expect(decoded.pixelType).toBe(2); // FLOAT
    // NO_COMPRESSION.
    const comp = decoded.compression.compression;
    expect(exr[comp.start]).toBe(0);
    expect([...decoded.pixels]).toEqual([...heights]);
  });

  it('preserves values verbatim — no quantization, no clamping', () => {
    // Out-of-0..1 headroom and sub-16-bit deltas must survive untouched.
    const width = 3;
    const height = 1;
    const heights = new Float32Array([-0.25, 1.75, 0.123456789]);
    const decoded = decodeExr(encodeHeightmapExr(heights, width, height));
    expect(decoded.pixels[0]).toBe(Math.fround(-0.25));
    expect(decoded.pixels[1]).toBe(Math.fround(1.75));
    expect(decoded.pixels[2]).toBe(Math.fround(0.123456789));
  });

  it('places each scanline at the offset the table advertises (row order intact)', () => {
    // A per-row-constant ramp: if any scanline is misplaced, a row's values move.
    const width = 4;
    const height = 6;
    const heights = new Float32Array(width * height);
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) heights[y * width + x] = y + x / 10;

    const decoded = decodeExr(encodeHeightmapExr(heights, width, height));
    expect([...decoded.pixels]).toEqual([...heights]);
  });
});
