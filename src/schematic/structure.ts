import { getCompound, getList, getNumber, getString, type NbtCompound, type NbtRoot } from '../nbt/reader';
import { isAirState, type BlockState } from './blockstate';
import { indexXYZ, type ParsedSchematic } from './types';

/** "size" and each block's "pos" are stored as a TAG_List of 3 TAG_Int, not a TAG_Int_Array. */
function getIntList3(obj: NbtCompound, key: string): [number, number, number] | undefined {
  const list = getList(obj, key);
  if (!list || list.length !== 3) return undefined;
  const nums = list.map((v) => (typeof v === 'number' ? v : typeof v === 'bigint' ? Number(v) : undefined));
  if (nums.some((n) => n === undefined)) return undefined;
  return nums as [number, number, number];
}

/** Parses a vanilla /structure block export (.nbt). */
export function parseStructureNbt(root: NbtRoot): ParsedSchematic {
  const warnings: string[] = [];
  const value = root.value;
  const size = getIntList3(value, 'size');
  if (!size) throw new Error('Structure NBT is missing a valid "size" tag');

  const paletteList = getList(value, 'palette') ?? getList(value, 'palettes')?.[0];
  if (!paletteList) throw new Error('Structure NBT is missing "palette"');
  const palette: BlockState[] = (paletteList as unknown as NbtCompound[]).map((entry) => {
    const c = entry as unknown as NbtCompound;
    const name = getString(c, 'Name') ?? 'minecraft:air';
    const propsCompound = getCompound(c, 'Properties');
    const properties: Record<string, string> = {};
    if (propsCompound) {
      for (const [k, v] of Object.entries(propsCompound)) properties[k] = String(v);
    }
    return { name, properties };
  });

  const blocksList = getList(value, 'blocks');
  if (!blocksList) throw new Error('Structure NBT is missing "blocks"');

  const blocks = new Int32Array(size[0] * size[1] * size[2]).fill(0);
  const airIndex = palette.findIndex((bs) => isAirState(bs));

  for (const entry of blocksList as unknown as NbtCompound[]) {
    const c = entry as unknown as NbtCompound;
    const state = getNumber(c, 'state');
    const pos = getIntList3(c, 'pos');
    if (state === undefined || !pos) continue;
    const idx = indexXYZ(size, pos[0], pos[1], pos[2]);
    blocks[idx] = state;
  }

  return {
    size,
    palette,
    blocks,
    airIndex: airIndex >= 0 ? airIndex : -1,
    format: 'structure',
    warnings,
  };
}
