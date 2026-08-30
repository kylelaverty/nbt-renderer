import { gunzipSync, unzlibSync } from 'fflate';
import { TagType, type NbtCompound, type NbtList, type NbtRoot, type NbtValue, type TagTypeId } from './types';

export type { NbtCompound, NbtList, NbtRoot, NbtValue } from './types';

/** Decompresses an NBT file's raw bytes if needed (gzip or zlib), else returns as-is. */
export function decompressNbt(bytes: Uint8Array): Uint8Array {
  if (bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) {
    return gunzipSync(bytes);
  }
  if (bytes.length >= 2 && bytes[0] === 0x78 && (bytes[1] === 0x01 || bytes[1] === 0x9c || bytes[1] === 0xda)) {
    return unzlibSync(bytes);
  }
  return bytes;
}

class ByteCursor {
  view: DataView;
  offset = 0;
  constructor(bytes: Uint8Array) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }
  byte(): number {
    const v = this.view.getUint8(this.offset);
    this.offset += 1;
    return v;
  }
  i8(): number {
    const v = this.view.getInt8(this.offset);
    this.offset += 1;
    return v;
  }
  i16(): number {
    const v = this.view.getInt16(this.offset, false);
    this.offset += 2;
    return v;
  }
  u16(): number {
    const v = this.view.getUint16(this.offset, false);
    this.offset += 2;
    return v;
  }
  i32(): number {
    const v = this.view.getInt32(this.offset, false);
    this.offset += 4;
    return v;
  }
  i64(): bigint {
    const v = this.view.getBigInt64(this.offset, false);
    this.offset += 8;
    return v;
  }
  f32(): number {
    const v = this.view.getFloat32(this.offset, false);
    this.offset += 4;
    return v;
  }
  f64(): number {
    const v = this.view.getFloat64(this.offset, false);
    this.offset += 8;
    return v;
  }
  bytes(n: number): Uint8Array {
    const v = new Uint8Array(this.view.buffer, this.view.byteOffset + this.offset, n);
    this.offset += n;
    return v;
  }
  utf8(n: number): string {
    const b = this.bytes(n);
    return new TextDecoder('utf-8').decode(b);
  }
  string(): string {
    const len = this.u16();
    return this.utf8(len);
  }
}

function readPayload(c: ByteCursor, type: TagTypeId): NbtValue {
  switch (type) {
    case TagType.Byte:
      return c.i8();
    case TagType.Short:
      return c.i16();
    case TagType.Int:
      return c.i32();
    case TagType.Long:
      return c.i64();
    case TagType.Float:
      return c.f32();
    case TagType.Double:
      return c.f64();
    case TagType.ByteArray: {
      const len = c.i32();
      const out = new Int8Array(len);
      for (let i = 0; i < len; i++) out[i] = c.i8();
      return out;
    }
    case TagType.String:
      return c.string();
    case TagType.List: {
      const itemType = c.byte() as TagTypeId;
      const len = c.i32();
      const list: NbtList = [];
      list.listType = itemType;
      for (let i = 0; i < len; i++) {
        list.push(readPayload(c, itemType));
      }
      return list;
    }
    case TagType.Compound: {
      const compound: NbtCompound = {};
      for (;;) {
        const tagType = c.byte() as TagTypeId;
        if (tagType === TagType.End) break;
        const name = c.string();
        compound[name] = readPayload(c, tagType);
      }
      return compound;
    }
    case TagType.IntArray: {
      const len = c.i32();
      const out = new Int32Array(len);
      for (let i = 0; i < len; i++) out[i] = c.i32();
      return out;
    }
    case TagType.LongArray: {
      const len = c.i32();
      const out = new BigInt64Array(len);
      for (let i = 0; i < len; i++) out[i] = c.i64();
      return out;
    }
    default:
      throw new Error(`Unsupported NBT tag type: ${type}`);
  }
}

/** Parses a full NBT document (already decompressed) starting at a root compound tag. */
export function parseNbt(bytes: Uint8Array): NbtRoot {
  const c = new ByteCursor(bytes);
  const rootType = c.byte() as TagTypeId;
  if (rootType !== TagType.Compound) {
    throw new Error(`Expected root TAG_Compound, got tag type ${rootType}`);
  }
  const name = c.string();
  const value = readPayload(c, TagType.Compound) as NbtCompound;
  return { name, value };
}

export function loadNbt(bytes: Uint8Array): NbtRoot {
  return parseNbt(decompressNbt(bytes));
}

// --- small helpers for reading compounds without a ton of `as` casts everywhere ---

export function getCompound(obj: NbtCompound, key: string): NbtCompound | undefined {
  const v = obj[key];
  return v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Int8Array) ? (v as NbtCompound) : undefined;
}

export function getList(obj: NbtCompound, key: string): NbtList | undefined {
  const v = obj[key];
  return Array.isArray(v) ? (v as NbtList) : undefined;
}

export function getString(obj: NbtCompound, key: string): string | undefined {
  const v = obj[key];
  return typeof v === 'string' ? v : undefined;
}

export function getNumber(obj: NbtCompound, key: string): number | undefined {
  const v = obj[key];
  if (typeof v === 'number') return v;
  if (typeof v === 'bigint') return Number(v);
  return undefined;
}

export function getByteArray(obj: NbtCompound, key: string): Int8Array | undefined {
  const v = obj[key];
  return v instanceof Int8Array ? v : undefined;
}

export function getIntArray(obj: NbtCompound, key: string): Int32Array | undefined {
  const v = obj[key];
  return v instanceof Int32Array ? v : undefined;
}

export function getLongArray(obj: NbtCompound, key: string): BigInt64Array | undefined {
  const v = obj[key];
  return v instanceof BigInt64Array ? v : undefined;
}
