# ShadeJS — Universal Git & CI/CD Standards

This file is permanent. It governs every contribution to this repository forever.
It is not tied to any specific roadmap. It applies to all phases, all packages, all changes.
Read it before writing a single line of code. Follow it without exception.

---

## 1. Branching Strategy

This project uses **GitHub Flow** — one long-lived branch, short-lived feature branches.

```
main                        ← always deployable, always green, always protected
  └── phase/N-description   ← roadmap phases
  └── fix/short-description ← bug fixes
  └── feat/short-description ← features outside a roadmap
  └── chore/description     ← config, deps, tooling
  └── docs/description      ← documentation only
```

### Rules

- **Never commit directly to `main`.** No exceptions. Not even one-line fixes.
- Every unit of work gets its own branch, no matter how small.
- Branch name must match the type of change: `fix/`, `feat/`, `phase/`, `chore/`, `docs/`.
- Branch is merged to `main` only after CI passes and all checklist items are complete.
- Delete the branch immediately after merge. Do not let stale branches accumulate.
- Branch names are lowercase, hyphen-separated, no special characters.

### Branch naming examples

```
phase/19-context-api
fix/query-registry-leak
feat/devtools-signal-inspector
chore/update-vitest-to-v3
docs/router-usage-guide
```

---

## 2. Commit Message Convention

