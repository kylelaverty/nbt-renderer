/** Decodes a WorldEdit/Sponge-style LEB128 varint-encoded array of exactly `count` values. */
export function readVarIntArray(data: Int8Array, count: number): Int32Array {
  const out = new Int32Array(count);
  let pos = 0;
  let value = 0;
  let shift = 0;
  let outIdx = 0;
  while (outIdx < count && pos < data.length) {
    const b = data[pos++] & 0xff;
    value |= (b & 0x7f) << shift;
    if ((b & 0x80) === 0) {
      out[outIdx++] = value;
      value = 0;
      shift = 0;
    } else {
      shift += 7;
    }
  }
  return out;
}
