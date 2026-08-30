import * as THREE from 'three';
import type { AssetStore } from '../assets/assetStore';
import { resolveBlockRender } from '../assets/blockResolver';
import { buildTextureAtlas, type BuiltAtlas } from '../assets/textureAtlas';
import { getTintColor } from '../assets/tint';
import { isAirState, type BlockState } from '../schematic/blockstate';
import { indexXYZ, type ParsedSchematic } from '../schematic/types';
import type { ResolvedQuad, Vec3 } from '../assets/modelTypes';

const MISSING_TEXTURE_KEY = '__missing__';

const NON_OCCLUDING_KEYWORDS = [
  'air', 'stairs', 'slab', 'fence', 'wall', 'gate', 'door', 'trapdoor', 'sign', 'carpet',
  'pressure_plate', 'torch', 'button', 'lever', 'pane', 'bars', 'rail', 'banner', 'skull',
  'head', 'sapling', 'flower', 'tulip', 'poppy', 'dandelion', 'fern', 'tall_grass', 'bush',
  'vine', 'ladder', 'chain', 'lantern', 'candle', 'bed', 'snow_layer', 'web', 'lily_pad',
  'rod', 'wheat', 'carrots', 'potatoes', 'beetroots', 'nether_wart', 'cocoa', 'coral',
  'kelp', 'seagrass', 'bubble_column', 'chest', 'cauldron', 'anvil', 'hopper', 'comparator',
  'repeater', 'scaffolding', 'campfire', 'bell', 'conduit', 'dragon_egg', 'turtle_egg',
  'sculk_sensor', 'sculk_vein', 'lightning_rod', 'brewing_stand', 'flower_pot', 'item_frame',
  'painting', 'glass', 'leaves', 'ice',
];
const NON_OCCLUDING_EXACT = new Set(['minecraft:brown_mushroom', 'minecraft:red_mushroom', 'minecraft:cake', 'minecraft:water', 'minecraft:lava']);

function isLikelyFullCube(name: string): boolean {
  if (NON_OCCLUDING_EXACT.has(name)) return false;
  const bare = name.includes(':') ? name.slice(name.indexOf(':') + 1) : name;
  return !NON_OCCLUDING_KEYWORDS.some((kw) => kw && bare.includes(kw));
}

const EPS = 1e-4;

function quadBoundaryDir(quad: ResolvedQuad): Vec3 | undefined {
  const n = quad.normal;
  const axis = Math.abs(n[0]) > 0.5 ? 0 : Math.abs(n[1]) > 0.5 ? 1 : 2;
  const target = n[axis] > 0 ? 1 : 0;
  for (const c of quad.corners) {
    if (Math.abs(c[axis] - target) > EPS) return undefined;
  }
  return n;
}

interface GeomBuckets {
  positions: number[];
  normals: number[];
  uvs: number[];
  colors: number[];
}

function newBucket(): GeomBuckets {
  return { positions: [], normals: [], uvs: [], colors: [] };
}

function pushQuad(
  bucket: GeomBuckets,
  quad: ResolvedQuad,
  originX: number,
  originY: number,
  originZ: number,
  atlas: BuiltAtlas,
  tint: [number, number, number],
) {
  const cell = atlas.cells.get(quad.texturePath) ?? atlas.cells.get(MISSING_TEXTURE_KEY)!;
  const scaleU = atlas.cellSize / 16 / atlas.atlasWidth;
  const scaleV = atlas.cellSize / 16 / atlas.atlasHeight;
  const baseU = cell.x / atlas.atlasWidth;
  const baseV = cell.y / atlas.atlasHeight;

  const [u0, v0, u1, v1] = quad.uv;
  let uvCorners: [number, number][] = [
    [u0, v0],
    [u1, v0],
    [u1, v1],
    [u0, v1],
  ];
  const rot = ((quad.uvRotation % 360) + 360) % 360;
  const steps = rot / 90;
  for (let i = 0; i < steps; i++) {
    uvCorners = [uvCorners[3], uvCorners[0], uvCorners[1], uvCorners[2]];
  }

  const toAtlas = (u: number, v: number): [number, number] => [baseU + u * scaleU, 1 - (baseV + v * scaleV)];

  const quadUv = uvCorners.map(([u, v]) => toAtlas(u, v));

  const idx = [0, 1, 2, 0, 2, 3];
  for (const i of idx) {
    const c = quad.corners[i];
    bucket.positions.push(c[0] + originX, c[1] + originY, c[2] + originZ);
    bucket.normals.push(quad.normal[0], quad.normal[1], quad.normal[2]);
    bucket.uvs.push(quadUv[i][0], quadUv[i][1]);
    bucket.colors.push(tint[0], tint[1], tint[2]);
  }
}

function bucketToGeometry(bucket: GeomBuckets): THREE.BufferGeometry {
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(bucket.positions, 3));
  geom.setAttribute('normal', new THREE.Float32BufferAttribute(bucket.normals, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(bucket.uvs, 2));
  geom.setAttribute('color', new THREE.Float32BufferAttribute(bucket.colors, 3));
  return geom;
}

export interface BuiltScene {
  opaqueMesh?: THREE.Mesh;
  transparentMesh?: THREE.Mesh;
  atlas: BuiltAtlas;
  totalBlocks: number;
  unresolvedBlockNames: string[];
  triangleCount: number;
}

