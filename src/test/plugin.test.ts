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

## Architecture diagram

<NodeGraph />`;

const expectedBadges = [
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

  it('does not create a service if the typeId is not SERVICE', async () => {
    const { getService, getDomain } = utils(catalogDir);
    // Create the domain and service
    await expect(
      plugin(eventCatalogConfig, {
        services: [{ path: join(__dirname, 'my-other-compass.notsupported.yml') }],
        compassUrl: 'https://compass.atlassian.com',
        domain: {
          id: 'my-domain',
          name: 'My Domain',
          version: '0.0.1',
        },
      })
    ).rejects.toThrow('Only SERVICE type is supported');

    // Validate the domain is created
    const domain = await getDomain('my-domain', '0.0.1');
    expect(domain).toBeDefined();

    expect(domain).toEqual({
      id: 'my-domain',
      markdown: `## Architecture diagram
  <NodeGraph />`,
      name: 'My Domain',
      version: '0.0.1',
    });

    // Check that the service is not created

    const service = await getService('my-service');
    expect(service).not.toBeDefined();
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
  });
});
