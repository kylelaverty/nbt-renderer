export type Vec3 = [number, number, number];
export type Direction = 'north' | 'south' | 'east' | 'west' | 'up' | 'down';

export interface ModelFaceJson {
  uv?: [number, number, number, number];
  texture: string;
  cullface?: Direction;
  rotation?: number;
  tintindex?: number;
}

export interface ModelElementJson {
  from: Vec3;
  to: Vec3;
  rotation?: { origin: Vec3; axis: 'x' | 'y' | 'z'; angle: number; rescale?: boolean };
  shade?: boolean;
  faces: Partial<Record<Direction, ModelFaceJson>>;
}

export interface ModelJson {
  parent?: string;
  textures?: Record<string, string>;
  elements?: ModelElementJson[];
  ambientocclusion?: boolean;
}

export interface VariantEntryJson {
  model: string;
  x?: number;
  y?: number;
  uvlock?: boolean;
  weight?: number;
}

export type WhenClauseJson = { OR: WhenClauseJson[] } | { AND: WhenClauseJson[] } | Record<string, string>;

export interface MultipartCaseJson {
  when?: WhenClauseJson;
  apply: VariantEntryJson | VariantEntryJson[];
}

export interface BlockStateJson {
  variants?: Record<string, VariantEntryJson | VariantEntryJson[]>;
  multipart?: MultipartCaseJson[];
}

/** A resolved renderable quad in local block-space [0,1]^3, ready for the geometry builder. */
export interface ResolvedQuad {
  /** 4 corner positions, in winding order, already rotated per blockstate x/y and element rotation. */
  corners: Vec3[];
  uv: [number, number, number, number]; // u0,v0,u1,v1 in 0-16 texture space
  uvRotation: number;
  texturePath: string; // "minecraft:block/stone" style resolved reference
  tintindex?: number;
  normal: Vec3;
}
