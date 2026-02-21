import path from 'path';
import url from 'url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

/** @type {import('@eventcatalog/core/bin/eventcatalog.config').Config} */
export default {
  title: 'OurLogix',
  tagline: 'A comprehensive logistics and shipping management company',
  organizationName: 'OurLogix',
  homepageLink: 'https://eventcatalog.dev/',
  landingPage: '',
  editUrl: 'https://github.com/boyney123/eventcatalog-demo/edit/master',
  trailingSlash: false,
  base: '/',
  logo: {
    alt: 'EventCatalog Logo',
    src: '/logo.png',
    text: 'OurLogix',
  },
  docs: {
    sidebar: {
      showPageHeadings: true,
    },
  },
  generators: [
    // ──────────────────────────────────────────────
    // YAML mode: read local compass.yml files
    // ──────────────────────────────────────────────
    [
      '@ismaelmartinez/generator-atlassian-compass-event-catalog',
      {
        // List of local compass.yml files to process
        services: [
          {
            path: path.join(__dirname, 'src', 'test', 'my-service-compass.yml'),
            version: '0.0.1', // optional, defaults to '0.0.0'
            // id: 'custom-service-id', // optional, overrides name from YAML
          },
          {
            path: path.join(__dirname, 'src', 'test', 'my-application-compass.yml'),
          },
        ],

        // Required: base URL for Compass component links
        compassUrl: 'https://mysite.atlassian.net/compass',

        // Optional: group services under a domain (created if it doesn't exist)
        domain: { id: 'orders', name: 'Orders Domain', version: '0.0.1' },

        // Optional: only process components of these types
        // typeFilter: ['SERVICE', 'APPLICATION'],

        // Optional: skip updating services that already exist in the catalog
        // overrideExisting: false,

        // Optional: output format — 'mdx' (default) or 'md'
        // format: 'md',

        // Optional: how service IDs are derived — 'name' (default), 'compass-id', or a function
        // serviceIdStrategy: 'name',
        // serviceIdStrategy: (config) => `prefix-${config.name}`,

        // Optional: custom markdown template for service pages
        // markdownTemplate: (config, dependencies) => {
        //   const depList = dependencies.map(d => d.name).join(', ') || 'none';
        //   return `# ${config.name}\n\nDepends on: ${depList}`;
        // },

        // Optional: preview changes without writing files
        // dryRun: true,

        // Optional: enable debug logging (credentials are redacted)
        // debug: true,
      },
    ],

    // ──────────────────────────────────────────────
    // API mode: fetch components from Compass GraphQL API
    // ──────────────────────────────────────────────
    // [
    //   '@ismaelmartinez/generator-atlassian-compass-event-catalog',
    //   {
    //     api: {
    //       cloudId: '$COMPASS_CLOUD_ID',        // supports $ENV_VAR syntax
    //       apiToken: '$COMPASS_API_TOKEN',
    //       email: '$COMPASS_EMAIL',
    //       baseUrl: 'https://mysite.atlassian.net', // must be HTTPS
    //       typeFilter: ['SERVICE'],              // optional server-side filtering
    //     },
    //
    //     compassUrl: 'https://mysite.atlassian.net/compass',
    //
    //     // All the same options as YAML mode are available:
    //     // domain, typeFilter, overrideExisting, format,
    //     // serviceIdStrategy, markdownTemplate, dryRun, debug
    //   },
    // ],
  ],
};
