// @ts-check
/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  docs: [
    'intro',
    'learning-path',
    {
      type: 'category',
      label: 'Getting Started',
      collapsed: false,
      items: [
        'getting-started/installation',
        'getting-started/quickstart',
        'getting-started/cli',
      ],
    },
    {
      type: 'category',
      label: 'HTTP Core',
      items: [
        'guides/routing',
        'guides/context',
        'guides/middleware',
        'guides/error-handling',
      ],
    },
    {
      type: 'category',
      label: 'Structure & DI',
      items: [
        'guides/dependency-injection',
        'guides/architecture',
        'guides/events',
        'guides/devtools',
      ],
    },
    {
      type: 'category',
      label: 'Configuration',
      items: [
        'guides/configuration',
        'guides/configuration-yaml',
      ],
    },
    {
      type: 'category',
      label: 'Data',
      items: [
        'guides/data',
      ],
    },
    {
      type: 'category',
      label: 'Web & Real-time',
      items: [
        'guides/templates',
        'guides/realtime',
        'guides/openapi',
      ],
    },
    {
      type: 'category',
      label: 'Harden & Ship',
      items: [
        'guides/security',
        'guides/auth-asymmetric',
        'guides/testing',
        'guides/observability',
        'guides/engines',
        'guides/scaling',
      ],
    },
    {
      type: 'category',
      label: 'Going to production',
      items: [
        'guides/scheduler',
        'guides/cache',
        'guides/resilience',
        'guides/jdbc-pooling',
        'guides/native-image',
      ],
    },
    {
      type: 'category',
      label: 'Reference',
      items: [
        'reference/modules',
        'reference/architecture',
        'reference/benchmarks',
      ],
    },
  ],
};

export default sidebars;
