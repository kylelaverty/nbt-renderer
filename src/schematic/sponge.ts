import { getByteArray, getCompound, getNumber, type NbtRoot } from '../nbt/reader';
import { isAirState, parseBlockStateString, type BlockState } from './blockstate';
import type { ParsedSchematic } from './types';
import { readVarIntArray } from './varint';

/** Parses a Sponge Schematic Format file (.schem), versions 1-3. */
export function parseSpongeSchematic(root: NbtRoot): ParsedSchematic {
  const warnings: string[] = [];
  let value = root.value;
  const wrapped = getCompound(value, 'Schematic');
  if (wrapped) value = wrapped;

  const version = getNumber(value, 'Version') ?? 2;
  const dataVersion = getNumber(value, 'DataVersion');

  const width = getNumber(value, 'Width');
  const height = getNumber(value, 'Height');
  const length = getNumber(value, 'Length');
  if (width === undefined || height === undefined || length === undefined) {
    throw new Error('Sponge schematic is missing Width/Height/Length');
  }

  let paletteCompound = version >= 3 ? getCompound(getCompound(value, 'Blocks') ?? {}, 'Palette') : undefined;
  let blockData = version >= 3 ? getByteArray(getCompound(value, 'Blocks') ?? {}, 'Data') : undefined;
  if (!paletteCompound) paletteCompound = getCompound(value, 'Palette');
  if (!blockData) blockData = getByteArray(value, 'BlockData');

  if (!paletteCompound || !blockData) {
    throw new Error('Sponge schematic is missing Palette/BlockData');
  }

  let maxId = -1;
  for (const idVal of Object.values(paletteCompound)) {
    const id = typeof idVal === 'number' ? idVal : Number(idVal as bigint);
    if (id > maxId) maxId = id;
  }
  const palette: BlockState[] = new Array(maxId + 1);
  for (const [key, idVal] of Object.entries(paletteCompound)) {
    const id = typeof idVal === 'number' ? idVal : Number(idVal as bigint);
    palette[id] = parseBlockStateString(key);
  }
  for (let i = 0; i < palette.length; i++) {
    if (!palette[i]) palette[i] = { name: 'minecraft:air', properties: {} };
  }

  const count = width * height * length;
  const blocks = readVarIntArray(blockData, count);

  let airIndex = palette.findIndex((bs) => isAirState(bs));

  return {
    size: [width, height, length],
    palette,
    blocks,
    airIndex,
    format: 'sponge',
    sourceDataVersion: dataVersion,
    warnings,
  };
}
