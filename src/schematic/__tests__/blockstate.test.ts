import { describe, expect, it } from 'vitest';
import { blockStateToString, isAirState, normalizeName, parseBlockStateString } from '../blockstate';

describe('blockstate string <-> BlockState', () => {
  it('round-trips a state with no properties', () => {
    const s = 'minecraft:stone';
    expect(blockStateToString(parseBlockStateString(s))).toBe(s);
  });

  it('round-trips a state with properties, sorting keys alphabetically', () => {
    const parsed = parseBlockStateString('minecraft:oak_stairs[half=bottom,facing=north,shape=straight]');
    expect(parsed.name).toBe('minecraft:oak_stairs');
    expect(parsed.properties).toEqual({ half: 'bottom', facing: 'north', shape: 'straight' });
    expect(blockStateToString(parsed)).toBe('minecraft:oak_stairs[facing=north,half=bottom,shape=straight]');
  });

  it('defaults an unqualified name to the minecraft namespace', () => {
    expect(normalizeName('stone')).toBe('minecraft:stone');
    expect(normalizeName('modid:custom_block')).toBe('modid:custom_block');
  });

  it('recognizes air variants', () => {
    expect(isAirState(parseBlockStateString('minecraft:air'))).toBe(true);
    expect(isAirState(parseBlockStateString('minecraft:cave_air'))).toBe(true);
    expect(isAirState(parseBlockStateString('minecraft:stone'))).toBe(false);
  });
});