export async function buildScene(store: AssetStore, schematic: ParsedSchematic, opts: { maxY?: number } = {}): Promise<BuiltScene> {
  const { size, palette, blocks, airIndex } = schematic;
  const [sizeX, sizeY, sizeZ] = size;
  const maxY = opts.maxY ?? sizeY;

  const paletteRenders = palette.map((bs) => (isAirState(bs) ? undefined : resolveBlockRender(store, bs)));
  const unresolvedNames = new Set<string>();
  palette.forEach((bs, i) => {
    if (paletteRenders[i] && !paletteRenders[i]!.resolved) unresolvedNames.add(bs.name);
  });

  const texturePaths = new Set<string>();
  for (const r of paletteRenders) {
    if (!r) continue;
    for (const q of r.quads) texturePaths.add(q.texturePath);
  }
  texturePaths.add(MISSING_TEXTURE_KEY);

  const atlas = await buildTextureAtlas(store, texturePaths);

  const opaqueBucket = newBucket();
  const transparentBucket = newBucket();
  let totalBlocks = 0;

  const isFullCubeCache = new Map<number, boolean>();
  const isAirCache = new Map<number, boolean>();
  function paletteIsFullCube(pIdx: number): boolean {
    let v = isFullCubeCache.get(pIdx);
    if (v === undefined) {
      v = isLikelyFullCube(palette[pIdx].name);
      isFullCubeCache.set(pIdx, v);
    }
    return v;
  }
  function paletteIsAir(pIdx: number): boolean {
    let v = isAirCache.get(pIdx);
    if (v === undefined) {
      v = pIdx === airIndex || isAirState(palette[pIdx]);
      isAirCache.set(pIdx, v);
    }
    return v;
  }

  const getPaletteAt = (x: number, y: number, z: number): number => {
    if (x < 0 || y < 0 || z < 0 || x >= sizeX || y >= sizeY || z >= sizeZ) return -1;
    return blocks[indexXYZ(size, x, y, z)];
  };

  for (let y = 0; y < Math.min(maxY, sizeY); y++) {
    for (let z = 0; z < sizeZ; z++) {
      for (let x = 0; x < sizeX; x++) {
        const pIdx = blocks[indexXYZ(size, x, y, z)];
        if (paletteIsAir(pIdx)) continue;
        const render = paletteRenders[pIdx];
        totalBlocks++;
        const bs: BlockState = palette[pIdx];

        let quads: ResolvedQuad[];
        let transparent = false;
        if (!render || !render.resolved) {
          quads = PLACEHOLDER_QUADS;
        } else {
          quads = render.quads;
          transparent = render.transparent;
        }

        const bucket = transparent ? transparentBucket : opaqueBucket;
        for (const quad of quads) {
          const boundary = quadBoundaryDir(quad);
          if (boundary) {
            const nx = x + Math.round(boundary[0]);
            const ny = y + Math.round(boundary[1]);
            const nz = z + Math.round(boundary[2]);
            const neighborPalette = getPaletteAt(nx, ny, nz);
            if (neighborPalette >= 0 && !paletteIsAir(neighborPalette) && paletteIsFullCube(neighborPalette) && !(paletteRenders[neighborPalette]?.transparent)) {
              continue;
            }
          }
          const tint = getTintColor(bs.name, quad.tintindex) ?? [1, 1, 1];
          pushQuad(bucket, quad, x, y, z, atlas, tint);
        }
      }
    }
  }

  const material = (transparentFlag: boolean) =>
    new THREE.MeshLambertMaterial({
      map: atlas.texture,
      vertexColors: true,
      transparent: transparentFlag,
      alphaTest: transparentFlag ? 0 : 0.5,
      opacity: transparentFlag ? 0.75 : 1,
      side: THREE.FrontSide,
    });

  let opaqueMesh: THREE.Mesh | undefined;
  let transparentMesh: THREE.Mesh | undefined;
  let triangleCount = 0;
  if (opaqueBucket.positions.length > 0) {
    const geom = bucketToGeometry(opaqueBucket);
    opaqueMesh = new THREE.Mesh(geom, material(false));
    triangleCount += opaqueBucket.positions.length / 9;
  }
  if (transparentBucket.positions.length > 0) {
    const geom = bucketToGeometry(transparentBucket);
    transparentMesh = new THREE.Mesh(geom, material(true));
    triangleCount += transparentBucket.positions.length / 9;
  }

  return {
    opaqueMesh,
    transparentMesh,
    atlas,
    totalBlocks,
    unresolvedBlockNames: [...unresolvedNames].sort(),
    triangleCount,
  };
}

const PLACEHOLDER_QUADS: ResolvedQuad[] = (() => {
  const dirs: { normal: Vec3; corners: Vec3[] }[] = [
    { normal: [0, -1, 0], corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
    { normal: [0, 1, 0], corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
    { normal: [0, 0, -1], corners: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] },
    { normal: [0, 0, 1], corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
    { normal: [-1, 0, 0], corners: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
    { normal: [1, 0, 0], corners: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]] },
  ];
  return dirs.map((d) => ({
    corners: d.corners,
    uv: [0, 0, 16, 16] as [number, number, number, number],
    uvRotation: 0,
    texturePath: MISSING_TEXTURE_KEY,
    normal: d.normal,
  }));
})();
