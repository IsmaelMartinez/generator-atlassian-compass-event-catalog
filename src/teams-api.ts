export type TeamsApiConfig = {
  baseUrl: string;
  orgId: string;
  apiToken: string;
  email: string;
  siteId: string;
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

function orgAri(orgId: string): string {
  return `ari:cloud:platform::org/${orgId}`;
}

// GraphQL query — teamSearchV2 requires both organizationId (as ARI) and siteId.
// Returns up to 200 teams; pagination not needed for typical org sizes.
const LIST_TEAMS_QUERY = `
  query listTeams($orgAri: ID!, $siteId: ID!) {
    team {
      teamSearchV2(organizationId: $orgAri, siteId: $siteId, first: 200) {
        __typename
        ... on TeamSearchResultConnectionV2 {
          nodes {
            team { id displayName }
          }
        }
      }
    }
  }
`;

type ListTeamsResponse = {
  data?: {
    team: {
      teamSearchV2: {
        __typename: string;
        nodes?: Array<{ team: { id: string; displayName: string } }>;
      };
    };
  };
  errors?: Array<{ message: string }>;
};

export async function listTeams(config: TeamsApiConfig): Promise<AtlassianTeam[]> {
  const endpoint = `${config.baseUrl.replace(/\/$/, '')}/gateway/api/graphql`;
  const authHeader = buildAuthHeader(config.email, config.apiToken);

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader,
      Accept: 'application/json',
    },
    body: JSON.stringify({
      query: LIST_TEAMS_QUERY,
      variables: { orgAri: orgAri(config.orgId), siteId: config.siteId },
    }),
  });

  if (!response.ok) {
    throw new Error(`Teams API request failed with status ${response.status}`);
  }

  const result = (await response.json()) as ListTeamsResponse;

  if (result.errors && result.errors.length > 0) {
    throw new Error(`Teams API GraphQL error: ${result.errors[0].message}`);
  }

  const nodes = result.data?.team?.teamSearchV2?.nodes ?? [];
  return nodes.map((n) => ({ id: n.team.id, displayName: n.team.displayName }));
}

// createTeam requires @optIn(to: "Team-crud") and scopeId as an org ARI.
const CREATE_TEAM_MUTATION = `
  mutation createTeam($input: TeamCreateTeamInput!) {
    team {
      createTeam(input: $input) @optIn(to: "Team-crud") {
        success
        errors { message }
        team { id displayName }
      }
    }
  }
`;

type CreateTeamResponse = {
  data?: {
    team: {
      createTeam: {
        success: boolean;
        errors: Array<{ message: string }> | null;
        team: { id: string; displayName: string } | null;
      };
    };
  };
  errors?: Array<{ message: string }>;
};

export async function createTeam(config: TeamsApiConfig, displayName: string): Promise<AtlassianTeam> {
  const endpoint = `${config.baseUrl.replace(/\/$/, '')}/gateway/api/graphql`;
  const authHeader = buildAuthHeader(config.email, config.apiToken);

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader,
      Accept: 'application/json',
    },
    body: JSON.stringify({
      query: CREATE_TEAM_MUTATION,
      variables: {
        input: {
          displayName,
          description: '',
          membershipSettings: 'MEMBER_INVITE',
          scopeId: orgAri(config.orgId),
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create team "${displayName}" (HTTP ${response.status})`);
  }

  const result = (await response.json()) as CreateTeamResponse;

  if (result.errors && result.errors.length > 0) {
    throw new Error(`Failed to create team "${displayName}": ${result.errors[0].message}`);
  }

  const payload = result.data?.team?.createTeam;
  if (payload?.errors && payload.errors.length > 0) {
    throw new Error(`Failed to create team "${displayName}": ${payload.errors[0].message}`);
  }

  const team = payload?.team;
  if (!team) {
    throw new Error(`Failed to create team "${displayName}": no team returned`);
  }

  return { id: team.id, displayName: team.displayName };
}

export async function ensureTeam(config: TeamsApiConfig, displayName: string): Promise<AtlassianTeam> {
  const existing = await listTeams(config);
  const match = existing.find((t) => t.displayName.toLowerCase() === displayName.toLowerCase());
  if (match) return match;
  return createTeam(config, displayName);
}
