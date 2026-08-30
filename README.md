# Schematic Preview

A browser-based viewer that renders Minecraft schematic/structure files as they'd look placed in the world, so
you can check a build before opening the game.

Everything runs client-side: no files are uploaded anywhere.

## Supported file formats

- Sponge Schematic (`.schem`, versions 1-3 - WorldEdit/FAWE/Litematica export)
- Litematica (`.litematic`, including multi-region files)
- Classic MCEdit-style (`.schematic`, numeric block IDs, pre-1.13)
- Vanilla structure block export (`.nbt`)

## How rendering works

Real Minecraft textures/models are Mojang's property and aren't bundled with this app. Instead, you point it at
your own `.minecraft` folder: it reads the version jar (and any mods/resource packs you select) directly in the
browser, extracts the relevant blockstates/models/textures, and builds a preview using the exact assets your
game would use. This means:

- The preview reflects your selected game version, and any installed mods/resource packs.
- If a block can't be resolved (e.g. a mod isn't selected, or an exotic legacy block ID with no known mapping),
  it's rendered as a placeholder box and listed under "unresolved blocks" in the sidebar.

Folder selection requires a browser that supports `<input webkitdirectory>` (Chrome, Edge, Firefox, Safari).

## Known limitations (MVP)

- No biome-accurate tinting for grass/leaves/water; a fixed approximate green/blue is used.
- Liquids (water/lava) are rendered as static cubes, not flowing/animated.
- Only the first frame of animated textures is used.
- Block/entity NBT data (sign text, banner patterns, chest contents, etc.) is not rendered - only the base block
  shape.
- Occlusion culling (hiding faces between adjacent solid blocks, for performance) uses a name-based heuristic and
  may occasionally be conservative for unusual modded block shapes.

## Development

```bash
npm install
npm run dev      # start local dev server
npm run build    # type-check + production build
npm test         # run unit tests (vitest)
```

## CI/CD

- Every pull request (and each push to its branch) runs the build and test suite via
  `.github/workflows/ci.yml`.
- Pushing a tag matching `v*` runs `.github/workflows/release.yml`: build, test, zip the compiled
  app, and publish it as a GitHub release with auto-generated release notes.

Stack: React + TypeScript + Vite, Three.js for rendering, `fflate` for gzip/zip decoding.
