import { blockStateToString, type BlockState } from '../schematic/blockstate';
import type { AssetStore } from './assetStore';
import { buildFullCubeQuads, buildQuadsForBlockState } from './geometryBuilder';
import type { ResolvedQuad } from './modelTypes';

export interface ResolvedBlockRender {
  quads: ResolvedQuad[];
  /** false = no model/blockstate could be found at all; render a placeholder box instead. */
  resolved: boolean;
  transparent: boolean;
}

const FLUIDS: Record<string, { texture: string; tintindex?: number }> = {
  'minecraft:water': { texture: 'minecraft:block/water_still', tintindex: 0 },
  'minecraft:lava': { texture: 'minecraft:block/lava_still' },
};

const cache = new Map<string, ResolvedBlockRender>();

export function resolveBlockRender(store: AssetStore, bs: BlockState): ResolvedBlockRender {
  const key = blockStateToString(bs);
  const cached = cache.get(key);
  if (cached) return cached;

  let quads: ResolvedQuad[] | undefined;
  let transparent = false;
  const fluid = FLUIDS[bs.name];
  if (fluid) {
    quads = buildFullCubeQuads(fluid.texture, fluid.tintindex);
    transparent = bs.name === 'minecraft:water';
  } else {
    quads = buildQuadsForBlockState(store, bs);
    transparent = bs.name.includes('glass') || bs.name === 'minecraft:ice';
  }

  const result: ResolvedBlockRender = { quads: quads ?? [], resolved: quads !== undefined, transparent };
  cache.set(key, result);
  return result;
}

export function clearBlockRenderCache(): void {
  cache.clear();
}
