export interface BlockState {
  name: string; // e.g. "minecraft:oak_stairs"
  properties: Record<string, string>;
}

export function blockStateToString(bs: BlockState): string {
  const keys = Object.keys(bs.properties);
  if (keys.length === 0) return bs.name;
  keys.sort();
  return `${bs.name}[${keys.map((k) => `${k}=${bs.properties[k]}`).join(',')}]`;
}

export function parseBlockStateString(s: string): BlockState {
  const bracket = s.indexOf('[');
  if (bracket === -1) return { name: normalizeName(s), properties: {} };
  const name = normalizeName(s.slice(0, bracket));
  const propsStr = s.slice(bracket + 1, s.lastIndexOf(']'));
  const properties: Record<string, string> = {};
  if (propsStr.trim().length > 0) {
    for (const pair of propsStr.split(',')) {
      const [k, v] = pair.split('=');
      if (k && v !== undefined) properties[k.trim()] = v.trim();
    }
  }
  return { name, properties };
}

export function normalizeName(name: string): string {
  return name.includes(':') ? name : `minecraft:${name}`;
}

export const AIR_NAMES = new Set(['minecraft:air', 'minecraft:cave_air', 'minecraft:void_air']);

export function isAirState(bs: BlockState): boolean {
  return AIR_NAMES.has(bs.name);
}
