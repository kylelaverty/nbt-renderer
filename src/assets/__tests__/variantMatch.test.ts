import { describe, expect, it } from 'vitest';
import type { MultipartCaseJson } from '../modelTypes';
import { pickMultipartApplies, pickVariant } from '../variantMatch';

describe('pickVariant', () => {
  it('picks the exact matching variant for a block with properties', () => {
    const variants = {
      'facing=north': { model: 'block/furnace_north' },
      'facing=south': { model: 'block/furnace_south' },
    };
    const entry = pickVariant(variants, { name: 'minecraft:furnace', properties: { facing: 'south', lit: 'false' } });
    expect(entry?.model).toBe('block/furnace_south');
  });

  it('matches the empty-key variant for a block with no properties', () => {
    const variants = { '': { model: 'block/stone' } };
    const entry = pickVariant(variants, { name: 'minecraft:stone', properties: {} });
    expect(entry?.model).toBe('block/stone');
  });

  it('prefers the more specific (higher match count) variant key', () => {
    const variants = {
      'half=bottom': { model: 'block/less_specific' },
      'half=bottom,facing=east': { model: 'block/more_specific' },
    };
    const entry = pickVariant(variants, { name: 'minecraft:oak_stairs', properties: { half: 'bottom', facing: 'east', shape: 'straight' } });
    expect(entry?.model).toBe('block/more_specific');
  });
});

describe('pickMultipartApplies', () => {
  it('collects every case whose "when" clause matches, ORing pipe-separated values', () => {
    const cases: MultipartCaseJson[] = [
      { apply: { model: 'block/fence_post' } },
      { when: { north: 'true' }, apply: { model: 'block/fence_side_north' } },
      { when: { south: 'true|low' }, apply: { model: 'block/fence_side_south' } },
      { when: { east: 'true' }, apply: { model: 'block/fence_side_east' } },
    ];
    const applies = pickMultipartApplies(cases, {
      name: 'minecraft:oak_fence',
      properties: { north: 'true', south: 'low', east: 'false' },
    });
    expect(applies.map((a) => a.model)).toEqual(['block/fence_post', 'block/fence_side_north', 'block/fence_side_south']);
  });

  it('supports AND/OR clause wrappers', () => {
    const cases: MultipartCaseJson[] = [
      {
        when: { OR: [{ AND: [{ a: '1' }, { b: '2' }] }, { c: '3' }] },
        apply: { model: 'block/matched' },
      },
    ];
    expect(pickMultipartApplies(cases, { name: 'x', properties: { a: '1', b: '2', c: '0' } })).toHaveLength(1);
    expect(pickMultipartApplies(cases, { name: 'x', properties: { a: '1', b: '0', c: '3' } })).toHaveLength(1);
    expect(pickMultipartApplies(cases, { name: 'x', properties: { a: '1', b: '0', c: '0' } })).toHaveLength(0);
  });
});
