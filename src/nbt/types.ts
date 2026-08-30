export const TagType = {
  End: 0,
  Byte: 1,
  Short: 2,
  Int: 3,
  Long: 4,
  Float: 5,
  Double: 6,
  ByteArray: 7,
  String: 8,
  List: 9,
  Compound: 10,
  IntArray: 11,
  LongArray: 12,
} as const;

export type TagTypeId = (typeof TagType)[keyof typeof TagType];

export type NbtValue =
  | number
  | bigint
  | string
  | Int8Array
  | Int32Array
  | BigInt64Array
  | NbtValue[]
  | NbtCompound;

export interface NbtCompound {
  [key: string]: NbtValue;
}

export interface NbtList extends Array<NbtValue> {
  listType?: TagTypeId;
}

export interface NbtRoot {
  name: string;
  value: NbtCompound;
}
