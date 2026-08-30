import { loadNbt } from '../nbt/reader';
import { parseLitematica } from './litematica';
import { parseMcEditSchematic } from './mcedit';
import { parseSpongeSchematic } from './sponge';
import { parseStructureNbt } from './structure';
import type { ParsedSchematic } from './types';

export * from './types';
export * from './blockstate';

export function parseSchematicFile(bytes: Uint8Array, fileName: string): ParsedSchematic {
  const root = loadNbt(bytes);
  const v = root.value;
  const ext = fileName.toLowerCase().split('.').pop();

  if ('Regions' in v) return parseLitematica(root);
  if ('Palette' in v || ('Blocks' in v && typeof v.Blocks === 'object' && !ArrayBuffer.isView(v.Blocks) && !Array.isArray(v.Blocks))) {
    return parseSpongeSchematic(root);
  }
  if ('size' in v && 'palette' in v && 'blocks' in v) return parseStructureNbt(root);
  if ('Width' in v && 'Height' in v && 'Length' in v && 'Blocks' in v) return parseMcEditSchematic(root);

  // Fall back to extension hint if structural detection was ambiguous.
  if (ext === 'litematic') return parseLitematica(root);
  if (ext === 'schem') return parseSpongeSchematic(root);
  if (ext === 'schematic') return parseMcEditSchematic(root);
  if (ext === 'nbt') return parseStructureNbt(root);

  throw new Error('Could not detect schematic format (not a recognized .schem/.litematic/.schematic/.nbt file)');
}
