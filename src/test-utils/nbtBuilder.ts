// Minimal generic NBT writer used only to build binary fixtures for tests.
// (There's no need for this outside of tests - the app only ever reads NBT.)

export const T = {
  Byte: 1,
  Short: 2,
  Int: 3,
  Long: 4,
  ByteArray: 7,
  String: 8,
  List: 9,
  Compound: 10,
  LongArray: 12,
} as const;

export type Tag =
  | { t: 1; v: number }
  | { t: 2; v: number }
  | { t: 3; v: number }
  | { t: 4; v: bigint }
  | { t: 7; v: number[] }
  | { t: 8; v: string }
  | { t: 9; itemType: number; v: Tag[] }
  | { t: 10; v: Record<string, Tag> }
  | { t: 12; v: bigint[] };

class ByteSink {
  bytes: number[] = [];
  u8(v: number) {
    this.bytes.push(v & 0xff);
  }
  i16(v: number) {
    this.u8((v >> 8) & 0xff);
    this.u8(v & 0xff);
  }
  i32(v: number) {
    this.u8((v >>> 24) & 0xff);
    this.u8((v >>> 16) & 0xff);
    this.u8((v >>> 8) & 0xff);
    this.u8(v & 0xff);
  }
  i64(v: bigint) {
    const u = BigInt.asUintN(64, v);
    for (let i = 7; i >= 0; i--) this.u8(Number((u >> BigInt(i * 8)) & 0xffn));
  }
  str(s: string) {
    const bytes = new TextEncoder().encode(s);
    this.i16(bytes.length);
    for (const b of bytes) this.u8(b);
  }
}

function writePayload(buf: ByteSink, tag: Tag) {
  switch (tag.t) {
    case T.Byte:
      buf.u8(tag.v);
      break;
    case T.Short:
      buf.i16(tag.v);
      break;
    case T.Int:
      buf.i32(tag.v);
      break;
    case T.Long:
      buf.i64(tag.v);
      break;
    case T.ByteArray:
      buf.i32(tag.v.length);
      for (const b of tag.v) buf.u8(b);
      break;
    case T.String:
      buf.str(tag.v);
      break;
    case T.List:
      buf.u8(tag.itemType);
      buf.i32(tag.v.length);
      for (const item of tag.v) writePayload(buf, item);
      break;
    case T.Compound:
      for (const [name, child] of Object.entries(tag.v)) {
        buf.u8(child.t);
        buf.str(name);
        writePayload(buf, child);
      }
      buf.u8(0); // TAG_End
      break;
    case T.LongArray:
      buf.i32(tag.v.length);
      for (const n of tag.v) buf.i64(n);
      break;
  }
}

export function buildNbt(rootName: string, root: Record<string, Tag>): Uint8Array {
  const buf = new ByteSink();
  buf.u8(T.Compound);
  buf.str(rootName);
  writePayload(buf, { t: T.Compound, v: root });
  return new Uint8Array(buf.bytes);
}

export const compound = (v: Record<string, Tag>): { t: typeof T.Compound; v: Record<string, Tag> } => ({ t: T.Compound, v });
export const list = (itemType: number, v: Tag[]): { t: typeof T.List; itemType: number; v: Tag[] } => ({ t: T.List, itemType, v });
export const int = (v: number): Tag => ({ t: T.Int, v });
export const short = (v: number): Tag => ({ t: T.Short, v });
export const str = (v: string): Tag => ({ t: T.String, v });
export const byteArr = (v: number[]): Tag => ({ t: T.ByteArray, v });
export const longArr = (v: bigint[]): Tag => ({ t: T.LongArray, v });
