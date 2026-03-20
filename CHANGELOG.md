# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Effect disposal via `createEffect` return value
- `batch()` API for explicit update batching
- `pending` and `error` signals on `createMutation`
- In-flight request deduplication in `createQuery`
- Source maps from compiler transforms
- Production RPC server (`dist/server.mjs`)
- Configurable effect error handling and runtime `ErrorBoundary`
- Package publishing metadata and CommonJS exports
- GitHub Actions CI/CD workflows

### Fixed
- Effect memory leak; effects now disposable

## [0.0.1] - 2026-03-20

### Added
- Initial implementation: core signals, runtime, state, compiler
- Working demo app
- Static documentation page
