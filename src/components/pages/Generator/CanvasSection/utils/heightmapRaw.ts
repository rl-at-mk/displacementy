/**
 * Whether this host stores multi-byte numbers little-endian. Computed once: write
 * `1` as a 32-bit int, then read its first byte — `1` means little-endian.
 */
const HOST_LITTLE_ENDIAN =
  new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;

/**
 * Encode a float height buffer as a **raw little-endian Float32 dump** (`.r32`):
 * every value written verbatim, no quantization and no clamping. This is the
 * lossless 32-bit-float export — the buffer is already `Float32`, so the file is
 * a byte-for-byte copy of the height data (including any out-of-`0..1` headroom),
 * ingested directly by Unity / Unreal / World Machine as a 32-bit raw heightfield.
 */
export const encodeHeightmapRaw32 = (heights: Float32Array): Uint8Array => {
  if (HOST_LITTLE_ENDIAN) {
    // Host floats are already little-endian — copy the raw bytes directly.
    return new Uint8Array(
      heights.buffer.slice(
        heights.byteOffset,
        heights.byteOffset + heights.byteLength,
      ),
    );
  }

  // Big-endian host (rare): byteswap each float into little-endian.
  const bytes = new Uint8Array(heights.length * 4);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < heights.length; i++) {
    view.setFloat32(i * 4, heights[i], true);
  }
  return bytes;
};
