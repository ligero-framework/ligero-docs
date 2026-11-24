# Contributing to Ligero Docs

Thanks for helping! Contributions of any size are welcome — see the
[framework contributing guide](https://github.com/ligero-framework/ligero/blob/main/CONTRIBUTING.md)
for the rules shared by all Ligero repositories.

## How to contribute

1. **Fork** this repository and branch from the latest `main`
   (`feature/<name>`, `fix/<name>`, `docs/<name>`, `chore/<name>`).
2. Keep each pull request to **one logical change**, with imperative commit
   messages.
3. Run `npm ci && npm run build`; the build must finish without broken links.
4. Open a pull request against `main`. CI must be green and a maintainer must
   approve it; pull requests are **squash-merged**.

Nobody pushes to `main` directly: every change lands through a reviewed pull
request. By contributing you agree your work is licensed under the
[Apache License 2.0](LICENSE).

Please read the [Code of Conduct](CODE_OF_CONDUCT.md). Report security problems
privately, as described in [SECURITY.md](SECURITY.md).
