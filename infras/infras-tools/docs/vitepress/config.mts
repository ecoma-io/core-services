import { withMermaid } from 'vitepress-plugin-mermaid';

// https://vitepress.dev/reference/site-config
export default withMermaid({
  // base: '/docs',
  title: 'Ecoma Core',
  description: 'Core Product Document',
  themeConfig: {
    nav: [
      { text: 'HyperDX', link: 'https://hyperdx.fbi.com' },
      { text: 'Postgres', link: 'https://postgres.fbi.com' },
      { text: 'MongoDB', link: 'https://mongodb.fbi.com' },
      { text: 'Redis', link: 'https://redis.fbi.com' },
      { text: 'ElasticSearch', link: 'https://elastic.fbi.com' },
      { text: 'RabbitMQ', link: 'https://rabbitmq.fbi.com' },
      { text: 'EventStoreDB', link: 'https://events.fbi.com' },
      { text: 'ClickHouse (Commming)', link: '#' },
    ],
    sidebar: [
      { text: 'Getting Started', link: '/docs/getting-started' },
      {
        text: 'IAM',
        items: [
          { text: 'Architecture', link: '/docs/iam/iam-architecture.md' },
          { text: 'Ubiquitous Language', link: '/docs/iam/iam-ul.md' },
          { text: 'Domain Model', link: '/docs/iam/iam-domain-model.md' },
          {
            text: 'IDM',
            items: [
              {
                text: 'Architecture',
                link: '/docs/iam/idm/idm-architecture.md',
              },
              {
                text: 'Domain Model',
                link: '/docs/iam/idm/idm-domain-model.md',
              },
              { text: 'Use Cases', link: '/docs/iam/idm/idm-use-cases.md' },
              { text: 'Roadmap', link: '/docs/iam/idm/idm-roadmap.md' },
            ],
          },
          {
            text: 'ACM',
            items: [
              {
                text: 'Architecture',
                link: '/docs/iam/acm/acm-architecture.md',
              },
              {
                text: 'Domain Model',
                link: '/docs/iam/acm/acm-domain-model.md',
              },
              { text: 'Use Cases', link: '/docs/iam/acm/acm-use-cases.md' },
              { text: 'Roadmap', link: '/docs/iam/acm/acm-roadmap.md' },
            ],
          },
          {
            text: 'AZM',
            items: [
              {
                text: 'Architecture',
                link: '/docs/iam/azm/azm-architecture.md',
              },
              {
                text: 'Domain Model',
                link: '/docs/iam/azm/azm-domain-model.md',
              },
              { text: 'Use Cases', link: '/docs/iam/azm/azm-use-cases.md' },
              { text: 'Roadmap', link: '/docs/iam/azm/azm-roadmap.md' },
            ],
          },
          {
            text: 'OCS',
            items: [
              {
                text: 'Architecture',
                link: '/docs/iam/ocs/ocs-architecture.md',
              },
              {
                text: 'Domain Model',
                link: '/docs/iam/ocs/ocs-domain-model.md',
              },
              { text: 'Use Cases', link: '/docs/iam/ocs/ocs-use-cases.md' },
              { text: 'Roadmap', link: '/docs/iam/ocs/ocs-roadmap.md' },
            ],
          },
          { text: 'Roadmap', link: '/docs/iam/iam-roadmap.md' },
        ],
      },
      {
        text: 'RSM',
        items: [
          {
            text: 'Architecture',
            link: '/docs/iam/rsm/rsm-architecture.md',
          },
          {
            text: 'Domain Model',
            link: '/docs/iam/rsm/rsm-domain-model.md',
          },
          { text: 'Use Cases', link: '/docs/iam/rsm/rsm-use-cases.md' },
          { text: 'Roadmap', link: '/docs/iam/rsm/rsm-roadmap.md' },
        ],
      },
      { text: 'CI/CD', link: '/docs/ci-cd' },
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/ecoma-io/core-services' },
    ],
    search: {
      provider: 'local',
    },
    mermaid: {
      // refer https://mermaid.js.org/config/setup/modules/mermaidAPI.html#mermaidapi-configuration-defaults for options
    },
    // optionally set additional config for plugin itself with MermaidPluginConfig
    mermaidPlugin: {
      class: 'mermaid', // set additional css classes for parent container
    },
  },
  rewrites: {
    index: 'docs/index',
  },
  vite: {
    server: {
      allowedHosts: true,
    },
  },
});
