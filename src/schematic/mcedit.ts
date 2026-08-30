import { getByteArray, getNumber, type NbtRoot } from '../nbt/reader';
import type { BlockState } from './blockstate';
import { legacyIdToName } from './legacyIds';
import type { ParsedSchematic } from './types';

/** Parses a classic MCEdit-style .schematic file (numeric block IDs + data values, pre-1.13). */
export function parseMcEditSchematic(root: NbtRoot): ParsedSchematic {
  const warnings: string[] = [];
  const value = root.value;
  const width = getNumber(value, 'Width');
  const height = getNumber(value, 'Height');
  const length = getNumber(value, 'Length');
  if (width === undefined || height === undefined || length === undefined) {
    throw new Error('.schematic file is missing Width/Height/Length');
  }
  const blockIds = getByteArray(value, 'Blocks');
  const blockData = getByteArray(value, 'Data');
  const addBlocks = getByteArray(value, 'AddBlocks'); // extended IDs, rarely used
  if (!blockIds) throw new Error('.schematic file is missing Blocks');

  const count = width * height * length;
  const palette: BlockState[] = [{ name: 'minecraft:air', properties: {} }];
  const paletteIndex = new Map<string, number>();
  paletteIndex.set('minecraft:air', 0);
  const blocks = new Int32Array(count).fill(0);
  const unknownIds = new Set<number>();

  // MCEdit legacy ordering is Y,Z,X: index = (y*length + z)*width + x -- same formula we use.
  for (let i = 0; i < count; i++) {
    let id = blockIds[i] & 0xff;
    if (addBlocks) {
      const nibble = addBlocks[i >> 1] ?? 0;
      const high = i % 2 === 0 ? nibble & 0x0f : (nibble >> 4) & 0x0f;
      id |= high << 8;
    }
    if (id === 0) continue;
    const data = blockData ? blockData[i] & 0xff : 0;
    const { name, known } = legacyIdToName(id, data);
    if (!known) unknownIds.add(id);
    const key = name;
    let idx = paletteIndex.get(key);
    if (idx === undefined) {
      idx = palette.length;
      palette.push({ name, properties: {} });
      paletteIndex.set(key, idx);
    }
    // `i` is already laid out y,z,x contiguous which matches our indexXYZ formula exactly
    // (x fastest, then z, then y), so we can write directly.
    blocks[i] = idx;
  }

  if (unknownIds.size > 0) {
    warnings.push(`${unknownIds.size} unrecognized legacy block ID(s): ${[...unknownIds].sort((a, b) => a - b).join(', ')}`);
  }

  return {
    size: [width, height, length],
    palette,
    blocks,
    airIndex: 0,
    format: 'mcedit',
    warnings,
  };
}
