import { describe, expect, it, vi, beforeEach } from 'vitest';
import { listTeams, createTeam, ensureTeam, teamToAri } from '../teams-api';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const config = {
  baseUrl: 'https://test.atlassian.net',
  orgId: 'test-org-id',
  apiToken: 'test-token',
  email: 'test@example.com',
  siteId: 'test-site-id',
};

describe('teamToAri', () => {
  it('wraps a plain UUID in the Atlassian identity ARI format', () => {
    expect(teamToAri('abc-123')).toBe('ari:cloud:identity::team/abc-123');
  });
});

describe('listTeams', () => {
  beforeEach(() => mockFetch.mockReset());

  it('returns an array of teams from GraphQL teamSearchV2', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          team: {
            teamSearchV2: {
              __typename: 'TeamSearchResultConnectionV2',
              nodes: [{ team: { id: 'ari:cloud:identity::team/uuid-1', displayName: 'Team A' } }],
            },
          },
        },
      }),
    });
    const teams = await listTeams(config);
    expect(teams).toEqual([{ id: 'ari:cloud:identity::team/uuid-1', displayName: 'Team A' }]);
  });

  it('returns empty array when nodes is empty', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: { team: { teamSearchV2: { __typename: 'TeamSearchResultConnectionV2', nodes: [] } } },
      }),
    });
    const teams = await listTeams(config);
    expect(teams).toEqual([]);
  });

  it('sends Basic auth header', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { team: { teamSearchV2: { nodes: [] } } } }),
    });
    await listTeams(config);
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['Authorization']).toMatch(/^Basic /);
  });

  it('calls the GraphQL endpoint with orgAri and siteId variables', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { team: { teamSearchV2: { nodes: [] } } } }),
    });
    await listTeams(config);
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://test.atlassian.net/gateway/api/graphql');
    const body = JSON.parse(init.body as string);
    expect(body.variables).toEqual({
      orgAri: 'ari:cloud:platform::org/test-org-id',
      siteId: 'test-site-id',
    });
  });

  it('throws on non-OK response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });
    await expect(listTeams(config)).rejects.toThrow('Teams API request failed with status 401');
  });

  it('throws on GraphQL errors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ errors: [{ message: 'something went wrong' }] }),
    });
    await expect(listTeams(config)).rejects.toThrow('Teams API GraphQL error: something went wrong');
  });
});

describe('createTeam', () => {
  beforeEach(() => mockFetch.mockReset());

  it('creates a team and returns it', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          team: {
            createTeam: {
              success: true,
              errors: null,
              team: { id: 'ari:cloud:identity::team/new-uuid', displayName: 'New Team' },
            },
          },
        },
      }),
    });
    const team = await createTeam(config, 'New Team');
    expect(team).toEqual({ id: 'ari:cloud:identity::team/new-uuid', displayName: 'New Team' });
  });

  it('sends correct input variables with org ARI as scopeId', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          team: {
            createTeam: {
              success: true,
              errors: null,
              team: { id: 'x', displayName: 'Test' },
            },
          },
        },
      }),
    });
    await createTeam(config, 'Test');
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.variables.input).toEqual({
      displayName: 'Test',
      description: '',
      membershipSettings: 'MEMBER_INVITE',
      scopeId: 'ari:cloud:platform::org/test-org-id',
    });
  });

  it('throws on non-OK HTTP response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 403 });
    await expect(createTeam(config, 'Test')).rejects.toThrow('Failed to create team "Test" (HTTP 403)');
  });

  it('throws when payload contains errors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          team: {
            createTeam: {
              success: false,
              errors: [{ message: 'Team already exists' }],
              team: null,
            },
          },
        },
      }),
    });
    await expect(createTeam(config, 'Test')).rejects.toThrow('Team already exists');
  });
});

describe('ensureTeam', () => {
  beforeEach(() => mockFetch.mockReset());

  it('returns existing team if display name matches (case-insensitive)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          team: {
            teamSearchV2: {
              __typename: 'TeamSearchResultConnectionV2',
              nodes: [{ team: { id: 'ari:cloud:identity::team/existing-id', displayName: 'laas-customer-team' } }],
            },
          },
        },
      }),
    });
    const team = await ensureTeam(config, 'LAAS-CUSTOMER-TEAM');
    expect(team.id).toBe('ari:cloud:identity::team/existing-id');
    expect(mockFetch).toHaveBeenCalledTimes(1); // only list, no create
  });

  it('creates a team when none with that name exists', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { team: { teamSearchV2: { __typename: 'TeamSearchResultConnectionV2', nodes: [] } } },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            team: {
              createTeam: {
                success: true,
                errors: null,
                team: { id: 'ari:cloud:identity::team/created-id', displayName: 'new-team' },
              },
            },
          },
        }),
      });
    const team = await ensureTeam(config, 'new-team');
    expect(team.id).toBe('ari:cloud:identity::team/created-id');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
