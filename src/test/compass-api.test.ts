import { expect, it, describe, beforeEach, afterEach, vi } from 'vitest';
import utils from '@eventcatalog/sdk';
import { fetchComponents, resolveValue } from '../compass-api';
import plugin from '../index';
import { join } from 'node:path';
import fs from 'fs/promises';
import type { ApiConfig } from '../types';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const apiConfig: ApiConfig = {
  cloudId: 'test-cloud-id',
  apiToken: 'test-api-token',
  email: 'test@example.com',
  baseUrl: 'https://test.atlassian.net',
};

const eventCatalogConfig = {
  title: 'My EventCatalog',
  homepageLink: 'https://bananas',
};

function makeSearchResponse(components: Array<Record<string, unknown>>, hasNextPage = false, endCursor: string | null = null) {
  return {
    ok: true,
    json: async () => ({
      data: {
        compass: {
          searchComponents: {
            nodes: components.map((c) => ({ component: c })),
            pageInfo: { hasNextPage, endCursor },
          },
        },
      },
    }),
  };
}

function makeComponent(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'ari:cloud:compass:test:component/test-1',
    name: 'test-service',
    type: 'SERVICE',
    description: 'A test service',
    ownerId: null,
    fields: null,
    links: null,
    relationships: null,
    labels: null,
    customFields: null,
    ...overrides,
  };
}

