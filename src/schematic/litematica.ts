import {
  getCompound,
  getList,
  getLongArray,
  getNumber,
  getString,
  type NbtCompound,
  type NbtRoot,
} from '../nbt/reader';
import { isAirState, type BlockState } from './blockstate';
import { indexXYZ, type ParsedSchematic } from './types';

function bitArrayGet(longs: BigInt64Array, bitsPerEntry: number, index: number): number {
  const bits = BigInt(bitsPerEntry);
  const startOffset = BigInt(index) * bits;
  const startArrIndex = Number(startOffset >> 6n);
  const endArrIndex = Number(((BigInt(index) + 1n) * bits - 1n) >> 6n);
  const startBitOffset = Number(startOffset & 63n);
  const maxEntryValue = (1n << bits) - 1n;
  const a = BigInt.asUintN(64, longs[startArrIndex]);
  let value: bigint;
  if (startArrIndex === endArrIndex) {
    value = (a >> BigInt(startBitOffset)) & maxEntryValue;
  } else {
    const b = BigInt.asUintN(64, longs[endArrIndex]);
    const endOffset = 64 - startBitOffset;
    value = ((a >> BigInt(startBitOffset)) | (b << BigInt(endOffset))) & maxEntryValue;
  }
  return Number(value);
}

interface RegionBox {
  minX: number;
  minY: number;
  minZ: number;
  sizeX: number;
  sizeY: number;
  sizeZ: number;
  palette: BlockState[];
  blockStates: BigInt64Array;
  bitsPerEntry: number;
}

/** Parses a Litematica (.litematic) file, merging all regions into one bounding-box grid. */
export function parseLitematica(root: NbtRoot): ParsedSchematic {
  const warnings: string[] = [];
  const value = root.value;
  const dataVersion = getNumber(value, 'MinecraftDataVersion');
  const regionsCompound = getCompound(value, 'Regions');
  if (!regionsCompound) throw new Error('Litematica file is missing Regions');

  const regions: RegionBox[] = [];
  for (const [regionName, regionVal] of Object.entries(regionsCompound)) {
    const region = regionVal as NbtCompound;
    const pos = getCompound(region, 'Position');
    const size = getCompound(region, 'Size');
    if (!pos || !size) {
      warnings.push(`Region "${regionName}" is missing Position/Size, skipped`);
      continue;
    }
    const px = getNumber(pos, 'x') ?? 0;
    const py = getNumber(pos, 'y') ?? 0;
    const pz = getNumber(pos, 'z') ?? 0;
    const sx = getNumber(size, 'x') ?? 0;
    const sy = getNumber(size, 'y') ?? 0;
    const sz = getNumber(size, 'z') ?? 0;

    const absX = Math.abs(sx);
    const absY = Math.abs(sy);
    const absZ = Math.abs(sz);
    // Litematica allows negative sizes meaning the region extends backwards from Position.
    const minX = sx < 0 ? px + sx + 1 : px;
    const minY = sy < 0 ? py + sy + 1 : py;
    const minZ = sz < 0 ? pz + sz + 1 : pz;

    const paletteList = getList(region, 'BlockStatePalette');
    const palette: BlockState[] = (paletteList ?? []).map((entry) => {
      const c = entry as NbtCompound;
      const name = getString(c, 'Name') ?? 'minecraft:air';
      const propsCompound = getCompound(c, 'Properties');
      const properties: Record<string, string> = {};
      if (propsCompound) {
        for (const [k, v] of Object.entries(propsCompound)) {
          properties[k] = String(v);
        }
      }
      return { name, properties };
    });

    const blockStates = getLongArray(region, 'BlockStates');
    if (!blockStates) {
      warnings.push(`Region "${regionName}" is missing BlockStates, skipped`);
      continue;
    }
    const bitsPerEntry = Math.max(2, Math.ceil(Math.log2(Math.max(2, palette.length))));

    regions.push({ minX, minY, minZ, sizeX: absX, sizeY: absY, sizeZ: absZ, palette, blockStates, bitsPerEntry });
  }

  if (regions.length === 0) throw new Error('Litematica file has no usable regions');

  let boundMinX = Infinity;
  let boundMinY = Infinity;
  let boundMinZ = Infinity;
  let boundMaxX = -Infinity;
  let boundMaxY = -Infinity;
  let boundMaxZ = -Infinity;
  for (const r of regions) {
    boundMinX = Math.min(boundMinX, r.minX);
    boundMinY = Math.min(boundMinY, r.minY);
    boundMinZ = Math.min(boundMinZ, r.minZ);
    boundMaxX = Math.max(boundMaxX, r.minX + r.sizeX);
    boundMaxY = Math.max(boundMaxY, r.minY + r.sizeY);
    boundMaxZ = Math.max(boundMaxZ, r.minZ + r.sizeZ);
  }
  const size: [number, number, number] = [boundMaxX - boundMinX, boundMaxY - boundMinY, boundMaxZ - boundMinZ];

  // Global palette dedupe across regions, keyed by blockstate string.
  const paletteKey = (bs: BlockState) => bs.name + JSON.stringify(bs.properties);
  const globalPalette: BlockState[] = [{ name: 'minecraft:air', properties: {} }];
  const globalPaletteIndex = new Map<string, number>();
  globalPaletteIndex.set(paletteKey(globalPalette[0]), 0);
  const blocks = new Int32Array(size[0] * size[1] * size[2]).fill(0);

  for (const r of regions) {
    const localToGlobal = r.palette.map((bs) => {
      const key = paletteKey(bs);
      let idx = globalPaletteIndex.get(key);
      if (idx === undefined) {
        idx = globalPalette.length;
        globalPalette.push(bs);
        globalPaletteIndex.set(key, idx);
      }
      return idx;
    });

    const count = r.sizeX * r.sizeY * r.sizeZ;
    const offX = r.minX - boundMinX;
    const offY = r.minY - boundMinY;
    const offZ = r.minZ - boundMinZ;
    for (let i = 0; i < count; i++) {
      const localPaletteIdx = bitArrayGet(r.blockStates, r.bitsPerEntry, i);
      if (localPaletteIdx <= 0 || localPaletteIdx >= r.palette.length) continue; // 0 is air
      const y = Math.floor(i / (r.sizeZ * r.sizeX));
      const rem = i % (r.sizeZ * r.sizeX);
      const z = Math.floor(rem / r.sizeX);
      const x = rem % r.sizeX;
      const gIdx = indexXYZ(size, x + offX, y + offY, z + offZ);
      blocks[gIdx] = localToGlobal[localPaletteIdx];
    }
  }

  const airIndex = globalPalette.findIndex((bs) => isAirState(bs));

  return {
    size,
    palette: globalPalette,
    blocks,
    airIndex,
    format: 'litematica',
    sourceDataVersion: dataVersion,
    name: getString(getCompound(value, 'Metadata') ?? {}, 'Name'),
    warnings,
  };
}
