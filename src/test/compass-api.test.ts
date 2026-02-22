import { expect, it, describe, beforeEach, afterEach, vi } from 'vitest';
import utils from '@eventcatalog/sdk';
import { fetchComponents, fetchTeamById, fetchScorecardNames, resolveValue, updateComponentOwner } from '../compass-api';
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
    typeId: 'SERVICE',
    description: 'A test service',
    ownerId: null,
    fields: null,
    links: null,
    relationships: null,
    labels: null,
    customFields: null,
    scorecardScores: null,
    ...overrides,
  };
}

function makeEmptyScorecardsResponse() {
  return {
    ok: true,
    json: async () => ({
      data: { compass: { scorecards: { nodes: [] } } },
    }),
  };
}

function makeTeamResponse(team: { id: string; displayName: string } | null) {
  return {
    ok: true,
    json: async () => ({
      data: {
        team: {
          teamV2: team,
        },
      },
    }),
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
            fields: [
              { definition: { name: 'lifecycle' }, value: 'Active' },
              { definition: { name: 'tier' }, value: 'Tier 1' },
            ],
            links: [{ type: 'REPOSITORY', url: 'https://github.com/test/repo', name: 'Repo' }],
            labels: [{ name: 'test-label' }],
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
                { relationshipType: 'DEPENDS_ON', endNode: { id: 'ari:cloud:compass:test:component/dep-1' } },
                { relationshipType: 'DEPENDS_ON', endNode: { id: 'ari:cloud:compass:test:component/dep-2' } },
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
            customFields: [{ definition: { name: 'Environment' }, textValue: 'production' }],
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
        .mockResolvedValueOnce(makeSearchResponse([makeComponent({ name: 'service-2', typeId: 'APPLICATION' })]));

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

    it('does not pass typeFilter as query variable (filtered client-side)', async () => {
      mockFetch.mockResolvedValueOnce(makeSearchResponse([]));

      await fetchComponents({ ...apiConfig, typeFilter: ['SERVICE', 'APPLICATION'] });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.variables.types).toBeUndefined();
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
      // fetchScorecardNames call
      mockFetch.mockResolvedValueOnce(makeEmptyScorecardsResponse());
      // fetchComponents call
      mockFetch.mockResolvedValueOnce(
        makeSearchResponse([
          makeComponent({
            id: 'ari:cloud:compass:test:component/api-svc',
            name: 'api-test-service',
            description: 'Test service from API',
            fields: [{ definition: { name: 'lifecycle' }, value: 'Active' }],
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
      // fetchScorecardNames call
      mockFetch.mockResolvedValueOnce(makeEmptyScorecardsResponse());
      // fetchComponents call
      mockFetch.mockResolvedValueOnce(
        makeSearchResponse([
          makeComponent({
            id: 'ari:cloud:compass:test:component/svc-a',
            name: 'service-a',
            relationships: {
              nodes: [{ relationshipType: 'DEPENDS_ON', endNode: { id: 'ari:cloud:compass:test:component/svc-b' } }],
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
      expect(serviceA.markdown).toContain('[service-b](../../service-b/)');

      const serviceB = await getService('service-b');
      expect(serviceB).toBeDefined();
      expect(serviceB.markdown).toContain('No known dependencies.');
    });

    it('creates domain and associates API-fetched services', async () => {
      // fetchScorecardNames call
      mockFetch.mockResolvedValueOnce(makeEmptyScorecardsResponse());
      // fetchComponents call
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

  describe('fetchTeamById', () => {
    it('fetches team display name by ID', async () => {
      mockFetch.mockResolvedValueOnce(makeTeamResponse({ id: 'team-uuid-123', displayName: 'Platform Team' }));

      const team = await fetchTeamById(apiConfig, 'team-uuid-123');
      expect(team).toEqual({ id: 'team-uuid-123', displayName: 'Platform Team' });
    });

    it('returns null when team is not found', async () => {
      mockFetch.mockResolvedValueOnce(makeTeamResponse(null));

      const team = await fetchTeamById(apiConfig, 'nonexistent-team');
      expect(team).toBeNull();
    });

    it('returns null on HTTP error', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

      const team = await fetchTeamById(apiConfig, 'team-uuid-123');
      expect(team).toBeNull();
    });

    it('returns null on GraphQL errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ errors: [{ message: 'Team not found' }] }),
      });

      const team = await fetchTeamById(apiConfig, 'team-uuid-123');
      expect(team).toBeNull();
    });
  });

  describe('scorecard mapping', () => {
    it('extracts short ID from ARI-style scorecardId', async () => {
      mockFetch.mockResolvedValueOnce(
        makeSearchResponse([
          makeComponent({
            scorecardScores: [
              { scorecardId: 'ari:cloud:compass:test:scorecard/abc/uuid-health', totalScore: 85, maxTotalScore: 100 },
              { scorecardId: 'ari:cloud:compass:test:scorecard/abc/uuid-security', totalScore: 60, maxTotalScore: 100 },
            ],
          }),
        ])
      );

      const components = await fetchComponents(apiConfig);
      expect(components[0].scorecards).toHaveLength(2);
      expect(components[0].scorecards?.[0]).toEqual({ name: 'uuid-health', score: 85, maxScore: 100 });
      expect(components[0].scorecards?.[1]).toEqual({ name: 'uuid-security', score: 60, maxScore: 100 });
    });

    it('uses scorecard name map when provided', async () => {
      const scorecardId = 'ari:cloud:compass:test:scorecard/abc/sc-uuid-1';
      mockFetch.mockResolvedValueOnce(
        makeSearchResponse([
          makeComponent({
            scorecardScores: [{ scorecardId, totalScore: 90, maxTotalScore: 100 }],
          }),
        ])
      );

      const nameMap = new Map([[scorecardId, 'Health Check']]);
      const components = await fetchComponents(apiConfig, nameMap);
      expect(components[0].scorecards?.[0]).toEqual({ name: 'Health Check', score: 90, maxScore: 100 });
    });

    it('keeps plain scorecardId as-is when not an ARI', async () => {
      mockFetch.mockResolvedValueOnce(
        makeSearchResponse([
          makeComponent({
            scorecardScores: [{ scorecardId: 'Health', totalScore: 85, maxTotalScore: 100 }],
          }),
        ])
      );

      const components = await fetchComponents(apiConfig);
      expect(components[0].scorecards?.[0]).toEqual({ name: 'Health', score: 85, maxScore: 100 });
    });

    it('handles components with no scorecard scores', async () => {
      mockFetch.mockResolvedValueOnce(makeSearchResponse([makeComponent()]));

      const components = await fetchComponents(apiConfig);
      expect(components[0].scorecards).toBeUndefined();
    });
  });

  describe('fetchScorecardNames', () => {
    it('fetches scorecard names and returns a map', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            compass: {
              scorecards: {
                nodes: [
                  { id: 'ari:cloud:compass:test:scorecard/abc/sc-1', name: 'Health Check' },
                  { id: 'ari:cloud:compass:test:scorecard/abc/sc-2', name: 'Security' },
                ],
              },
            },
          },
        }),
      });

      const names = await fetchScorecardNames(apiConfig);
      expect(names.size).toBe(2);
      expect(names.get('ari:cloud:compass:test:scorecard/abc/sc-1')).toBe('Health Check');
      expect(names.get('ari:cloud:compass:test:scorecard/abc/sc-2')).toBe('Security');
    });

    it('returns empty map on HTTP error', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
      const names = await fetchScorecardNames(apiConfig);
      expect(names.size).toBe(0);
    });

    it('returns empty map on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('network error'));
      const names = await fetchScorecardNames(apiConfig);
      expect(names.size).toBe(0);
    });
  });

  describe('API mode: team enrichment', () => {
    let catalogDir: string;

    beforeEach(() => {
      catalogDir = join(__dirname, 'catalog-api-teams');
      process.env.PROJECT_DIR = catalogDir;
    });

    afterEach(async () => {
      await fs.rm(catalogDir, { recursive: true, force: true });
    });

    it('enriches team name from Compass API in API mode', async () => {
      // First call: fetchScorecardNames
      mockFetch.mockResolvedValueOnce(makeEmptyScorecardsResponse());
      // Second call: fetchComponents
      mockFetch.mockResolvedValueOnce(
        makeSearchResponse([
          makeComponent({
            name: 'team-enriched-service',
            ownerId: 'ari:cloud:teams:test:team/team-uuid-456',
          }),
        ])
      );
      // Third call: fetchTeamById
      mockFetch.mockResolvedValueOnce(makeTeamResponse({ id: 'team-uuid-456', displayName: 'Engineering Squad' }));

      await plugin(eventCatalogConfig, {
        api: apiConfig,
        compassUrl: 'https://test.atlassian.net/compass',
      });

      const { getTeam } = utils(catalogDir);
      const team = await getTeam('team-uuid-456');
      expect(team).toBeDefined();
      expect(team.name).toBe('Engineering Squad');
    });

    it('skips team creation when team fetch fails in API mode', async () => {
      // First call: fetchScorecardNames
      mockFetch.mockResolvedValueOnce(makeEmptyScorecardsResponse());
      // Second call: fetchComponents
      mockFetch.mockResolvedValueOnce(
        makeSearchResponse([
          makeComponent({
            name: 'team-fallback-service',
            ownerId: 'ari:cloud:teams:test:team/team-uuid-789',
          }),
        ])
      );
      // Third call: fetchTeamById fails
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      await plugin(eventCatalogConfig, {
        api: apiConfig,
        compassUrl: 'https://test.atlassian.net/compass',
      });

      const { getTeam } = utils(catalogDir);
      const team = await getTeam('team-uuid-789');
      expect(team).toBeUndefined();
    });
  });

  describe('API mode: scorecard badges integration', () => {
    let catalogDir: string;

    beforeEach(() => {
      catalogDir = join(__dirname, 'catalog-api-scorecards');
      process.env.PROJECT_DIR = catalogDir;
    });

    afterEach(async () => {
      await fs.rm(catalogDir, { recursive: true, force: true });
    });

    it('creates scorecard badges from API-fetched components', async () => {
      const scorecardAri = 'ari:cloud:compass:test:scorecard/abc/sc-health';
      // First call: fetchScorecardNames
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { compass: { scorecards: { nodes: [{ id: scorecardAri, name: 'Health' }] } } },
        }),
      });
      // Second call: fetchComponents
      mockFetch.mockResolvedValueOnce(
        makeSearchResponse([
          makeComponent({
            name: 'scorecard-api-service',
            scorecardScores: [{ scorecardId: scorecardAri, totalScore: 90, maxTotalScore: 100 }],
          }),
        ])
      );

      await plugin(eventCatalogConfig, {
        api: apiConfig,
        compassUrl: 'https://test.atlassian.net/compass',
      });

      const { getService } = utils(catalogDir);
      const service = await getService('scorecard-api-service');
      expect(service).toBeDefined();
      expect(service.badges).toContainEqual({
        content: 'Health: 90%',
        backgroundColor: '#22c55e',
        textColor: '#fff',
      });
    });
  });
});

