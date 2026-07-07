// @ts-check
/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  docs: [
    'intro',
    {
      type: 'category',
      label: 'Getting Started',
      items: ['getting-started/installation', 'getting-started/quickstart', 'getting-started/cli'],
    },
    {
      type: 'category',
      label: 'Guides',
      items: [
        'guides/routing',
        'guides/context',
        'guides/middleware',
        'guides/error-handling',
        'guides/configuration',
        'guides/security',
        'guides/observability',
        'guides/realtime',
        'guides/templates',
        'guides/openapi',
        'guides/testing',
        'guides/engines',
        'guides/dependency-injection',
        'guides/architecture',
        'guides/devtools',
        'guides/configuration-yaml',
        'guides/data',
        'guides/scaling',
      ],
    },
    {
      type: 'category',
      label: 'Reference',
      items: ['reference/modules', 'reference/architecture', 'reference/benchmarks'],
    },
  ],
};

export default sidebars;
