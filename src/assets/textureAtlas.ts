import * as THREE from 'three';
import type { AssetStore } from './assetStore';
import { texturePath } from './resourceId';

export interface AtlasCell {
  x: number;
  y: number;
}

export interface BuiltAtlas {
  texture: THREE.Texture;
  cellSize: number;
  atlasWidth: number;
  atlasHeight: number;
  cells: Map<string, AtlasCell>;
  missing: Set<string>;
}

function nextPowerOfTwo(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

function drawMissingTexture(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const half = size / 2;
  ctx.fillStyle = '#000000';
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = '#ff00ff';
  ctx.fillRect(x, y, half, half);
  ctx.fillRect(x + half, y + half, half, half);
}

async function loadTextureBitmap(store: AssetStore, ref: string): Promise<ImageBitmap | undefined> {
  const path = texturePath(ref);
  const bytes = store.get(path);
  if (!bytes) return undefined;
  try {
    const blob = new Blob([bytes as BlobPart], { type: 'image/png' });
    const bitmap = await createImageBitmap(blob);
    return bitmap;
  } catch {
    return undefined;
  }
}

/** Builds a single canvas texture atlas containing every referenced texture, scaled to a common cell size. */
export async function buildTextureAtlas(store: AssetStore, texturePaths: Set<string>): Promise<BuiltAtlas> {
  const entries: { ref: string; bitmap?: ImageBitmap; w: number; h: number }[] = [];
  const missing = new Set<string>();

  for (const ref of texturePaths) {
    const bitmap = await loadTextureBitmap(store, ref);
    if (!bitmap) {
      missing.add(ref);
      entries.push({ ref, w: 16, h: 16 });
      continue;
    }
    let w = bitmap.width;
    let h = bitmap.height;
    if (h > w && h % w === 0) h = w; // animated strip: use first frame only
    entries.push({ ref, bitmap, w, h });
  }

  const maxDim = entries.reduce((m, e) => Math.max(m, e.w, e.h), 16);
  const cellSize = nextPowerOfTwo(maxDim);
  const cols = Math.max(1, Math.ceil(Math.sqrt(entries.length)));
  const rows = Math.max(1, Math.ceil(entries.length / cols));
  const atlasWidth = cols * cellSize;
  const atlasHeight = rows * cellSize;

  const canvas = document.createElement('canvas');
  canvas.width = atlasWidth;
  canvas.height = atlasHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  const cells = new Map<string, AtlasCell>();
  entries.forEach((entry, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = col * cellSize;
    const y = row * cellSize;
    cells.set(entry.ref, { x, y });
    if (entry.bitmap) {
      ctx.drawImage(entry.bitmap, 0, 0, entry.w, entry.h, x, y, cellSize, cellSize);
    } else {
      drawMissingTexture(ctx, x, y, cellSize);
    }
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  return { texture, cellSize, atlasWidth, atlasHeight, cells, missing };
}
