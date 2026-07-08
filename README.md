<div align="center">
  <img src="static/img/Ligero.svg" alt="Ligero" width="140">

  # Ligero Documentation

  The documentation site for the **[Ligero web framework](https://github.com/ligero-framework/ligero)**, built with [Docusaurus](https://docusaurus.io/).

  **[📖 Read the docs →](https://ligero-framework.github.io/ligero-docs/)**
</div>

---

## Local development

```bash
npm install
npm start        # dev server with hot reload at http://localhost:3000
npm run build    # production static site in build/
npm run serve    # serve the built site locally
```

Node 20+ is recommended (matches CI).

## Structure

```
docs/
├── intro.md                 # landing page (hero + overview)
├── learning-path.md         # guided beginner → production route
├── getting-started/         # install, quickstart, CLI
├── guides/                  # task-focused guides, grouped in the sidebar:
│                            #   HTTP Core · Structure & DI · Configuration ·
│                            #   Data · Web & Real-time · Harden & Ship
└── reference/               # modules, architecture, benchmarks
```

- The sidebar layout lives in [`sidebars.js`](sidebars.js).
- Site config (title, nav, theme) is in [`docusaurus.config.js`](docusaurus.config.js).
- Brand assets are in [`static/img/`](static/img/).

## Contributing

1. Add or edit a Markdown file under `docs/`.
2. Reference it from `sidebars.js` (new pages don't appear until they're listed).
3. Run `npm run build` — the build **fails on broken links**, so fix any it reports.
4. Open a PR.

Docs are written in **English**. A Spanish translation may be added later via
[Docusaurus i18n](https://docusaurus.io/docs/i18n/introduction).

## Deployment

Every push to `main` triggers [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml),
which builds the site and publishes it to **GitHub Pages**.

> First-time setup (repo admin): enable **Settings → Pages → Source: GitHub Actions**.
> GitHub Pages on a private repository requires a paid plan; otherwise the repository
> must be public.