This project follows **Conventional Commits** (https://www.conventionalcommits.org).

### Format

```
<type>(<scope>): <short description>

[optional body — explain WHY, not WHAT]

[optional footer — breaking changes, issue references]
```

### Types

| Type | When to use |
|---|---|
| `feat` | New feature or capability added |
| `fix` | Bug fix |
| `refactor` | Code change with no behavior change |
| `test` | Adding or updating tests only |
| `docs` | Documentation only |
| `chore` | Build, CI, config, dependency changes |
| `perf` | Performance improvement |
| `revert` | Reverting a previous commit |

### Scopes

| Scope | Package / area |
|---|---|
| `core` | `@sarthakdev143/core` |
| `runtime` | `@sarthakdev143/runtime` |
| `state` | `@sarthakdev143/state` |
| `compiler` | `@sarthakdev143/compiler` |
| `router` | `@sarthakdev143/router` |
| `cli` | `create-shadejs` |
| `demo` | `apps/demo` |
| `docs` | `apps/docs` or documentation files |
| `ci` | GitHub Actions workflows |
| `repo` | Root-level config, monorepo setup |

### Rules

- Subject line: max 72 characters
- Imperative mood: `add` not `added`, `fix` not `fixed`, `remove` not `removed`
- No period at end of subject line
- Body explains WHY — the diff shows what changed
- One logical change per commit. Do not bundle unrelated changes.
- Breaking changes must include `BREAKING CHANGE:` in the footer

### Examples

```
feat(core): add dispose() return value to createEffect

Effects need to be stoppable to avoid memory leaks in dynamic
component trees. Without disposal, effects survive component
unmounting and continue reacting to stale data.

feat(router): implement client-side navigation with popstate

fix(state): deduplicate in-flight queries by key

Two simultaneous createQuery calls with the same key were
firing two network requests. They now share one Promise.

test(compiler): add RPC integration coverage

chore(ci): add concurrency cancellation to CI workflow

BREAKING CHANGE: createMutation now returns { mutate, pending, error }
instead of a plain async function. Update all call sites.
```

---

## 3. Pull Request Standards

Every branch is merged via PR. No direct merges to main.

### PR title format

Same as commit message subject line:
```
feat(core): add context API
fix(runtime): dispose anchor node effects on replacement
chore(ci): update pnpm to v10
```

PR titles are validated automatically by `.github/workflows/pr-check.yml`.

### PR size

- Keep PRs focused. One phase = one PR minimum.
- If a phase is large, split it into logical sub-PRs.
- PRs over 800 changed lines should be split unless genuinely impossible.

### Merge strategy

- **Squash and Merge** for all feature/fix/phase branches — keeps main history linear and clean.
- **Merge Commit** only for release PRs where individual commits must be preserved.
- Never Rebase and Merge — rewrites history, breaks git bisect.

---

## 4. GitHub Actions Workflows

Three permanent workflow files. Never modify without a `chore(ci):` PR.

### `.github/workflows/ci.yml`

Runs on every push to every branch and every PR to main.

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
    name: Typecheck · Test · Build
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

### `.github/workflows/release.yml`

Runs when a `v*.*.*` tag is pushed. Publishes all packages to npm.

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

### `.github/workflows/pr-check.yml`

Validates PR title on every PR open/edit.

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
            revert
          scopes: |
            core
            runtime
            state
            compiler
            router
            cli
            demo
            docs
            ci
            repo
```

---

## 5. Branch Protection

Set manually in GitHub: Repository → Settings → Branches → Add rule → `main`

```
✅ Require a pull request before merging
✅ Require status checks to pass before merging
     Required: CI / Typecheck · Test · Build
✅ Require branches to be up to date before merging
✅ Do not allow bypassing the above settings
❌ Allow force pushes
❌ Allow deletions
```

---

## 6. Versioning

Follows **Semantic Versioning**: `MAJOR.MINOR.PATCH`

- `PATCH` — bug fixes, no API change
- `MINOR` — new features, backwards compatible
- `MAJOR` — breaking API changes

### Lockstep rule

All packages always publish at the same version. When one bumps, all bump.

### Release process

```bash
# 1. Create release branch
git checkout -b chore/release-vX.Y.Z

# 2. Bump all packages
pnpm -r exec npm version minor   # or patch / major

# 3. Update CHANGELOG.md — move [Unreleased] to new version with today's date

# 4. Commit and PR
git add -A
git commit -m "chore(repo): bump version to vX.Y.Z"
# open PR → merge

# 5. Tag from main
git checkout main && git pull
git tag vX.Y.Z
git push origin vX.Y.Z
# release.yml fires automatically
```

---

## 7. CHANGELOG

`CHANGELOG.md` at repo root. Updated in every PR that changes behavior.

```markdown
# Changelog

## [Unreleased]

### Added
### Fixed
### Changed
### Removed
### Breaking Changes

## [0.2.0] - 2026-03-21
### Added
- ...
```

### Rules

- Every `feat`, `fix`, `perf`, or breaking change PR must update `[Unreleased]`.
- `chore`, `test`, `docs`, `ci` PRs do not need a CHANGELOG entry.
- Be specific: "Fix queryRegistry not releasing entries on disposal" not "Fix bug".
- On release: rename `[Unreleased]` → `[X.Y.Z] - YYYY-MM-DD`, add new empty `[Unreleased]` above.

---

## 8. Code Standards

### TypeScript

- `"strict": true` everywhere. Non-negotiable.
- Zero `any`. Use generics or `unknown`.
- No `@ts-ignore` without a comment explaining why.
- All exported functions have explicit return types.

### Testing

- Every new behavior gets a test. No exceptions.
- Tests live in `packages/<package>/tests/`.
- Test names are full sentences: `"createEffect re-runs when dependency changes"`.
- Tests are independent. No shared mutable state between tests. Reset in `beforeEach`.
- `pnpm test` must pass with zero failures before any PR is opened.

### File hygiene

- No `console.log` in source files. Use proper error handlers.
- No commented-out code committed. Delete it or don't commit it.
- No dead imports.
- One concept per file.
- Only `index.ts` is the public export surface. Never import from internal files across packages.

### Dependencies

- Add with `pnpm add <pkg> --filter <package>`. Never edit `package.json` manually for deps.
- Core packages have zero runtime dependencies by design. Justify any addition.
- Dev dependencies go in `devDependencies`. Never mix.

---

## 9. Pre-merge Checklist

Verify all of these before opening any PR:

```
- [ ] pnpm test          → zero failures
- [ ] pnpm typecheck     → zero errors
- [ ] pnpm build         → all packages build cleanly
- [ ] pnpm dev           → demo app starts and functions correctly
- [ ] New behavior has tests
- [ ] CHANGELOG.md updated (if behavior changed)
- [ ] Commit messages follow Conventional Commits
- [ ] Branch is up to date with main
- [ ] No console.log in source files
- [ ] No commented-out code in source files
- [ ] No `any` introduced
- [ ] No new runtime dependencies added without justification
```

---

## 10. What Never Goes in This Repo

- Secrets, tokens, API keys — use GitHub Secrets for CI, `.env` for local
- Built output (`dist/`) — gitignored
- `node_modules/` — gitignored
- OS files (`.DS_Store`, `Thumbs.db`) — covered by `.gitignore`
- Unresolved lock file conflicts — always resolve `pnpm-lock.yaml` properly
- Direct pushes to `main`

---

## 11. The Loop

Every unit of work — bug fix, feature, phase, chore — follows this loop exactly.

```
1.  git checkout main && git pull
2.  git checkout -b <type>/<description>
3.  Write code
4.  Write tests
5.  pnpm test && pnpm typecheck && pnpm build && pnpm dev
6.  Update CHANGELOG.md if behavior changed
7.  git add -A && git commit -m "<type>(<scope>): <description>"
8.  git push origin <branch>
9.  Open PR with filled template
10. CI passes
11. Squash and merge
12. git branch -d <branch>
13. Back to step 1
```

No shortcuts. No exceptions.
