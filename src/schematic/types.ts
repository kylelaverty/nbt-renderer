import type { BlockState } from './blockstate';

export type SchematicFormat = 'sponge' | 'litematica' | 'mcedit' | 'structure';

export interface ParsedSchematic {
  /** [sizeX, sizeY, sizeZ] */
  size: [number, number, number];
  /** palette index -> block state */
  palette: BlockState[];
  /** length sizeX*sizeY*sizeZ, value = index into palette. index formula: x + z*sizeX + y*sizeX*sizeZ */
  blocks: Int32Array;
  /** palette index considered "air" (won't be rendered), or -1 if none found */
  airIndex: number;
  format: SchematicFormat;
  sourceDataVersion?: number;
  name?: string;
  warnings: string[];
}

export function indexXYZ(size: [number, number, number], x: number, y: number, z: number): number {
  return x + z * size[0] + y * size[0] * size[2];
}
