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

  it('returns an array of teams mapped from entities/teamId fields', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ entities: [{ teamId: 'uuid-1', displayName: 'Team A' }] }),
    });
    const teams = await listTeams(config);
    expect(teams).toEqual([{ id: 'uuid-1', displayName: 'Team A' }]);
  });

  it('returns empty array when entities is empty', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ entities: [] }) });
    const teams = await listTeams(config);
    expect(teams).toEqual([]);
  });

  it('sends Basic auth header', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ entities: [] }) });
    await listTeams(config);
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['Authorization']).toMatch(/^Basic /);
  });

  it('calls the correct Teams API endpoint including orgId', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ entities: [] }) });
    await listTeams(config);
    expect(mockFetch.mock.calls[0][0]).toBe('https://test.atlassian.net/gateway/api/public/teams/v1/org/test-org-id/teams/');
  });

  it('throws on non-OK response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });
    await expect(listTeams(config)).rejects.toThrow('Teams API request failed with status 401');
  });
});

describe('createTeam', () => {
  beforeEach(() => mockFetch.mockReset());

  it('creates a team and returns it mapped from teamId field', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ teamId: 'new-uuid', displayName: 'New Team' }),
    });
    const team = await createTeam(config, 'New Team');
    expect(team).toEqual({ id: 'new-uuid', displayName: 'New Team' });
  });

  it('sends displayName, teamType, and siteId in request body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ teamId: 'x', displayName: 'Test' }),
    });
    await createTeam(config, 'Test');
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({ displayName: 'Test', teamType: 'MEMBER_INVITE', siteId: 'test-site-id' });
  });

  it('omits siteId when not configured', async () => {
    const configWithoutSite = { ...config, siteId: undefined };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ teamId: 'x', displayName: 'Test' }),
    });
    await createTeam(configWithoutSite, 'Test');
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({ displayName: 'Test', teamType: 'MEMBER_INVITE' });
  });

  it('throws on non-OK response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 403 });
    await expect(createTeam(config, 'Test')).rejects.toThrow('Failed to create team "Test" (HTTP 403)');
  });
});

describe('ensureTeam', () => {
  beforeEach(() => mockFetch.mockReset());

  it('returns existing team if display name matches (case-insensitive)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ entities: [{ teamId: 'existing-id', displayName: 'laas-customer-team' }] }),
    });
    const team = await ensureTeam(config, 'LAAS-CUSTOMER-TEAM');
    expect(team.id).toBe('existing-id');
    expect(mockFetch).toHaveBeenCalledTimes(1); // only list, no create
  });

  it('creates a team when none with that name exists', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ entities: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ teamId: 'created-id', displayName: 'new-team' }) });
    const team = await ensureTeam(config, 'new-team');
    expect(team.id).toBe('created-id');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
