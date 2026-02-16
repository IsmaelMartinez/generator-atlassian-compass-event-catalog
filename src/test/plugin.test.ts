import { expect, it, describe, beforeEach, afterEach } from 'vitest';
import utils from '@eventcatalog/sdk';
import plugin from '../index';
import { join } from 'node:path';
import fs from 'fs/promises';

// Fake eventcatalog config
const eventCatalogConfig = {
  title: 'My EventCatalog',
  homepageLink: 'https://bananas',
};

let catalogDir: string;

const expectedMarkdown = `## Links

* 🧭 [Compass Component](https://compass.atlassian.com/component/00000000-0000-0000-0000-000000000000)
* 🪂 [Compass Team](https://compass.atlassian.com/people/team/00000000-0000-0000-0000-000000000000)
* 🚀 [My Jira project](https://www.example.com/projects/myproject)
* 👀 [Service dashboard](https://www.example.com/dashboards/service-dashboard)
* 🏡 [Service repository](https://www.example.com/repos/my-service-repo)

## Dependencies

No known dependencies.

## Architecture diagram

<NodeGraph />`;

const expectedBadges = [
  { content: 'SERVICE', backgroundColor: '#6366f1', textColor: '#fff' },
  { content: 'Active', backgroundColor: '#22c55e', textColor: '#fff' },
  { content: 'Tier 1', backgroundColor: '#3b82f6', textColor: '#fff' },
  { content: 'foo:bar', backgroundColor: '#e5e7eb', textColor: '#374151' },
  { content: 'baz', backgroundColor: '#e5e7eb', textColor: '#374151' },
];

const expectedRepository = { url: 'https://www.example.com/repos/my-service-repo' };
const expectedOwners = ['00000000-0000-0000-0000-000000000000'];

