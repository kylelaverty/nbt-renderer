import type { BlockState } from '../schematic/blockstate';
import type { MultipartCaseJson, VariantEntryJson, WhenClauseJson } from './modelTypes';

export function parseVariantKey(key: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (key.trim().length === 0) return out;
  for (const pair of key.split(',')) {
    const [k, v] = pair.split('=');
    if (k && v !== undefined) out[k.trim()] = v.trim();
  }
  return out;
}

/** Picks the best matching variant key for a block state's properties (most specific match wins). */
export function pickVariant(variants: Record<string, VariantEntryJson | VariantEntryJson[]>, bs: BlockState): VariantEntryJson | undefined {
  let best: { entry: VariantEntryJson; score: number } | undefined;
  for (const [key, value] of Object.entries(variants)) {
    const props = parseVariantKey(key);
    let matches = true;
    let score = 0;
    for (const [k, v] of Object.entries(props)) {
      if (bs.properties[k] !== v) {
        matches = false;
        break;
      }
      score++;
    }
    if (!matches) continue;
    const entry = Array.isArray(value) ? value[0] : value;
    if (!best || score > best.score) best = { entry, score };
  }
  return best?.entry;
}

function matchWhen(when: WhenClauseJson, bs: BlockState): boolean {
  if ('OR' in when && Array.isArray((when as { OR: WhenClauseJson[] }).OR)) {
    return (when as { OR: WhenClauseJson[] }).OR.some((w) => matchWhen(w, bs));
  }
  if ('AND' in when && Array.isArray((when as { AND: WhenClauseJson[] }).AND)) {
    return (when as { AND: WhenClauseJson[] }).AND.every((w) => matchWhen(w, bs));
  }
  for (const [k, v] of Object.entries(when as Record<string, string>)) {
    const options = v.split('|');
    if (!options.includes(bs.properties[k])) return false;
  }
  return true;
}

export function pickMultipartApplies(cases: MultipartCaseJson[], bs: BlockState): VariantEntryJson[] {
  const out: VariantEntryJson[] = [];
  for (const c of cases) {
    if (c.when && !matchWhen(c.when, bs)) continue;
    const apply = Array.isArray(c.apply) ? c.apply[0] : c.apply;
    out.push(apply);
  }
  return out;
}
