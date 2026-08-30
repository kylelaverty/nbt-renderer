import { unzipSync } from 'fflate';
import type { FoundJar, FoundVersion } from './instance';

/** Full path (e.g. "assets/minecraft/textures/block/stone.png") -> raw bytes. */
export class AssetStore {
  private files = new Map<string, Uint8Array>();
  readonly sourcesApplied: string[] = [];

  private mergeFrom(bytes: Uint8Array, sourceLabel: string) {
    const extracted = unzipSync(bytes, {
      filter: (entry) => entry.name.startsWith('assets/') || entry.name === 'pack.mcmeta',
    });
    for (const [path, data] of Object.entries(extracted)) {
      this.files.set(path, data);
    }
    this.sourcesApplied.push(sourceLabel);
  }

  /** Apply layers lowest-priority first: base version jar, then mods, then resource packs (top pack last = highest priority). */
  async build(opts: { version?: FoundVersion; mods?: FoundJar[]; resourcePacksLowToHigh?: FoundJar[] }): Promise<void> {
    if (opts.version) {
      this.mergeFrom(new Uint8Array(await opts.version.file.arrayBuffer()), `version:${opts.version.id}`);
    }
    for (const mod of opts.mods ?? []) {
      try {
        this.mergeFrom(new Uint8Array(await mod.file.arrayBuffer()), `mod:${mod.id}`);
      } catch (e) {
        console.warn(`Failed to read mod jar ${mod.id}`, e);
      }
    }
    for (const rp of opts.resourcePacksLowToHigh ?? []) {
      try {
        this.mergeFrom(new Uint8Array(await rp.file.arrayBuffer()), `resourcepack:${rp.id}`);
      } catch (e) {
        console.warn(`Failed to read resource pack ${rp.id}`, e);
      }
    }
  }

  get(path: string): Uint8Array | undefined {
    return this.files.get(path);
  }

  has(path: string): boolean {
    return this.files.has(path);
  }

  readJson<T = unknown>(path: string): T | undefined {
    const bytes = this.files.get(path);
    if (!bytes) return undefined;
    try {
      return JSON.parse(new TextDecoder('utf-8').decode(bytes)) as T;
    } catch {
      return undefined;
    }
  }

  get size(): number {
    return this.files.size;
  }
}