describe('Atlassian Compass generator tests', () => {
  beforeEach(() => {
    catalogDir = join(__dirname, 'catalog') || '';
    process.env.PROJECT_DIR = catalogDir;
  });

  afterEach(async () => {
    await fs.rm(join(catalogDir), { recursive: true, force: true });
  });

  it('creates a test service in the catalog for the domain', async () => {
    const { getService, getDomain } = utils(catalogDir);
    // Create the domain and service
    await plugin(eventCatalogConfig, {
      services: [
        {
          path: join(__dirname, 'my-service-compass.yml'),
        },
      ],
      compassUrl: 'https://compass.atlassian.com',
      domain: {
        id: 'my-domain',
        name: 'My Domain',
        version: '0.0.1',
      },
    });

    // Validate the domain is created
    const domain = await getDomain('my-domain', '0.0.1');
    expect(domain).toBeDefined();

    expect(domain).toEqual({
      id: 'my-domain',
      markdown: `## Architecture diagram
  <NodeGraph />`,
      name: 'My Domain',
      version: '0.0.1',
      services: [{ id: 'my-service', version: '0.0.0' }],
    });

    // Check that the service is created
    const service = await getService('my-service');
    expect(service).toBeDefined();

    expect(service).toEqual({
      id: 'my-service',
      markdown: expectedMarkdown,
      name: 'my-service',
      summary: 'This is a sample component in Compass.',
      version: '0.0.0',
      badges: expectedBadges,
      repository: expectedRepository,
      owners: expectedOwners,
    });
  });

  it('creates a versioned service in the catalog for the domain', async () => {
    const { getService, getDomain } = utils(catalogDir);
    // Create the domain and service
    await plugin(eventCatalogConfig, {
      services: [
        {
          path: join(__dirname, 'my-service-compass.yml'),
          version: '0.0.1',
        },
      ],
      compassUrl: 'https://compass.atlassian.com',
      domain: {
        id: 'my-domain',
        name: 'My Domain',
        version: '0.0.1',
      },
    });

    // Validate the domain is created
    const domain = await getDomain('my-domain', '0.0.1');
    expect(domain).toBeDefined();

    expect(domain).toEqual({
      id: 'my-domain',
      markdown: `## Architecture diagram
  <NodeGraph />`,
      name: 'My Domain',
      version: '0.0.1',
      services: [{ id: 'my-service', version: '0.0.1' }],
    });

    // Check that the service is created
    const service = await getService('my-service');
    expect(service).toBeDefined();

    expect(service).toEqual({
      id: 'my-service',
      markdown: expectedMarkdown,
      name: 'my-service',
      summary: 'This is a sample component in Compass.',
      version: '0.0.1',
      badges: expectedBadges,
      repository: expectedRepository,
      owners: expectedOwners,
    });
  });

  it('creates an id service in the catalog for the domain', async () => {
    const { getService, getDomain } = utils(catalogDir);
    // Create the domain and service
    await plugin(eventCatalogConfig, {
      services: [
        {
          path: join(__dirname, 'my-service-compass.yml'),
          id: 'bananas',
        },
      ],
      compassUrl: 'https://compass.atlassian.com',
      domain: {
        id: 'my-domain',
        name: 'My Domain',
        version: '0.0.1',
      },
    });

    // Validate the domain is created
    const domain = await getDomain('my-domain', '0.0.1');
    expect(domain).toBeDefined();

    expect(domain).toEqual({
      id: 'my-domain',
      markdown: `## Architecture diagram
  <NodeGraph />`,
      name: 'My Domain',
      version: '0.0.1',
      services: [{ id: 'bananas', version: '0.0.0' }],
    });

    // Check that the service is created
    const service = await getService('bananas');
    expect(service).toBeDefined();

    expect(service).toEqual({
      id: 'bananas',
      markdown: expectedMarkdown,
      name: 'my-service',
      summary: 'This is a sample component in Compass.',
      version: '0.0.0',
      badges: expectedBadges,
      repository: expectedRepository,
      owners: expectedOwners,
    });
  });

  it('updates a domain version, but services are still available', async () => {
    const { getService, getDomain } = utils(catalogDir);

    // Create the domain and service
    await plugin(eventCatalogConfig, {
      services: [{ path: join(__dirname, 'my-service-compass.yml') }],
      compassUrl: 'https://compass.atlassian.com',
      domain: {
        id: 'my-domain',
        name: 'My Domain',
        version: '0.0.1',
      },
    });

    // Update the domain
    await plugin(eventCatalogConfig, {
      services: [{ path: join(__dirname, 'my-service-compass.yml') }],
      compassUrl: 'https://compass.atlassian.com',
      domain: {
        id: 'my-domain',
        name: 'My Domain',
        version: '0.0.2',
      },
    });

    // Validate the domain is created
    let domain = await getDomain('my-domain', '0.0.1');
    expect(domain).toBeDefined();

    // Validate the domain is updated
    domain = await getDomain('my-domain', '0.0.2');
    expect(domain).toBeDefined();

    expect(domain).toEqual({
      id: 'my-domain',
      markdown: `## Architecture diagram
  <NodeGraph />`,
      name: 'My Domain',
      version: '0.0.2',
      services: [{ id: 'my-service', version: '0.0.0' }],
    });

    // Check that the service is created
    const service = await getService('my-service');
    expect(service).toBeDefined();

    expect(service).toEqual({
      id: 'my-service',
      markdown: expectedMarkdown,
      name: 'my-service',
      summary: 'This is a sample component in Compass.',
      version: '0.0.0',
      badges: expectedBadges,
      repository: expectedRepository,
      owners: expectedOwners,
    });
  });

  describe('all Compass component types', () => {
    it('processes APPLICATION type components', async () => {
      const { getService } = utils(catalogDir);

      await plugin(eventCatalogConfig, {
        services: [{ path: join(__dirname, 'my-application-compass.yml') }],
        compassUrl: 'https://compass.atlassian.com',
      });

      const service = await getService('my-application');
      expect(service).toBeDefined();
      expect(service.name).toBe('my-application');
      expect(service.summary).toBe('This is a sample application component in Compass.');
    });

    it('processes LIBRARY type components', async () => {
      const { getService } = utils(catalogDir);

      await plugin(eventCatalogConfig, {
        services: [{ path: join(__dirname, 'my-library-compass.yml') }],
        compassUrl: 'https://compass.atlassian.com',
      });

      const service = await getService('my-library');
      expect(service).toBeDefined();
      expect(service.name).toBe('my-library');
      expect(service.summary).toBe('This is a sample library component in Compass.');
    });

    it('processes CAPABILITY type components', async () => {
      const { getService } = utils(catalogDir);

      await plugin(eventCatalogConfig, {
        services: [{ path: join(__dirname, 'my-capability-compass.yml') }],
        compassUrl: 'https://compass.atlassian.com',
      });

      const service = await getService('my-capability');
      expect(service).toBeDefined();
      expect(service.name).toBe('my-capability');
      expect(service.summary).toBe('This is a sample capability component in Compass.');
    });

    it('processes OTHER type components (previously rejected)', async () => {
      const { getService } = utils(catalogDir);

      await plugin(eventCatalogConfig, {
        services: [{ path: join(__dirname, 'my-other-compass.notsupported.yml') }],
        compassUrl: 'https://compass.atlassian.com',
      });

      const service = await getService('my-other-component');
      expect(service).toBeDefined();
      expect(service.name).toBe('my-other-component');
    });

    it('processes multiple component types together', async () => {
      const { getService } = utils(catalogDir);

      await plugin(eventCatalogConfig, {
        services: [
          { path: join(__dirname, 'my-service-compass.yml') },
          { path: join(__dirname, 'my-application-compass.yml') },
          { path: join(__dirname, 'my-library-compass.yml') },
        ],
        compassUrl: 'https://compass.atlassian.com',
      });

      const svc = await getService('my-service');
      const app = await getService('my-application');
      const lib = await getService('my-library');
      expect(svc).toBeDefined();
      expect(app).toBeDefined();
      expect(lib).toBeDefined();
    });
  });

  describe('component type badge for non-SERVICE types', () => {
    it('adds APPLICATION badge for APPLICATION type', async () => {
      const { getService } = utils(catalogDir);

      await plugin(eventCatalogConfig, {
        services: [{ path: join(__dirname, 'my-application-compass.yml') }],
        compassUrl: 'https://compass.atlassian.com',
      });

      const service = await getService('my-application');
      expect(service).toBeDefined();
      expect(service.badges).toContainEqual({
        content: 'APPLICATION',
        backgroundColor: '#6366f1',
        textColor: '#fff',
      });
    });

    it('adds LIBRARY badge for LIBRARY type', async () => {
      const { getService } = utils(catalogDir);

      await plugin(eventCatalogConfig, {
        services: [{ path: join(__dirname, 'my-library-compass.yml') }],
        compassUrl: 'https://compass.atlassian.com',
      });

      const service = await getService('my-library');
      expect(service).toBeDefined();
      expect(service.badges).toContainEqual({
        content: 'LIBRARY',
        backgroundColor: '#6366f1',
        textColor: '#fff',
      });
    });

    it('adds CAPABILITY badge for CAPABILITY type', async () => {
      const { getService } = utils(catalogDir);

      await plugin(eventCatalogConfig, {
        services: [{ path: join(__dirname, 'my-capability-compass.yml') }],
        compassUrl: 'https://compass.atlassian.com',
      });

      const service = await getService('my-capability');
      expect(service).toBeDefined();
      expect(service.badges).toContainEqual({
        content: 'CAPABILITY',
        backgroundColor: '#6366f1',
        textColor: '#fff',
      });
    });
  });

  describe('typeFilter', () => {
    it('only processes components matching typeFilter', async () => {
      const { getService } = utils(catalogDir);

      await plugin(eventCatalogConfig, {
        services: [
          { path: join(__dirname, 'my-service-compass.yml') },
          { path: join(__dirname, 'my-application-compass.yml') },
          { path: join(__dirname, 'my-library-compass.yml') },
        ],
        compassUrl: 'https://compass.atlassian.com',
        typeFilter: ['SERVICE', 'APPLICATION'],
      });

      const svc = await getService('my-service');
      const app = await getService('my-application');
      const lib = await getService('my-library');
      expect(svc).toBeDefined();
      expect(app).toBeDefined();
      expect(lib).not.toBeDefined();
    });

    it('excludes components not in typeFilter', async () => {
      const { getService } = utils(catalogDir);

      await plugin(eventCatalogConfig, {
        services: [{ path: join(__dirname, 'my-service-compass.yml') }, { path: join(__dirname, 'my-application-compass.yml') }],
        compassUrl: 'https://compass.atlassian.com',
        typeFilter: ['APPLICATION'],
      });

      const svc = await getService('my-service');
      const app = await getService('my-application');
      expect(svc).not.toBeDefined();
      expect(app).toBeDefined();
    });

    it('processes all types when typeFilter is not set', async () => {
      const { getService } = utils(catalogDir);

      await plugin(eventCatalogConfig, {
        services: [
          { path: join(__dirname, 'my-service-compass.yml') },
          { path: join(__dirname, 'my-application-compass.yml') },
          { path: join(__dirname, 'my-library-compass.yml') },
        ],
        compassUrl: 'https://compass.atlassian.com',
      });

      const svc = await getService('my-service');
      const app = await getService('my-application');
      const lib = await getService('my-library');
      expect(svc).toBeDefined();
      expect(app).toBeDefined();
      expect(lib).toBeDefined();
    });

    it('processes all types when typeFilter is empty array', async () => {
      const { getService } = utils(catalogDir);

      await plugin(eventCatalogConfig, {
        services: [{ path: join(__dirname, 'my-service-compass.yml') }, { path: join(__dirname, 'my-application-compass.yml') }],
        compassUrl: 'https://compass.atlassian.com',
        typeFilter: [],
      });

      const svc = await getService('my-service');
      const app = await getService('my-application');
      expect(svc).toBeDefined();
      expect(app).toBeDefined();
    });
  });

  describe('service badges and metadata', () => {
    let service: Awaited<ReturnType<ReturnType<typeof utils>['getService']>>;

    beforeEach(async () => {
      const { getService } = utils(catalogDir);

      await plugin(eventCatalogConfig, {
        services: [{ path: join(__dirname, 'my-service-compass.yml') }],
        compassUrl: 'https://compass.atlassian.com',
      });

      service = await getService('my-service');
    });

    it('generates component type badge from typeId', () => {
      expect(service).toBeDefined();
      expect(service.badges).toContainEqual({
        content: 'SERVICE',
        backgroundColor: '#6366f1',
        textColor: '#fff',
      });
    });

    it('generates lifecycle badge from fields.lifecycle', () => {
      expect(service).toBeDefined();
      expect(service.badges).toContainEqual({
        content: 'Active',
        backgroundColor: '#22c55e',
        textColor: '#fff',
      });
    });

    it('generates tier badge from fields.tier', () => {
      expect(service).toBeDefined();
      expect(service.badges).toContainEqual({
        content: 'Tier 1',
        backgroundColor: '#3b82f6',
        textColor: '#fff',
      });
    });

    it('generates one badge per label', () => {
      expect(service).toBeDefined();
      expect(service.badges).toContainEqual({
        content: 'foo:bar',
        backgroundColor: '#e5e7eb',
        textColor: '#374151',
      });
      expect(service.badges).toContainEqual({
        content: 'baz',
        backgroundColor: '#e5e7eb',
        textColor: '#374151',
      });
    });

    it('maps repository link to service repository', () => {
      expect(service).toBeDefined();
      expect(service.repository).toEqual({ url: 'https://www.example.com/repos/my-service-repo' });
    });

    it('maps ownerId to service owners', () => {
      expect(service).toBeDefined();
      expect(service.owners).toEqual(['00000000-0000-0000-0000-000000000000']);
    });
  });

  describe('overrideExisting', () => {
    it('updates existing services by default (overrideExisting defaults to true)', async () => {
      const { getService } = utils(catalogDir);

      // Create the service first
      await plugin(eventCatalogConfig, {
        services: [{ path: join(__dirname, 'my-service-compass.yml') }],
        compassUrl: 'https://compass.atlassian.com',
      });

      const service1 = await getService('my-service');
      expect(service1).toBeDefined();

      // Run again - should update, not skip
      await plugin(eventCatalogConfig, {
        services: [{ path: join(__dirname, 'my-service-compass.yml') }],
        compassUrl: 'https://compass.atlassian.com',
      });

      const service2 = await getService('my-service');
      expect(service2).toBeDefined();
      expect(service2.name).toBe('my-service');
    });

    it('skips existing services when overrideExisting is false', async () => {
      const { getService, writeService } = utils(catalogDir);

      // Create the service first with a custom summary
      await writeService({
        id: 'my-service',
        name: 'my-service',
        version: '0.0.0',
        summary: 'Original summary',
        markdown: 'Original markdown',
      });

      const original = await getService('my-service');
      expect(original.summary).toBe('Original summary');

      // Run plugin with overrideExisting: false
      await plugin(eventCatalogConfig, {
        services: [{ path: join(__dirname, 'my-service-compass.yml') }],
        compassUrl: 'https://compass.atlassian.com',
        overrideExisting: false,
      });

      // Service should still have original summary
      const service = await getService('my-service');
      expect(service.summary).toBe('Original summary');
    });
  });

  describe('Zod validation', () => {
    it('throws validation error when compassUrl is empty', async () => {
      await expect(
        plugin(eventCatalogConfig, {
          services: [{ path: join(__dirname, 'my-service-compass.yml') }],
          compassUrl: '',
        })
      ).rejects.toThrow();
    });

    it('throws validation error when compassUrl is not a valid URL', async () => {
      await expect(
        plugin(eventCatalogConfig, {
          services: [{ path: join(__dirname, 'my-service-compass.yml') }],
          compassUrl: 'not-a-url',
        })
      ).rejects.toThrow();
    });

    it('throws validation error when services array is empty', async () => {
      await expect(
        plugin(eventCatalogConfig, {
          services: [],
          compassUrl: 'https://compass.atlassian.com',
        })
      ).rejects.toThrow();
    });

    it('throws validation error when service path is empty', async () => {
      await expect(
        plugin(eventCatalogConfig, {
          services: [{ path: '' }],
          compassUrl: 'https://compass.atlassian.com',
        })
      ).rejects.toThrow();
    });

    it('throws validation error when neither services nor api is provided', async () => {
      await expect(
        plugin(eventCatalogConfig, {
          compassUrl: 'https://compass.atlassian.com',
        })
      ).rejects.toThrow();
    });

    it('throws validation error when both services and api are provided', async () => {
      await expect(
        plugin(eventCatalogConfig, {
          services: [{ path: join(__dirname, 'my-service-compass.yml') }],
          api: {
            cloudId: 'test',
            apiToken: 'test',
            email: 'test@example.com',
            baseUrl: 'https://test.atlassian.net',
          },
          compassUrl: 'https://compass.atlassian.com',
        })
      ).rejects.toThrow();
    });
  });

  describe('relationship mapping (DEPENDS_ON)', () => {
    it('resolves dependencies between services processed together', async () => {
      const { getService } = utils(catalogDir);

      // my-service DEPENDS_ON my-application and my-library
      // my-application DEPENDS_ON my-library
      await plugin(eventCatalogConfig, {
        services: [
          { path: join(__dirname, 'my-service-compass.yml') },
          { path: join(__dirname, 'my-application-compass.yml') },
          { path: join(__dirname, 'my-library-compass.yml') },
        ],
        compassUrl: 'https://compass.atlassian.com',
      });

      const service = await getService('my-service');
      expect(service).toBeDefined();
      // my-service depends on my-application and my-library
      expect(service.markdown).toContain('## Dependencies');
      expect(service.markdown).toContain('[my-application](/docs/services/my-application)');
      expect(service.markdown).toContain('[my-library](/docs/services/my-library)');
    });

    it('resolves partial dependencies when only some targets are processed', async () => {
      const { getService } = utils(catalogDir);

      // my-service DEPENDS_ON my-application and my-library, but only my-application is processed
      await plugin(eventCatalogConfig, {
        services: [{ path: join(__dirname, 'my-service-compass.yml') }, { path: join(__dirname, 'my-application-compass.yml') }],
        compassUrl: 'https://compass.atlassian.com',
      });

      const service = await getService('my-service');
      expect(service).toBeDefined();
      expect(service.markdown).toContain('[my-application](/docs/services/my-application)');
      // my-library was not processed, so it should not appear as a resolved dependency link
      expect(service.markdown).not.toContain('[my-library]');
    });

    it('shows "No known dependencies" for services without DEPENDS_ON', async () => {
      const { getService } = utils(catalogDir);

      // my-library has no DEPENDS_ON relationships
      await plugin(eventCatalogConfig, {
        services: [{ path: join(__dirname, 'my-library-compass.yml') }],
        compassUrl: 'https://compass.atlassian.com',
      });

      const service = await getService('my-library');
      expect(service).toBeDefined();
      expect(service.markdown).toContain('## Dependencies');
      expect(service.markdown).toContain('No known dependencies.');
    });

    it('handles missing dependency targets gracefully without crashing', async () => {
      const { getService } = utils(catalogDir);

      // my-other-component has DEPENDS_ON referencing my-application (exists) and a non-existent ARN
      await plugin(eventCatalogConfig, {
        services: [
          { path: join(__dirname, 'my-other-compass.notsupported.yml') },
          { path: join(__dirname, 'my-application-compass.yml') },
        ],
        compassUrl: 'https://compass.atlassian.com',
      });

      const service = await getService('my-other-component');
      expect(service).toBeDefined();
      // Should resolve the one that exists
      expect(service.markdown).toContain('[my-application](/docs/services/my-application)');
      // Should not crash due to the non-existent dependency
    });

    it('resolves dependencies correctly when services have custom IDs', async () => {
      const { getService } = utils(catalogDir);

      await plugin(eventCatalogConfig, {
        services: [
          { path: join(__dirname, 'my-service-compass.yml'), id: 'custom-service' },
          { path: join(__dirname, 'my-application-compass.yml'), id: 'custom-app' },
          { path: join(__dirname, 'my-library-compass.yml'), id: 'custom-lib' },
        ],
        compassUrl: 'https://compass.atlassian.com',
      });

      const service = await getService('custom-service');
      expect(service).toBeDefined();
      // Dependencies should use custom IDs
      expect(service.markdown).toContain('[my-application](/docs/services/custom-app)');
      expect(service.markdown).toContain('[my-library](/docs/services/custom-lib)');
    });

    it('includes resolved dependencies in service markdown within a domain', async () => {
      const { getService, getDomain } = utils(catalogDir);

      await plugin(eventCatalogConfig, {
        services: [
          { path: join(__dirname, 'my-service-compass.yml') },
          { path: join(__dirname, 'my-application-compass.yml') },
          { path: join(__dirname, 'my-library-compass.yml') },
        ],
        compassUrl: 'https://compass.atlassian.com',
        domain: {
          id: 'my-domain',
          name: 'My Domain',
          version: '0.0.1',
        },
      });

      const domain = await getDomain('my-domain', '0.0.1');
      expect(domain).toBeDefined();
      expect(domain.services).toHaveLength(3);

      const service = await getService('my-service');
      expect(service).toBeDefined();
      expect(service.markdown).toContain('## Dependencies');
      expect(service.markdown).toContain('[my-application](/docs/services/my-application)');
      expect(service.markdown).toContain('[my-library](/docs/services/my-library)');
    });
  });

  describe('Phase 5: custom markdown templates', () => {
    it('uses custom markdownTemplate when provided', async () => {
      const { getService } = utils(catalogDir);

      await plugin(eventCatalogConfig, {
        services: [{ path: join(__dirname, 'my-service-compass.yml') }],
        compassUrl: 'https://compass.atlassian.com',
        markdownTemplate: (config, deps) => {
          return `# Custom: ${config.name}\nDeps: ${deps.length}`;
        },
      });

      const service = await getService('my-service');
      expect(service).toBeDefined();
      expect(service.markdown).toBe('# Custom: my-service\nDeps: 0');
      expect(service.markdown).not.toContain('## Links');
    });

    it('passes resolved dependencies to custom markdownTemplate', async () => {
      const { getService } = utils(catalogDir);

      await plugin(eventCatalogConfig, {
        services: [
          { path: join(__dirname, 'my-service-compass.yml') },
          { path: join(__dirname, 'my-application-compass.yml') },
          { path: join(__dirname, 'my-library-compass.yml') },
        ],
        compassUrl: 'https://compass.atlassian.com',
        markdownTemplate: (config, deps) => {
          const depNames = deps.map((d) => d.name).join(', ');
          return `Service: ${config.name}\nDepends on: ${depNames || 'none'}`;
        },
      });

      const service = await getService('my-service');
      expect(service).toBeDefined();
      expect(service.markdown).toContain('Service: my-service');
      expect(service.markdown).toContain('Depends on: my-application, my-library');
    });

    it('falls back to defaultMarkdown when markdownTemplate is not provided', async () => {
      const { getService } = utils(catalogDir);

      await plugin(eventCatalogConfig, {
        services: [{ path: join(__dirname, 'my-service-compass.yml') }],
        compassUrl: 'https://compass.atlassian.com',
      });

      const service = await getService('my-service');
      expect(service).toBeDefined();
      expect(service.markdown).toContain('## Links');
      expect(service.markdown).toContain('## Dependencies');
      expect(service.markdown).toContain('## Architecture diagram');
    });
  });

  describe('Phase 5: MDX format support', () => {
    it('defaults to mdx format', async () => {
      const { getService } = utils(catalogDir);

      await plugin(eventCatalogConfig, {
        services: [{ path: join(__dirname, 'my-library-compass.yml') }],
        compassUrl: 'https://compass.atlassian.com',
      });

      const service = await getService('my-library');
      expect(service).toBeDefined();
    });

    it('accepts format: md option', async () => {
      const { getService } = utils(catalogDir);

      await plugin(eventCatalogConfig, {
        services: [{ path: join(__dirname, 'my-library-compass.yml') }],
        compassUrl: 'https://compass.atlassian.com',
        format: 'md',
      });

      const service = await getService('my-library');
      expect(service).toBeDefined();
      expect(service.name).toBe('my-library');
    });

    it('accepts format: mdx option', async () => {
      const { getService } = utils(catalogDir);

      await plugin(eventCatalogConfig, {
        services: [{ path: join(__dirname, 'my-library-compass.yml') }],
        compassUrl: 'https://compass.atlassian.com',
        format: 'mdx',
      });

      const service = await getService('my-library');
      expect(service).toBeDefined();
      expect(service.name).toBe('my-library');
    });

    it('rejects invalid format values via Zod validation', async () => {
      await expect(
        plugin(eventCatalogConfig, {
          services: [{ path: join(__dirname, 'my-library-compass.yml') }],
          compassUrl: 'https://compass.atlassian.com',
          format: 'html' as 'md',
        })
      ).rejects.toThrow();
    });
  });

  describe('Phase 5: teams', () => {
    it('creates a team entity from service ownerId', async () => {
      const { getService, getTeam } = utils(catalogDir);

      await plugin(eventCatalogConfig, {
        services: [{ path: join(__dirname, 'my-service-compass.yml') }],
        compassUrl: 'https://compass.atlassian.com',
      });

      const service = await getService('my-service');
      expect(service).toBeDefined();
      expect(service.owners).toContain('00000000-0000-0000-0000-000000000000');

      const team = await getTeam('00000000-0000-0000-0000-000000000000');
      expect(team).toBeDefined();
      expect(team.id).toBe('00000000-0000-0000-0000-000000000000');
    });

    it('deduplicates teams when multiple services share the same owner', async () => {
      const { getTeam } = utils(catalogDir);

      // my-service, my-application, and my-library all have the same ownerId
      await plugin(eventCatalogConfig, {
        services: [
          { path: join(__dirname, 'my-service-compass.yml') },
          { path: join(__dirname, 'my-application-compass.yml') },
          { path: join(__dirname, 'my-library-compass.yml') },
        ],
        compassUrl: 'https://compass.atlassian.com',
      });

      // Team should exist (written once, not three times causing errors)
      const team = await getTeam('00000000-0000-0000-0000-000000000000');
      expect(team).toBeDefined();
      expect(team.id).toBe('00000000-0000-0000-0000-000000000000');
    });

    it('creates separate teams for different ownerIds', async () => {
      const { getTeam } = utils(catalogDir);

      // my-openapi-service has a different ownerId (11111111-...)
      await plugin(eventCatalogConfig, {
        services: [
          { path: join(__dirname, 'my-service-compass.yml') },
          { path: join(__dirname, 'my-openapi-service-compass.yml') },
        ],
        compassUrl: 'https://compass.atlassian.com',
      });

      const team1 = await getTeam('00000000-0000-0000-0000-000000000000');
      const team2 = await getTeam('11111111-1111-1111-1111-111111111111');
      expect(team1).toBeDefined();
      expect(team2).toBeDefined();
    });
  });

  describe('Phase 5: OpenAPI spec attachment from links', () => {
    it('attaches OpenAPI specifications from links with "openapi" in name', async () => {
      const { getService } = utils(catalogDir);

      await plugin(eventCatalogConfig, {
        services: [{ path: join(__dirname, 'my-openapi-service-compass.yml') }],
        compassUrl: 'https://compass.atlassian.com',
      });

      const service = await getService('my-openapi-service');
      expect(service).toBeDefined();
      expect(service.specifications).toBeDefined();
      expect(service.specifications).toContainEqual({
        type: 'openapi',
        path: 'https://api.example.com/openapi.yaml',
        name: 'OpenAPI Spec',
      });
    });

    it('attaches OpenAPI specifications from links with "swagger" in name', async () => {
      const { getService } = utils(catalogDir);

      await plugin(eventCatalogConfig, {
        services: [{ path: join(__dirname, 'my-openapi-service-compass.yml') }],
        compassUrl: 'https://compass.atlassian.com',
      });

      const service = await getService('my-openapi-service');
      expect(service).toBeDefined();
      expect(service.specifications).toContainEqual({
        type: 'openapi',
        path: 'https://api.example.com/swagger.json',
        name: 'Swagger Documentation',
      });
    });

    it('does not attach specifications when no openapi/swagger links exist', async () => {
      const { getService } = utils(catalogDir);

      await plugin(eventCatalogConfig, {
        services: [{ path: join(__dirname, 'my-service-compass.yml') }],
        compassUrl: 'https://compass.atlassian.com',
      });

      const service = await getService('my-service');
      expect(service).toBeDefined();
      expect(service.specifications).toBeUndefined();
    });
  });
});
