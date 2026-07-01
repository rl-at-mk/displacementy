/**
 * Minimal OpenEXR writer for a single-channel 32-bit-float heightmap.
 *
 * We hand-roll the format (rather than pull in an EXR library) because we only
 * need the simplest possible variant: an **uncompressed, single-part, scanline**
 * image with one **FLOAT** channel (`Y`, the luminance/grayscale convention). The
 * height buffer is already `Float32`, so the values are written verbatim — no
 * quantization, no clamping — preserving out-of-`0..1` headroom. This is the
 * lossless 32-bit-float export, in the container VFX/DCC tools (Blender, Nuke,
 * World Machine) read natively.
 *
 * Format reference: OpenEXR file layout — magic + version, a list of
 * null-terminated attributes, an 8-byte-per-scanline offset table, then one
 * chunk per scanline (`y`, byte count, pixel data).
 */

/** Host endianness, computed once (see heightmap fast path below). */
const HOST_LITTLE_ENDIAN = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;

const textEncoder = new TextEncoder();

/** A null-terminated string as bytes. */
const nullTerminated = (s: string): number[] => [...textEncoder.encode(s), 0];

const int32LE = (n: number): number[] => {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setInt32(0, n, true);
  return [...b];
};

const float32LE = (n: number): number[] => {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setFloat32(0, n, true);
  return [...b];
};

/** One header attribute: `name\0 type\0 size(int32) value`. */
const attribute = (name: string, type: string, value: number[]): number[] => [
  ...nullTerminated(name),
  ...nullTerminated(type),
  ...int32LE(value.length),
  ...value,
];

/**
 * Encode a float height buffer as an **uncompressed single-channel FLOAT EXR**.
 * Returns the file bytes.
 */
export const encodeHeightmapExr = (
  heights: Float32Array,
  width: number,
  height: number,
): Uint8Array => {
  const FLOAT = 2; // OpenEXR pixel type: 0=UINT, 1=HALF, 2=FLOAT.

  // Single FLOAT channel named "Y", terminated by a null byte.
  const channelList = [
    ...nullTerminated('Y'),
    ...int32LE(FLOAT),
    0, // pLinear
    0,
    0,
    0, // 3 reserved bytes
    ...int32LE(1), // xSampling
    ...int32LE(1), // ySampling
    0, // channel-list terminator
  ];

  const window = [
    ...int32LE(0),
    ...int32LE(0),
    ...int32LE(width - 1),
    ...int32LE(height - 1),
  ];

  const header = [
    ...attribute('channels', 'chlist', channelList),
    ...attribute('compression', 'compression', [0]), // NO_COMPRESSION
    ...attribute('dataWindow', 'box2i', window),
    ...attribute('displayWindow', 'box2i', window),
    ...attribute('lineOrder', 'lineOrder', [0]), // INCREASING_Y
    ...attribute('pixelAspectRatio', 'float', float32LE(1)),
    ...attribute('screenWindowCenter', 'v2f', [
      ...float32LE(0),
      ...float32LE(0),
    ]),
    ...attribute('screenWindowWidth', 'float', float32LE(1)),
    0, // header terminator (empty attribute name)
  ];

  const rowBytes = width * 4; // one FLOAT channel per pixel
  const chunkBytes = 8 + rowBytes; // 4 (y) + 4 (data size) + pixels
  const headerEnd = 8 + header.length; // 8 = magic + version
  const offsetTableStart = headerEnd;
  const scanlineStart = offsetTableStart + height * 8;
  const total = scanlineStart + height * chunkBytes;

  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);

  // Magic number (20000630) + version 2, no flags.
  out.set([0x76, 0x2f, 0x31, 0x01], 0);
  view.setUint32(4, 2, true);

  // Header.
  out.set(Uint8Array.from(header), 8);

  // Scanline offset table: absolute file offset of each chunk.
  for (let y = 0; y < height; y++) {
    const offset = scanlineStart + y * chunkBytes;
    const pos = offsetTableStart + y * 8;
    view.setUint32(pos, offset >>> 0, true);
    view.setUint32(pos + 4, Math.floor(offset / 0x100000000), true);
  }

  // Scanline chunks.
  for (let y = 0; y < height; y++) {
    const pos = scanlineStart + y * chunkBytes;
    view.setInt32(pos, y, true); // scanline's y coordinate
    view.setInt32(pos + 4, rowBytes, true); // uncompressed byte count
    const pixelsPos = pos + 8;
    const rowStart = y * width;
    if (HOST_LITTLE_ENDIAN) {
      // Float32 bytes are already little-endian — copy the row directly.
      out.set(
        new Uint8Array(
          heights.buffer,
          heights.byteOffset + rowStart * 4,
          rowBytes,
        ),
        pixelsPos,
      );
    } else {
      for (let x = 0; x < width; x++) {
        view.setFloat32(pixelsPos + x * 4, heights[rowStart + x], true);
      }
    }
  }

  return out;
};
