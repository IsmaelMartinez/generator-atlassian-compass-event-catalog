export type TeamsApiConfig = {
  baseUrl: string;
  orgId: string;
  apiToken: string;
  email: string;
  siteId?: string;
};

export type AtlassianTeam = {
  id: string;
  displayName: string;
};

export function teamToAri(teamId: string): string {
  return `ari:cloud:identity::team/${teamId}`;
}

function buildAuthHeader(email: string, apiToken: string): string {
  return `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`;
}

function teamsEndpoint(baseUrl: string, orgId: string): string {
  // Trailing slash is required for POST — without it the endpoint returns 405
  return `${baseUrl.replace(/\/$/, '')}/gateway/api/public/teams/v1/org/${orgId}/teams/`;
}

export async function listTeams(config: TeamsApiConfig): Promise<AtlassianTeam[]> {
  const response = await fetch(teamsEndpoint(config.baseUrl, config.orgId), {
    headers: {
      Authorization: buildAuthHeader(config.email, config.apiToken),
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Teams API request failed with status ${response.status}`);
  }

  const data = (await response.json()) as { entities: Array<{ teamId: string; displayName: string }> };
  return (data.entities ?? []).map((e) => ({ id: e.teamId, displayName: e.displayName }));
}

export async function createTeam(config: TeamsApiConfig, displayName: string): Promise<AtlassianTeam> {
  const response = await fetch(teamsEndpoint(config.baseUrl, config.orgId), {
    method: 'POST',
    headers: {
      Authorization: buildAuthHeader(config.email, config.apiToken),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      displayName,
      teamType: 'MEMBER_INVITE',
      ...(config.siteId ? { siteId: config.siteId } : {}),
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create team "${displayName}" (HTTP ${response.status})`);
  }

  const data = (await response.json()) as { teamId: string; displayName: string };
  return { id: data.teamId, displayName: data.displayName };
}

export async function ensureTeam(config: TeamsApiConfig, displayName: string): Promise<AtlassianTeam> {
  const existing = await listTeams(config);
  const match = existing.find((t) => t.displayName.toLowerCase() === displayName.toLowerCase());
  if (match) return match;
  return createTeam(config, displayName);
}
