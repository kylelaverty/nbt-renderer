import { gzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { buildNbt, byteArr, compound, int, list, longArr, short, str, T } from '../../test-utils/nbtBuilder';
import { parseSchematicFile } from '../index';

function namesAt(parsed: ReturnType<typeof parseSchematicFile>, indices: number[]): string[] {
  return indices.map((i) => parsed.palette[parsed.blocks[i]].name);
}

describe('parseSchematicFile', () => {
  it('parses a Sponge Schematic (.schem) v2 file', () => {
    const root = compound({
      Version: int(2),
      DataVersion: int(3465),
      Width: short(2),
      Height: short(1),
      Length: short(1),
      Palette: compound({ 'minecraft:stone': int(0) }),
      BlockData: byteArr([0, 0]),
    });
    const gz = gzipSync(buildNbt('Schematic', root.v));
    const parsed = parseSchematicFile(gz, 'test.schem');

    expect(parsed.format).toBe('sponge');
    expect(parsed.size).toEqual([2, 1, 1]);
    expect(namesAt(parsed, [0, 1])).toEqual(['minecraft:stone', 'minecraft:stone']);
  });

  it('parses a Litematica (.litematic) file, unpacking the bit-packed block state array', () => {
    // palette: 0=air, 1=stone; bitsPerEntry = max(2, ceil(log2(2))) = 2.
    // entries [1, 1] -> long value = 1 | (1<<2) = 5
    const root = compound({
      MinecraftDataVersion: int(3465),
      Regions: compound({
        Main: compound({
          Position: compound({ x: int(0), y: int(0), z: int(0) }),
          Size: compound({ x: int(2), y: int(1), z: int(1) }),
          BlockStatePalette: list(T.Compound, [compound({ Name: str('minecraft:air') }), compound({ Name: str('minecraft:stone') })]),
          BlockStates: longArr([5n]),
        }),
      }),
    });
    const gz = gzipSync(buildNbt('', root.v));
    const parsed = parseSchematicFile(gz, 'test.litematic');

    expect(parsed.format).toBe('litematica');
    expect(parsed.size).toEqual([2, 1, 1]);
    expect(parsed.palette).toHaveLength(2); // air + stone, deduped across the seed + region palette
    expect(namesAt(parsed, [0, 1])).toEqual(['minecraft:stone', 'minecraft:stone']);
  });

  it('parses a Litematica file with a non-trivial bit-packing (3 blocks: stone, air, stone)', () => {
    // entries [1, 0, 1] packed 2 bits each -> 1 | (0<<2) | (1<<4) = 17
    const root = compound({
      Regions: compound({
        Main: compound({
          Position: compound({ x: int(0), y: int(0), z: int(0) }),
          Size: compound({ x: int(3), y: int(1), z: int(1) }),
          BlockStatePalette: list(T.Compound, [compound({ Name: str('minecraft:air') }), compound({ Name: str('minecraft:stone') })]),
          BlockStates: longArr([17n]),
        }),
      }),
    });
    const gz = gzipSync(buildNbt('', root.v));
    const parsed = parseSchematicFile(gz, 'test.litematic');

    expect(parsed.size).toEqual([3, 1, 1]);
    expect(namesAt(parsed, [0, 1, 2])).toEqual(['minecraft:stone', 'minecraft:air', 'minecraft:stone']);
  });

  it('parses a classic MCEdit-style .schematic file using the legacy numeric ID table', () => {
    const root = compound({
      Width: short(2),
      Height: short(1),
      Length: short(1),
      Blocks: byteArr([1, 1]), // id 1 = stone
      Data: byteArr([0, 0]),
    });
    const gz = gzipSync(buildNbt('Schematic', root.v));
    const parsed = parseSchematicFile(gz, 'test.schematic');

    expect(parsed.format).toBe('mcedit');
    expect(parsed.size).toEqual([2, 1, 1]);
    expect(namesAt(parsed, [0, 1])).toEqual(['minecraft:stone', 'minecraft:stone']);
    expect(parsed.warnings).toEqual([]);
  });

  it('reports unrecognized legacy block IDs as a warning instead of throwing', () => {
    const root = compound({
      Width: short(1),
      Height: short(1),
      Length: short(1),
      Blocks: byteArr([250]), // not in LEGACY_BLOCKS
      Data: byteArr([0]),
    });
    const gz = gzipSync(buildNbt('Schematic', root.v));
    const parsed = parseSchematicFile(gz, 'test.schematic');

    expect(parsed.warnings.length).toBe(1);
    expect(parsed.palette[parsed.blocks[0]].name).toBe('minecraft:unknown_legacy_250');
  });

  it('parses a vanilla structure block export (.nbt), reading size/pos as TAG_List<Int> not TAG_Int_Array', () => {
    const root = compound({
      size: list(T.Int, [int(2), int(1), int(1)]),
      palette: list(T.Compound, [compound({ Name: str('minecraft:air') }), compound({ Name: str('minecraft:stone') })]),
      blocks: list(T.Compound, [
        compound({ pos: list(T.Int, [int(0), int(0), int(0)]), state: int(1) }),
        compound({ pos: list(T.Int, [int(1), int(0), int(0)]), state: int(1) }),
      ]),
      DataVersion: int(3465),
    });
    const gz = gzipSync(buildNbt('', root.v));
    const parsed = parseSchematicFile(gz, 'test.nbt');

    expect(parsed.format).toBe('structure');
    expect(parsed.size).toEqual([2, 1, 1]);
    expect(namesAt(parsed, [0, 1])).toEqual(['minecraft:stone', 'minecraft:stone']);
  });
});
