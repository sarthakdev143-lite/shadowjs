# ShadeJS — Git & CI/CD Standards

This file is an addendum to PRODUCTION_ROADMAP.md.
Apply everything here before starting Phase 1. This is not optional.

---

## Branching Strategy (GitHub Flow)

```
main          ← always deployable, protected
  └── phase/1-effect-disposal
  └── phase/2-batch-api
  └── phase/3-mutation-loading
  └── phase/4-query-dedup
  └── phase/5-source-maps
  └── phase/6-production-server
  └── phase/7-error-handling
  └── phase/8-publishing-config
  └── phase/9-ci
  └── phase/10-readme
  └── phase/11-integration-tests
```

Rules:
- Never commit directly to `main`
- Every phase gets its own branch: `phase/N-short-description`
- Branch is merged to `main` only after all tests pass on that branch
- Delete the branch after merge

---

## Commit Message Convention (Conventional Commits)

Format:
```
<type>(<scope>): <short description>

[optional body]

[optional footer]
```

Types:
- `feat` — new feature or capability
- `fix` — bug fix
- `refactor` — code change that neither fixes a bug nor adds a feature
- `test` — adding or updating tests
- `docs` — documentation only
- `chore` — build process, CI, config changes
- `perf` — performance improvement

Scopes: `core`, `runtime`, `state`, `compiler`, `demo`, `docs`, `ci`, `repo`

Examples:
```
feat(core): add dispose() return value to createEffect
fix(runtime): register effect disposers on anchor nodes
test(core): add disposal and batch tests
chore(ci): add GitHub Actions workflow
docs(readme): rewrite with architecture and quickstart
```

Rules:
- Subject line max 72 characters
- Use imperative mood: "add" not "added", "fix" not "fixed"
- No period at end of subject line
- Body explains WHY not WHAT (the diff shows what)
- One logical change per commit — do not bundle unrelated changes

---

## GitHub Actions Workflows

Create all three files below.

### `.github/workflows/ci.yml` — runs on every push and PR

```yaml
name: CI

on:
  push:
    branches: ["**"]
  pull_request:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  ci:
    name: Typecheck, Test, Build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v3
        with:
          version: 10

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Typecheck
        run: pnpm typecheck

      - name: Test
        run: pnpm test

      - name: Build
        run: pnpm build
```

### `.github/workflows/release.yml` — runs on version tags

```yaml
name: Release

on:
  push:
    tags:
      - "v*.*.*"

jobs:
  release:
    name: Publish to npm
    runs-on: ubuntu-latest
    permissions:
      contents: write
      id-token: write
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v3
        with:
          version: 10

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
          registry-url: https://registry.npmjs.org

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Typecheck
        run: pnpm typecheck

      - name: Test
        run: pnpm test

      - name: Build
        run: pnpm build

      - name: Publish packages
        run: pnpm -r publish --access public --no-git-checks
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          generate_release_notes: true
```

### `.github/workflows/pr-check.yml` — validates PR titles

```yaml
name: PR Title Check

on:
  pull_request:
    types: [opened, edited, synchronize]

jobs:
  check-title:
    runs-on: ubuntu-latest
    steps:
      - uses: amannn/action-semantic-pull-request@v5
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          types: |
            feat
            fix
            refactor
            test
            docs
            chore
            perf
          scopes: |
            core
            runtime
            state
            compiler
            demo
            docs
            ci
            repo
```

---

## Branch Protection Rules

Create a file `.github/branch-protection.md` documenting the rules to set manually in GitHub Settings → Branches → main:

```markdown
# Branch Protection — main

Settings to apply in GitHub repo settings:

- Require a pull request before merging: YES
- Require status checks to pass before merging: YES
  - Required checks: CI / Typecheck, Test, Build
- Require branches to be up to date before merging: YES
- Do not allow bypassing the above settings: YES
- Allow force pushes: NO
- Allow deletions: NO
```

---

## Semantic Versioning

ShadeJS follows semver: `MAJOR.MINOR.PATCH`

- `PATCH` (0.0.x) — bug fixes, no API changes
- `MINOR` (0.x.0) — new features, backwards compatible
- `MAJOR` (x.0.0) — breaking API changes

Current version: `0.1.0` after Phase 11 completes.

Version bump process:
```bash
# patch
pnpm -r exec npm version patch
git tag v0.1.1
git push --tags

# minor
pnpm -r exec npm version minor
git tag v0.2.0
git push --tags
```

All four packages (`core`, `runtime`, `state`, `compiler`) are versioned in lockstep — they always publish at the same version number.

---

## CHANGELOG

**New file: `CHANGELOG.md`** at repo root.

Format follows Keep a Changelog (https://keepachangelog.com):

```markdown
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
- GitHub Actions CI/CD workflows

### Fixed
- Effect memory leak — effects now disposable
- queryRegistry never shrinking — registry entries removed on disposal

## [0.0.1] - 2025-03-19

### Added
- Initial implementation: core signals, runtime, state, compiler
- Working demo app
- Static documentation page
```

Update CHANGELOG.md at the end of every phase with what changed.

---

## `.github/PULL_REQUEST_TEMPLATE.md`

```markdown
## What does this PR do?

<!-- One sentence description -->

## Phase

<!-- Which phase from PRODUCTION_ROADMAP.md does this implement? -->
Phase N — 

## Checklist

- [ ] `pnpm test` passes
- [ ] `pnpm typecheck` passes  
- [ ] `pnpm build` passes
- [ ] `pnpm dev` (demo) still works
- [ ] New tests added for new behavior
- [ ] CHANGELOG.md updated
- [ ] Commit messages follow Conventional Commits
```

---

## `.github/ISSUE_TEMPLATE/bug_report.md`

```markdown
---
name: Bug report
about: Something is broken
---

**Package**
<!-- e.g. @shadejs/core -->

**ShadeJS version**

**Description**
<!-- What happened vs what you expected -->

**Minimal reproduction**

**Error output**
```

---

## `.editorconfig`

Create at repo root:

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false
```

---

## `.github/CODEOWNERS`

```
* @YOUR_GITHUB_USERNAME
```

---

## Execution Order for Git/CI Setup

Do this BEFORE Phase 1 of PRODUCTION_ROADMAP.md:

```bash
# 1. Create and switch to first branch
git checkout -b phase/0-git-cicd-setup

# 2. Create all files listed in this document
# 3. Stage and commit
git add .
git commit -m "chore(ci): add git workflow, ci/cd, branch protection, changelog"

# 4. Push and open PR to main
git push origin phase/0-git-cicd-setup
# merge via GitHub PR UI, not git merge

# 5. After merge, pull main and create next branch
git checkout main && git pull
git checkout -b phase/1-effect-disposal
```

Repeat this branch → commit → PR → merge cycle for every phase in PRODUCTION_ROADMAP.md.

---

## Summary of files to create

```
.github/
  workflows/
    ci.yml
    release.yml
    pr-check.yml
  PULL_REQUEST_TEMPLATE.md
  ISSUE_TEMPLATE/
    bug_report.md
  branch-protection.md
  CODEOWNERS
.editorconfig
CHANGELOG.md
```

