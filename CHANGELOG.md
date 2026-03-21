# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0] - 2026-03-21

### Added
- Single-package public entrypoint via `shadejs`
- `shadejs/compiler` subpath export for the Vite plugin

### Changed
- Demo app and README now use `shadejs` as the default user-facing import surface
- Workspace root package renamed to `shadejs-workspace` to free the public `shadejs` package name

## [0.2.0] - 2026-03-20

### Added
- Keyed list reconciliation for reactive runtime children
- Deep reactive nested store access
- Scoped stacked effect error boundaries
- Automatic query registry cleanup via computation disposal
- Production RPC server static asset serving with SPA fallback
- Benchmark workspace with signal, DOM, and memo-chain scenarios
- Lifecycle hooks via `onMount` and scoped cleanup integration

## [0.1.0] - 2026-03-20

### Added
- Effect disposal via `createEffect` return value
- `batch()` API for explicit update batching
- `pending` and `error` signals on `createMutation`
- In-flight request deduplication in `createQuery`
- Source maps from compiler transforms
- Production RPC server (`dist/server.mjs`)
- Configurable effect error handling and runtime `ErrorBoundary`
- Package publishing metadata and CommonJS exports
- GitHub Actions CI workflow for `main` and pull requests
- Expanded README with architecture, quickstart, concepts, and limitations
- Vite RPC integration test coverage

### Fixed
- Effect memory leak; effects now disposable

## [0.0.1] - 2026-03-20

### Added
- Initial implementation: core signals, runtime, state, compiler
- Working demo app
- Static documentation page


