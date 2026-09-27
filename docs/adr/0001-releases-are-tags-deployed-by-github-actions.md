# Releases are tags, deployed by a GitHub Action

Every merge to `main` cuts a `vX.Y.Z` tag, unless its commit message contains
`[skip release]`, and the Release workflow deploys that exact tag: the frontend
to Vercel with its CLI, the backend to Render with a deploy hook. Vercel and
Render only auto-deploy from branches, not tags, so both platforms' production
auto-deploy is turned off and the Action is the single deployer. That keeps "tag
= production" true, and it is also why the PR's squash-commit subject decides
the version bump. Details: [`docs/RELEASE.md`](../RELEASE.md).
