import { useCallback, useRef, useState } from 'react';
import './App.css';
import { AssetStore } from './assets/assetStore';
import { clearBlockRenderCache } from './assets/blockResolver';
import { clearBlockStateJsonCache } from './assets/geometryBuilder';
import { scanInstanceFiles, type FoundJar, type FoundVersion, type ScannedInstance } from './assets/instance';
import { clearModelCache } from './assets/modelLoader';
import { buildScene, type BuiltScene } from './render/meshBuilder';
import { SceneViewer } from './render/SceneViewer';
import { parseSchematicFile, type ParsedSchematic } from './schematic';

function Checklist<T extends { id: string }>({
  items,
  selected,
  onToggle,
  emptyLabel,
}: {
  items: T[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  emptyLabel: string;
}) {
  if (items.length === 0) return <div className="checklist"><em>{emptyLabel}</em></div>;
  return (
    <div className="checklist">
      {items.map((item) => (
        <label key={item.id}>
          <input type="checkbox" checked={selected.has(item.id)} onChange={() => onToggle(item.id)} />
          {item.id}
        </label>
      ))}
    </div>
  );
}

function toggleInSet(set: Set<string>, id: string): Set<string> {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export default function App() {
  const [schematic, setSchematic] = useState<ParsedSchematic | undefined>();
  const [schematicName, setSchematicName] = useState<string>('');
  const [schematicError, setSchematicError] = useState<string | undefined>();

  const [scanned, setScanned] = useState<ScannedInstance | undefined>();
  const [selectedVersion, setSelectedVersion] = useState<string>('');
  const [selectedMods, setSelectedMods] = useState<Set<string>>(new Set());
  const [selectedPacks, setSelectedPacks] = useState<Set<string>>(new Set());

  const [store, setStore] = useState<AssetStore | undefined>();
  const [assetError, setAssetError] = useState<string | undefined>();
  const [loadingAssets, setLoadingAssets] = useState(false);

  const [scene, setScene] = useState<BuiltScene | undefined>();
  const [rendering, setRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | undefined>();
  const [layer, setLayer] = useState(0);
  const [resetCameraSignal, setResetCameraSignal] = useState(0);

  const layerDebounceRef = useRef<number | undefined>(undefined);

  const onSchematicFile = useCallback(async (file: File) => {
    setSchematicError(undefined);
    setScene(undefined);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const parsed = parseSchematicFile(bytes, file.name);
      setSchematic(parsed);
      setSchematicName(file.name);
      setLayer(parsed.size[1]);
      setResetCameraSignal((v) => v + 1);
    } catch (e) {
      setSchematic(undefined);
      setSchematicError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const onFolderPick = useCallback((files: FileList) => {
    const result = scanInstanceFiles(files);
    setScanned(result);
    setSelectedVersion(result.versions[result.versions.length - 1]?.id ?? '');
    setSelectedMods(new Set(result.mods.map((m) => m.id)));
    setSelectedPacks(new Set());
    setStore(undefined);
    setAssetError(undefined);
  }, []);

  const loadAssets = useCallback(async () => {
    if (!scanned) return;
    const version = scanned.versions.find((v) => v.id === selectedVersion);
    if (!version) {
      setAssetError('Select a Minecraft version first.');
      return;
    }
    setLoadingAssets(true);
    setAssetError(undefined);
    try {
      const s = new AssetStore();
      const mods = scanned.mods.filter((m) => selectedMods.has(m.id));
      const packs = scanned.resourcepacks.filter((p) => selectedPacks.has(p.id));
      await s.build({ version, mods, resourcePacksLowToHigh: packs });
      clearBlockRenderCache();
      clearModelCache();
      clearBlockStateJsonCache();
      setStore(s);
      setScene(undefined);
    } catch (e) {
      setAssetError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingAssets(false);
    }
  }, [scanned, selectedVersion, selectedMods, selectedPacks]);

  const runRender = useCallback(async (sch: ParsedSchematic, s: AssetStore, maxY: number) => {
    setRendering(true);
    setRenderError(undefined);
    try {
      const result = await buildScene(s, sch, { maxY });
      setScene(result);
    } catch (e) {
      setRenderError(e instanceof Error ? e.message : String(e));
    } finally {
      setRendering(false);
    }
  }, []);

  const onLayerChange = (v: number) => {
    setLayer(v);
    if (layerDebounceRef.current) window.clearTimeout(layerDebounceRef.current);
    layerDebounceRef.current = window.setTimeout(() => {
      if (schematic && store) runRender(schematic, store, v);
    }, 180);
  };

  const versionItems: (FoundVersion & { id: string })[] = scanned?.versions ?? [];
  const modItems: FoundJar[] = scanned?.mods ?? [];
  const packItems: FoundJar[] = scanned?.resourcepacks ?? [];

  return (
    <div className="app">
      <aside className="sidebar">
        <h1>Schematic Preview</h1>
        <p style={{ fontSize: 12, color: '#9aa1ab', margin: 0 }}>
          Preview a Minecraft schematic or structure file rendered as it would look placed in the world, using
          textures from your own Minecraft install.
        </p>

        <div className="panel">
          <h2>1. Schematic file</h2>
          <div
            className="dropzone"
            onClick={() => document.getElementById('schematic-input')?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files[0];
              if (f) onSchematicFile(f);
            }}
          >
            {schematicName || 'Click or drop a .schem / .litematic / .schematic / .nbt file'}
          </div>
          <input
            id="schematic-input"
            type="file"
            accept=".schem,.litematic,.schematic,.nbt"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onSchematicFile(f);
            }}
          />
          {schematicError && <p className="error">{schematicError}</p>}
          {schematic && (
            <div style={{ marginTop: 8 }}>
              <div className="stat-row"><span>Format</span><span>{schematic.format}</span></div>
              <div className="stat-row"><span>Size</span><span>{schematic.size.join(' x ')}</span></div>
              <div className="stat-row"><span>Palette entries</span><span>{schematic.palette.length}</span></div>
              {schematic.warnings.map((w, i) => (
                <p className="warning" key={i}>{w}</p>
              ))}
            </div>
          )}
        </div>

        <div className="panel">
          <h2>2. Minecraft install</h2>
          <button className="btn" onClick={() => document.getElementById('folder-input')?.click()}>
            Select .minecraft folder
          </button>
          <input
            id="folder-input"
            type="file"
            // @ts-expect-error non-standard attributes for directory selection
            webkitdirectory="true"
            directory=""
            multiple
            style={{ display: 'none' }}
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) onFolderPick(e.target.files);
            }}
          />
          <small className="hint">
            Used to load the real block textures/models for the chosen version (and any mods/resource packs), so the
            preview matches your instance. Nothing is uploaded anywhere - all parsing happens in your browser.
          </small>

          {scanned && (
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={{ fontSize: 12, color: '#9aa1ab' }}>Version</label>
                <select value={selectedVersion} onChange={(e) => setSelectedVersion(e.target.value)}>
                  {versionItems.length === 0 && <option value="">No versions found</option>}
                  {versionItems.map((v) => (
                    <option key={v.id} value={v.id}>{v.id}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12, color: '#9aa1ab' }}>Mods ({selectedMods.size}/{modItems.length})</label>
                <Checklist
                  items={modItems.map((m) => ({ id: m.id }))}
                  selected={selectedMods}
                  onToggle={(id) => setSelectedMods((s) => toggleInSet(s, id))}
                  emptyLabel="No mods folder found"
                />
              </div>

              <div>
                <label style={{ fontSize: 12, color: '#9aa1ab' }}>
                  Resource packs, low to high priority ({selectedPacks.size}/{packItems.length})
                </label>
                <Checklist
                  items={packItems.map((p) => ({ id: p.id }))}
                  selected={selectedPacks}
                  onToggle={(id) => setSelectedPacks((s) => toggleInSet(s, id))}
                  emptyLabel="No zipped resource packs found"
                />
              </div>

              <button className="btn primary" disabled={loadingAssets || !selectedVersion} onClick={loadAssets}>
                {loadingAssets ? 'Loading assets…' : 'Load assets'}
              </button>
              {assetError && <p className="error">{assetError}</p>}
              {store && <div className="stat-row"><span>Files loaded</span><span>{store.size}</span></div>}
            </div>
          )}
        </div>

        <div className="panel">
          <h2>3. Render</h2>
          <button
            className="btn primary"
            disabled={!schematic || !store || rendering}
            onClick={() => schematic && store && runRender(schematic, store, layer)}
          >
            {rendering ? 'Rendering…' : 'Render preview'}
          </button>
          {renderError && <p className="error">{renderError}</p>}
          {scene && (
            <div style={{ marginTop: 8 }}>
              <div className="stat-row"><span>Blocks rendered</span><span>{scene.totalBlocks.toLocaleString()}</span></div>
              <div className="stat-row"><span>Triangles</span><span>{Math.round(scene.triangleCount).toLocaleString()}</span></div>
              {scene.unresolvedBlockNames.length > 0 && (
                <>
                  <p className="warning">{scene.unresolvedBlockNames.length} block type(s) could not be resolved and are shown as placeholders:</p>
                  <div className="checklist">
                    {scene.unresolvedBlockNames.map((n) => <div key={n}>{n}</div>)}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </aside>

      <main className="viewer-wrap">
        {!schematic ? (
          <div className="viewer-placeholder">Load a schematic to begin</div>
        ) : (
          <SceneViewer scene={scene} size={schematic.size} resetCameraSignal={resetCameraSignal} />
        )}
        {schematic && (
          <div className="viewer-overlay">
            <span style={{ fontSize: 12, minWidth: 90 }}>Layer height: {layer}/{schematic.size[1]}</span>
            <input
              type="range"
              min={1}
              max={schematic.size[1]}
              value={layer}
              onChange={(e) => onLayerChange(Number(e.target.value))}
            />
          </div>
        )}
      </main>
    </div>
  );
}
