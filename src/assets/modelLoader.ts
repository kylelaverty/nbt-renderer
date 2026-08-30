import type { AssetStore } from './assetStore';
import type { ModelElementJson, ModelJson } from './modelTypes';
import { modelPath } from './resourceId';

export interface ResolvedModel {
  textures: Record<string, string>; // var name -> var name or concrete "ns:path"
  elements: ModelElementJson[];
}

const modelCache = new Map<string, ResolvedModel | undefined>();

/** Loads a model JSON and walks its `parent` chain, merging textures (child overrides parent) and taking the most specific elements. */
export function loadResolvedModel(store: AssetStore, ref: string): ResolvedModel | undefined {
  const cacheKey = ref;
  if (modelCache.has(cacheKey)) return modelCache.get(cacheKey);

  const chain: ModelJson[] = [];
  let current: string | undefined = ref;
  const seen = new Set<string>();
  while (current && !seen.has(current)) {
    seen.add(current);
    const json: ModelJson | undefined = store.readJson<ModelJson>(modelPath(current));
    if (!json) break;
    chain.push(json);
    current = json.parent;
  }

  if (chain.length === 0) {
    modelCache.set(cacheKey, undefined);
    return undefined;
  }

  // chain[0] is most specific (leaf), last is the root ancestor.
  const textures: Record<string, string> = {};
  for (let i = chain.length - 1; i >= 0; i--) {
    Object.assign(textures, chain[i].textures ?? {});
  }

  let elements: ModelElementJson[] | undefined;
  for (const m of chain) {
    if (m.elements) {
      elements = m.elements;
      break;
    }
  }

  const resolved: ResolvedModel = { textures, elements: elements ?? [] };
  modelCache.set(cacheKey, resolved);
  return resolved;
}

/** Follows a possibly-chained texture variable ("#side" -> "#all" -> "minecraft:block/stone") to a concrete resource id. */
export function resolveTextureVar(textures: Record<string, string>, ref: string, depth = 0): string | undefined {
  if (depth > 10) return undefined;
  if (!ref.startsWith('#')) return ref;
  const varName = ref.slice(1);
  const next = textures[varName];
  if (!next) return undefined;
  return resolveTextureVar(textures, next, depth + 1);
}

export function clearModelCache(): void {
  modelCache.clear();
}
