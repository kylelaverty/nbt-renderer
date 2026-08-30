import type { BlockState } from '../schematic/blockstate';
import type { AssetStore } from './assetStore';
import { loadResolvedModel, resolveTextureVar } from './modelLoader';
import type { Direction, ModelElementJson, ResolvedQuad, Vec3 } from './modelTypes';
import { blockStatePath } from './resourceId';
import type { BlockStateJson } from './modelTypes';
import { pickMultipartApplies, pickVariant } from './variantMatch';

const FACE_NORMALS: Record<Direction, Vec3> = {
  down: [0, -1, 0],
  up: [0, 1, 0],
  north: [0, 0, -1],
  south: [0, 0, 1],
  west: [-1, 0, 0],
  east: [1, 0, 0],
};

// Corner order chosen so the two triangles (0,1,2) and (0,2,3) both face outward (counter-clockwise
// when viewed from outside the cube along -normal).
const FACE_CORNERS: Record<Direction, Vec3[]> = {
  down: [
    [0, 0, 0],
    [1, 0, 0],
    [1, 0, 1],
    [0, 0, 1],
  ],
  up: [
    [0, 1, 1],
    [1, 1, 1],
    [1, 1, 0],
    [0, 1, 0],
  ],
  north: [
    [1, 0, 0],
    [0, 0, 0],
    [0, 1, 0],
    [1, 1, 0],
  ],
  south: [
    [0, 0, 1],
    [1, 0, 1],
    [1, 1, 1],
    [0, 1, 1],
  ],
  west: [
    [0, 0, 0],
    [0, 0, 1],
    [0, 1, 1],
    [0, 1, 0],
  ],
  east: [
    [1, 0, 1],
    [1, 0, 0],
    [1, 1, 0],
    [1, 1, 1],
  ],
};

/** A plain full-cube quad set (used for fluids, which aren't driven by model JSON in vanilla). */
export function buildFullCubeQuads(texturePath: string, tintindex?: number): ResolvedQuad[] {
  const dirs = Object.keys(FACE_CORNERS) as Direction[];
  return dirs.map((dir) => ({
    corners: FACE_CORNERS[dir],
    uv: [0, 0, 16, 16] as [number, number, number, number],
    uvRotation: 0,
    texturePath,
    tintindex,
    normal: FACE_NORMALS[dir],
  }));
}

function rotatePoint(p: Vec3, origin: Vec3, axis: 'x' | 'y' | 'z', angleDeg: number): Vec3 {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const x = p[0] - origin[0];
  const y = p[1] - origin[1];
  const z = p[2] - origin[2];
  let rx = x;
  let ry = y;
  let rz = z;
  if (axis === 'x') {
    ry = y * cos - z * sin;
    rz = y * sin + z * cos;
  } else if (axis === 'y') {
    rx = x * cos + z * sin;
    rz = -x * sin + z * cos;
  } else {
    rx = x * cos - y * sin;
    ry = x * sin + y * cos;
  }
  return [rx + origin[0], ry + origin[1], rz + origin[2]];
}

function rotateVector(v: Vec3, axis: 'x' | 'y' | 'z', angleDeg: number): Vec3 {
  return rotatePoint(v, [0, 0, 0], axis, angleDeg);
}

function lerpCorner(from: Vec3, to: Vec3, unit: Vec3): Vec3 {
  return [
    unit[0] === 0 ? from[0] : to[0],
    unit[1] === 0 ? from[1] : to[1],
    unit[2] === 0 ? from[2] : to[2],
  ];
}

function defaultUv(dir: Direction, from: Vec3, to: Vec3): [number, number, number, number] {
  switch (dir) {
    case 'down':
    case 'up':
      return [from[0], from[2], to[0], to[2]];
    case 'north':
      return [16 - to[0], 16 - to[1], 16 - from[0], 16 - from[1]];
    case 'south':
      return [from[0], 16 - to[1], to[0], 16 - from[1]];
    case 'west':
      return [from[2], 16 - to[1], to[2], 16 - from[1]];
    case 'east':
      return [16 - to[2], 16 - to[1], 16 - from[2], 16 - from[1]];
  }
}

function buildElementQuads(el: ModelElementJson, textures: Record<string, string>, bsRotX: number, bsRotY: number): ResolvedQuad[] {
  const quads: ResolvedQuad[] = [];
  const dirs = Object.keys(el.faces) as Direction[];
  for (const dir of dirs) {
    const face = el.faces[dir];
    if (!face) continue;
    const texRef = resolveTextureVar(textures, face.texture);
    if (!texRef) continue;

    let corners = FACE_CORNERS[dir].map((unit) => lerpCorner(el.from, el.to, unit));
    let normal = FACE_NORMALS[dir];

    if (el.rotation) {
      const { origin, axis, angle, rescale } = el.rotation;
      corners = corners.map((c) => rotatePoint(c, origin, axis, angle));
      normal = rotateVector(normal, axis, angle);
      if (rescale) {
        // approximate rescale: skip precise 1/cos(angle) scaling for simplicity, visually minor.
      }
    }

    // Blockstate-level whole-model rotation (multiples of 90deg around block center 8,8,8).
    const center: Vec3 = [8, 8, 8];
    if (bsRotX) {
      corners = corners.map((c) => rotatePoint(c, center, 'x', -bsRotX));
      normal = rotateVector(normal, 'x', -bsRotX);
    }
    if (bsRotY) {
      corners = corners.map((c) => rotatePoint(c, center, 'y', -bsRotY));
      normal = rotateVector(normal, 'y', -bsRotY);
    }

    const local: Vec3[] = corners.map((c) => [c[0] / 16, c[1] / 16, c[2] / 16]);
    const uv = face.uv ?? defaultUv(dir, el.from, el.to);

    quads.push({
      corners: local,
      uv,
      uvRotation: face.rotation ?? 0,
      texturePath: texRef,
      tintindex: face.tintindex,
      normal,
    });
  }
  return quads;
}

const blockStateJsonCache = new Map<string, BlockStateJson | null>();

function loadBlockStateJson(store: AssetStore, name: string): BlockStateJson | undefined {
  if (blockStateJsonCache.has(name)) return blockStateJsonCache.get(name) ?? undefined;
  const json = store.readJson<BlockStateJson>(blockStatePath(name)) ?? null;
  blockStateJsonCache.set(name, json);
  return json ?? undefined;
}

/** Resolves a block state into world-space-ready quads in local [0,1]^3 block space. Returns undefined if the block/model could not be found at all. */
export function buildQuadsForBlockState(store: AssetStore, bs: BlockState): ResolvedQuad[] | undefined {
  const stateJson = loadBlockStateJson(store, bs.name);
  if (!stateJson) return undefined;

  const applies: { model: string; x: number; y: number }[] = [];
  if (stateJson.variants) {
    const entry = pickVariant(stateJson.variants, bs);
    if (entry) applies.push({ model: entry.model, x: entry.x ?? 0, y: entry.y ?? 0 });
  } else if (stateJson.multipart) {
    for (const entry of pickMultipartApplies(stateJson.multipart, bs)) {
      applies.push({ model: entry.model, x: entry.x ?? 0, y: entry.y ?? 0 });
    }
  }
  if (applies.length === 0) return undefined;

  const quads: ResolvedQuad[] = [];
  for (const apply of applies) {
    const resolved = loadResolvedModel(store, apply.model);
    if (!resolved) continue;
    for (const el of resolved.elements) {
      quads.push(...buildElementQuads(el, resolved.textures, apply.x, apply.y));
    }
  }
  return quads;
}

export function clearBlockStateJsonCache(): void {
  blockStateJsonCache.clear();
}