describe('updateComponentOwner', () => {
  beforeEach(() => mockFetch.mockReset());

  it('sends the correct GraphQL mutation with component ID and team ARI', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          compass: {
            updateComponent: {
              success: true,
              errors: null,
              componentDetails: { id: 'comp-ari', ownerId: 'ari:cloud:identity::team/team-uuid' },
            },
          },
        },
      }),
    });

    await updateComponentOwner(apiConfig, 'comp-ari', 'ari:cloud:identity::team/team-uuid');

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.variables).toEqual({
      input: { id: 'comp-ari', ownerId: 'ari:cloud:identity::team/team-uuid' },
    });
  });

  it('throws when response contains GraphQL errors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ errors: [{ message: 'not authorised' }] }),
    });

    await expect(updateComponentOwner(apiConfig, 'comp-ari', 'ari:cloud:identity::team/team-uuid')).rejects.toThrow(
      'not authorised'
    );
  });

  it('throws when payload contains errors array', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          compass: {
            updateComponent: { success: false, errors: [{ message: 'component not found' }] },
          },
        },
      }),
    });

    await expect(updateComponentOwner(apiConfig, 'comp-ari', 'ari:cloud:identity::team/team-uuid')).rejects.toThrow(
      'Compass update component error: component not found'
    );
  });
});
