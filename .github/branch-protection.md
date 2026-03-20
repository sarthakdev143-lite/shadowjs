# Branch Protection - main

Settings to apply in GitHub repo settings:

- Require a pull request before merging: YES
- Require status checks to pass before merging: YES
  - Required checks: CI / Typecheck, Test, Build
- Require branches to be up to date before merging: YES
- Do not allow bypassing the above settings: YES
- Allow force pushes: NO
- Allow deletions: NO
