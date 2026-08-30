// Approximate, biome-independent tint colors (Minecraft normally samples a biome colormap here).
// Good enough for a static build preview where we don't know the target biome.

const FOLIAGE_GREEN: [number, number, number] = [0.42, 0.62, 0.24];
const GRASS_GREEN: [number, number, number] = [0.48, 0.66, 0.31];
const SPRUCE_GREEN: [number, number, number] = [0.38, 0.5, 0.34];
const BIRCH_GREEN: [number, number, number] = [0.5, 0.63, 0.35];
const WATER_BLUE: [number, number, number] = [0.24, 0.44, 0.85];
const REDSTONE_RED: [number, number, number] = [0.8, 0.05, 0.03];

export function getTintColor(blockName: string, tintindex: number | undefined): [number, number, number] | undefined {
  if (tintindex === undefined) return undefined;
  if (blockName === 'minecraft:grass_block' || blockName === 'minecraft:grass' || blockName === 'minecraft:tall_grass' || blockName === 'minecraft:fern' || blockName === 'minecraft:large_fern' || blockName === 'minecraft:vine' || blockName === 'minecraft:sugar_cane') {
    return GRASS_GREEN;
  }
  if (blockName === 'minecraft:spruce_leaves') return SPRUCE_GREEN;
  if (blockName === 'minecraft:birch_leaves') return BIRCH_GREEN;
  if (blockName.endsWith('_leaves')) return FOLIAGE_GREEN;
  if (blockName === 'minecraft:water' || blockName === 'minecraft:water_cauldron') return WATER_BLUE;
  if (blockName === 'minecraft:redstone_wire') return REDSTONE_RED;
  return [1, 1, 1];
}