describe('Compass API client', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('resolveValue', () => {
    it('returns plain values unchanged', () => {
      expect(resolveValue('my-token')).toBe('my-token');
    });

    it('resolves environment variables', () => {
      process.env.TEST_API_TOKEN = 'resolved-token';
      expect(resolveValue('$TEST_API_TOKEN')).toBe('resolved-token');
      delete process.env.TEST_API_TOKEN;
    });

    it('throws on missing environment variables', () => {
      expect(() => resolveValue('$NONEXISTENT_VAR')).toThrow('Environment variable NONEXISTENT_VAR is not set');
    });
  });

  describe('fetchComponents', () => {
    it('fetches and maps components from Compass API', async () => {
      mockFetch.mockResolvedValueOnce(
        makeSearchResponse([
          makeComponent({
            description: 'A test service',
            ownerId: 'ari:cloud:teams:test:team/team-uuid',
            fields: { lifecycle: { label: 'Active' }, tier: { label: 'Tier 1' } },
            links: [{ type: 'REPOSITORY', url: 'https://github.com/test/repo', name: 'Repo' }],
            labels: ['test-label'],
          }),
        ])
      );

      const components = await fetchComponents(apiConfig);
      expect(components).toHaveLength(1);

      const c = components[0];
      expect(c.name).toBe('test-service');
      expect(c.typeId).toBe('SERVICE');
      expect(c.description).toBe('A test service');
      expect(c.ownerId).toBe('ari:cloud:teams:test:team/team-uuid');
      expect(c.fields?.lifecycle).toBe('Active');
      expect(c.fields?.tier).toBe(1);
      expect(c.links).toHaveLength(1);
      expect(c.links?.[0]).toEqual({ type: 'REPOSITORY', url: 'https://github.com/test/repo', name: 'Repo' });
      expect(c.labels).toEqual(['test-label']);
    });

    it('maps relationships to DEPENDS_ON format', async () => {
      mockFetch.mockResolvedValueOnce(
        makeSearchResponse([
          makeComponent({
            relationships: {
              nodes: [
                { type: 'DEPENDS_ON', endNodeAri: 'ari:cloud:compass:test:component/dep-1' },
                { type: 'DEPENDS_ON', endNodeAri: 'ari:cloud:compass:test:component/dep-2' },
              ],
            },
          }),
        ])
      );

      const components = await fetchComponents(apiConfig);
      expect(components[0].relationships?.DEPENDS_ON).toEqual([
        'ari:cloud:compass:test:component/dep-1',
        'ari:cloud:compass:test:component/dep-2',
      ]);
    });

    it('maps custom fields', async () => {
      mockFetch.mockResolvedValueOnce(
        makeSearchResponse([
          makeComponent({
            customFields: [{ definition: { name: 'Environment', type: 'text' }, textValue: 'production' }],
          }),
        ])
      );

      const components = await fetchComponents(apiConfig);
      expect(components[0].customFields).toHaveLength(1);
      expect(components[0].customFields?.[0]).toEqual({ type: 'text', name: 'Environment', value: 'production' });
    });

    it('handles pagination across multiple pages', async () => {
      mockFetch
        .mockResolvedValueOnce(makeSearchResponse([makeComponent({ name: 'service-1' })], true, 'cursor-1'))
        .mockResolvedValueOnce(makeSearchResponse([makeComponent({ name: 'service-2', type: 'APPLICATION' })]));

      const components = await fetchComponents(apiConfig);
      expect(components).toHaveLength(2);
      expect(components[0].name).toBe('service-1');
      expect(components[1].name).toBe('service-2');
      expect(mockFetch).toHaveBeenCalledTimes(2);

      // Second call should include cursor
      const secondCallBody = JSON.parse(mockFetch.mock.calls[1][1].body);
      expect(secondCallBody.variables.after).toBe('cursor-1');
    });

    it('sends correct Basic auth header', async () => {
      mockFetch.mockResolvedValueOnce(makeSearchResponse([]));

      await fetchComponents(apiConfig);

      const expectedAuth = `Basic ${Buffer.from('test@example.com:test-api-token').toString('base64')}`;
      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.atlassian.net/gateway/api/graphql',
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: expectedAuth }),
        })
      );
    });

    it('resolves env vars in apiToken and email', async () => {
      process.env.MY_COMPASS_TOKEN = 'env-resolved-token';
      process.env.MY_COMPASS_EMAIL = 'env@example.com';

      mockFetch.mockResolvedValueOnce(makeSearchResponse([]));

      await fetchComponents({ ...apiConfig, apiToken: '$MY_COMPASS_TOKEN', email: '$MY_COMPASS_EMAIL' });

      const expectedAuth = `Basic ${Buffer.from('env@example.com:env-resolved-token').toString('base64')}`;
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: expectedAuth }),
        })
      );

      delete process.env.MY_COMPASS_TOKEN;
      delete process.env.MY_COMPASS_EMAIL;
    });

    it('passes typeFilter as query variable', async () => {
      mockFetch.mockResolvedValueOnce(makeSearchResponse([]));

      await fetchComponents({ ...apiConfig, typeFilter: ['SERVICE', 'APPLICATION'] });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.variables.types).toEqual(['SERVICE', 'APPLICATION']);
    });

    it('throws on 401 unauthorized', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });
      await expect(fetchComponents(apiConfig)).rejects.toThrow('authentication failed');
    });

    it('throws on 403 forbidden', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 403 });
      await expect(fetchComponents(apiConfig)).rejects.toThrow('authorization failed');
    });

    it('throws on 429 rate limit', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 429 });
      await expect(fetchComponents(apiConfig)).rejects.toThrow('rate limit exceeded');
    });

    it('throws on other HTTP errors', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
      await expect(fetchComponents(apiConfig)).rejects.toThrow('status 500');
    });

    it('throws on network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('fetch failed'));
      await expect(fetchComponents(apiConfig)).rejects.toThrow('fetch failed');
    });

    it('throws on GraphQL errors in response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ errors: [{ message: 'Invalid cloudId' }] }),
      });
      await expect(fetchComponents(apiConfig)).rejects.toThrow('Invalid cloudId');
    });

    it('throws when response has no data', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });
      await expect(fetchComponents(apiConfig)).rejects.toThrow('no data');
    });

    it('handles components with null/missing optional fields', async () => {
      mockFetch.mockResolvedValueOnce(makeSearchResponse([makeComponent()]));

      const components = await fetchComponents(apiConfig);
      const c = components[0];
      expect(c.name).toBe('test-service');
      expect(c.ownerId).toBeUndefined();
      expect(c.fields).toBeUndefined();
      expect(c.links).toBeUndefined();
      expect(c.relationships).toBeUndefined();
      expect(c.labels).toBeUndefined();
      expect(c.customFields).toBeUndefined();
    });
  });

  describe('API mode integration', () => {
    let catalogDir: string;

    beforeEach(() => {
      catalogDir = join(__dirname, 'catalog-api');
      process.env.PROJECT_DIR = catalogDir;
    });

    afterEach(async () => {
      await fs.rm(catalogDir, { recursive: true, force: true });
    });

    it('fetches components via API and writes services to catalog', async () => {
      mockFetch.mockResolvedValueOnce(
        makeSearchResponse([
          makeComponent({
            id: 'ari:cloud:compass:test:component/api-svc',
            name: 'api-test-service',
            description: 'Test service from API',
            fields: { lifecycle: { label: 'Active' }, tier: null },
          }),
        ])
      );

      await plugin(eventCatalogConfig, {
        api: apiConfig,
        compassUrl: 'https://test.atlassian.net/compass',
      });

      const { getService } = utils(catalogDir);
      const service = await getService('api-test-service');
      expect(service).toBeDefined();
      expect(service.name).toBe('api-test-service');
      expect(service.summary).toBe('Test service from API');
      expect(service.badges).toContainEqual({
        content: 'SERVICE',
        backgroundColor: '#6366f1',
        textColor: '#fff',
      });
    });

    it('resolves dependencies between API-fetched components', async () => {
      mockFetch.mockResolvedValueOnce(
        makeSearchResponse([
          makeComponent({
            id: 'ari:cloud:compass:test:component/svc-a',
            name: 'service-a',
            relationships: {
              nodes: [{ type: 'DEPENDS_ON', endNodeAri: 'ari:cloud:compass:test:component/svc-b' }],
            },
          }),
          makeComponent({
            id: 'ari:cloud:compass:test:component/svc-b',
            name: 'service-b',
          }),
        ])
      );

      await plugin(eventCatalogConfig, {
        api: apiConfig,
        compassUrl: 'https://test.atlassian.net/compass',
      });

      const { getService } = utils(catalogDir);
      const serviceA = await getService('service-a');
      expect(serviceA).toBeDefined();
      expect(serviceA.markdown).toContain('[service-b](/docs/services/service-b)');

      const serviceB = await getService('service-b');
      expect(serviceB).toBeDefined();
      expect(serviceB.markdown).toContain('No known dependencies.');
    });

    it('creates domain and associates API-fetched services', async () => {
      mockFetch.mockResolvedValueOnce(makeSearchResponse([makeComponent({ name: 'domain-api-service' })]));

      await plugin(eventCatalogConfig, {
        api: apiConfig,
        compassUrl: 'https://test.atlassian.net/compass',
        domain: { id: 'api-domain', name: 'API Domain', version: '1.0.0' },
      });

      const { getService, getDomain } = utils(catalogDir);
      const service = await getService('domain-api-service');
      expect(service).toBeDefined();

      const domain = await getDomain('api-domain', '1.0.0');
      expect(domain).toBeDefined();
      expect(domain.services).toContainEqual({ id: 'domain-api-service', version: '0.0.0' });
    });
  });
});
