# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Tagging a commit `vX.Y.Z` triggers `.github/workflows/release.yml`, which builds the app,
runs the test suite, and publishes a GitHub release with the compiled app attached; that
release's notes are auto-generated from merged PRs/commits. This file is the curated,
human-written counterpart to those auto-generated notes and should be updated alongside
each release.

## [Unreleased]

### Added

- Initial version of the schematic/structure preview app: parses `.schem` (Sponge Schematic
  v1-3), `.litematic` (Litematica, including multi-region files), `.schematic` (classic
  MCEdit-style, numeric block IDs), and `.nbt` (vanilla structure block export) files.
- Renders the parsed build in 3D using block textures/models read directly from a
  user-selected `.minecraft` folder (version jar, plus any selected mods and resource
  packs), so the preview matches the user's own instance.
- Blockstate/model resolver supporting variants, multipart, and model parent-chain
  inheritance; a runtime texture atlas; and a merged-mesh builder with face occlusion
  culling for performance.
- Orbit-camera 3D viewer with a layer-height slider to reveal the build course by course.
- Unit tests (vitest) for all four schematic parsers, blockstate string round-tripping,
  and blockstate variant/multipart matching.
- CI workflow: build and test on pull request open/synchronize.
- Release workflow: build, test, zip the compiled app, and publish a GitHub release with
  auto-generated notes on any `v*` tag push.
