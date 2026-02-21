import { CompassConfig } from './compass';
import { ApiConfig } from './types';

// Type-level extraction from CompassConfig to avoid importing internal enums
type LinkType = NonNullable<CompassConfig['links']>[number]['type'];
type FieldType = NonNullable<CompassConfig['fields']>;
type CustomFieldType = NonNullable<CompassConfig['customFields']>[number]['type'];

// GraphQL response types — validated against Atlassian Compass API documentation
// and community examples (see https://community.atlassian.com/forums/Compass-questions/
// graphql-to-search-for-all-components/qaq-p/2472308)
type GraphQLField = {
  definition: { name: string };
  value?: string; // via ... on CompassEnumField { value }
};

type GraphQLScorecardScore = {
  scorecardId: string;
  totalScore: number;
  maxTotalScore: number;
};

type GraphQLComponent = {
  id: string;
  name: string;
  typeId: string;
  description: string | null;
  ownerId: string | null;
  fields: GraphQLField[] | null;
  links: Array<{
    type: string;
    url: string;
    name: string | null;
  }> | null;
  relationships: {
    nodes?: Array<{
      relationshipType: string;
      endNode: { id: string } | null;
    }>;
  } | null;
  labels: Array<{ name: string }> | null;
  customFields: Array<{
    definition: { name: string };
    textValue?: string;
    booleanValue?: boolean;
    numberValue?: number;
  }> | null;
  scorecardScores: GraphQLScorecardScore[] | null;
};

type SearchComponentsResult = {
  __typename: string;
  nodes?: Array<{ component: GraphQLComponent }>;
  pageInfo?: {
    hasNextPage: boolean;
    endCursor: string | null;
  };
  message?: string;
  identifier?: string;
};

type SearchComponentsResponse = {
  data?: {
    compass: {
      searchComponents: SearchComponentsResult;
    };
  };
  errors?: Array<{ message: string }>;
};

// Query validated against Compass GraphQL API docs. Key corrections from docs:
// - Component type field is `typeId` (not `type`)
// - Labels are objects: `labels { name }` (not plain strings)
// - Lifecycle/tier use CompassEnumField fragment: `fields { definition { name } ... on CompassEnumField { value } }`
// - Relationship nodes use `nodeId` (matching creation API input)
const SEARCH_COMPONENTS_QUERY = `
  query searchComponents($cloudId: String!, $after: String) {
    compass {
      searchComponents(
        cloudId: $cloudId
        query: { after: $after, first: 50 }
      ) {
        __typename
        ... on QueryError { message identifier }
        ... on CompassSearchComponentConnection {
          nodes {
            component {
              id
              name
              typeId
              description
              ownerId
              fields {
                definition { name }
                ... on CompassEnumField { value }
              }
              links {
                type
                url
                name
              }
              relationships {
                ... on CompassRelationshipConnection {
                  nodes {
                    relationshipType
                    endNode { id }
                  }
                }
              }
              labels { name }
              customFields {
                definition { name }
                ... on CompassCustomTextField { textValue }
                ... on CompassCustomBooleanField { booleanValue }
                ... on CompassCustomNumberField { numberValue }
              }
              scorecardScores {
                scorecardId
                totalScore
                maxTotalScore
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    }
  }
`;

export function resolveValue(value: string): string {
  if (value.startsWith('$')) {
    const envVar = value.slice(1);
    const resolved = process.env[envVar];
    if (!resolved) throw new Error(`Environment variable ${envVar} is not set`);
    return resolved;
  }
  return value;
}

function buildAuthHeader(email: string, apiToken: string): string {
  return `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`;
}

function mapTier(value: unknown): 1 | 2 | 3 | 4 | undefined {
  if (value == null) return undefined;
  // Handle numeric values directly
  if (typeof value === 'number') {
    if (value >= 1 && value <= 4) return value as 1 | 2 | 3 | 4;
    return undefined;
  }
  const str = String(value);
  const match = str.match(/(\d)/);
  if (match) {
    const num = parseInt(match[1], 10);
    if (num >= 1 && num <= 4) return num as 1 | 2 | 3 | 4;
  }
  return undefined;
}

function mapLifecycle(value: unknown): string | undefined {
  if (value == null) return undefined;
  const str = String(value);
  if (!str) return undefined;
  // API may return uppercase (ACTIVE) or title case (Active) — normalize both
  const normalized = str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  const valid: Record<string, string> = {
    Active: 'Active',
    'Pre-release': 'Pre-release',
    Prerelease: 'Pre-release',
    Deprecated: 'Deprecated',
  };
  return valid[normalized] || valid[str];
}

function extractField(fields: GraphQLField[] | null, fieldName: string): string | undefined {
  if (!fields) return undefined;
  const field = fields.find((f) => f.definition.name.toLowerCase() === fieldName.toLowerCase());
  return field?.value || undefined;
}

// Extract a readable name from a scorecard ARI (e.g., ari:cloud:compass:...:scorecard/.../UUID → UUID).
// If the value is already a plain name (no colons), return it as-is.
function extractScorecardName(scorecardId: string): string {
  if (!scorecardId.includes(':')) return scorecardId;
  const parts = scorecardId.split('/');
  return parts[parts.length - 1] || scorecardId;
}

function mapComponent(component: GraphQLComponent, scorecardNames?: Map<string, string>): CompassConfig {
  const config: CompassConfig = {
    name: component.name,
    id: component.id,
    description: component.description || undefined,
    typeId: component.typeId as CompassConfig['typeId'],
  };

  if (component.ownerId) {
    config.ownerId = component.ownerId;
  }

  const lifecycle = mapLifecycle(extractField(component.fields, 'lifecycle'));
  const tier = mapTier(extractField(component.fields, 'tier'));
  if (lifecycle || tier) {
    config.fields = { lifecycle: lifecycle as FieldType['lifecycle'], tier };
  }

  if (component.links && component.links.length > 0) {
    config.links = component.links.map((link) => ({
      type: link.type as LinkType,
      url: link.url,
      name: link.name || undefined,
    }));
  }

  if (component.relationships?.nodes && component.relationships.nodes.length > 0) {
    const dependsOn = component.relationships.nodes
      .filter((r) => r.relationshipType === 'DEPENDS_ON' && r.endNode?.id)
      .map((r) => r.endNode!.id);
    if (dependsOn.length > 0) {
      config.relationships = { DEPENDS_ON: dependsOn };
    }
  }

  if (component.labels && component.labels.length > 0) {
    config.labels = component.labels.map((l) => l.name);
  }

  if (component.customFields && component.customFields.length > 0) {
    config.customFields = component.customFields.map((cf) => {
      // Infer type from which value field is populated (API doesn't expose type on definition)
      let type: CustomFieldType = 'text' as CustomFieldType;
      if (cf.booleanValue !== undefined && cf.booleanValue !== null) type = 'boolean' as CustomFieldType;
      else if (cf.numberValue !== undefined && cf.numberValue !== null) type = 'number' as CustomFieldType;
      return {
        type,
        name: cf.definition.name,
        value: cf.textValue ?? String(cf.booleanValue ?? cf.numberValue ?? ''),
      };
    });
  }

  if (component.scorecardScores && component.scorecardScores.length > 0) {
    config.scorecards = component.scorecardScores.map((sc) => ({
      name: scorecardNames?.get(sc.scorecardId) ?? extractScorecardName(sc.scorecardId),
      score: sc.totalScore,
      maxScore: sc.maxTotalScore,
    }));
  }

  return config;
}

// GraphQL query to fetch a team's display name by team ID
const GET_TEAM_QUERY = `
  query getTeam($teamId: String!) {
    team {
      teamById(teamId: $teamId) {
        team {
          teamId
          displayName
        }
      }
    }
  }
`;

type GetTeamResponse = {
  data?: {
    team: {
      teamById: {
        team: {
          teamId: string;
          displayName: string;
        } | null;
      };
    };
  };
  errors?: Array<{ message: string }>;
};

export async function fetchTeamById(
  config: Pick<ApiConfig, 'apiToken' | 'email' | 'baseUrl'>,
  teamId: string
): Promise<{ id: string; displayName: string } | null> {
  const resolvedToken = resolveValue(config.apiToken);
  const resolvedEmail = resolveValue(config.email);
  const endpoint = `${config.baseUrl.replace(/\/$/, '')}/gateway/api/graphql`;
  const authHeader = buildAuthHeader(resolvedEmail, resolvedToken);

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader,
      Accept: 'application/json',
    },
    body: JSON.stringify({
      query: GET_TEAM_QUERY,
      variables: { teamId },
    }),
  });

  if (!response.ok) {
    console.warn(`Team API request failed for ${teamId} (HTTP ${response.status})`);
    return null;
  }

  const result = (await response.json()) as GetTeamResponse;

  if (result.errors) {
    console.warn(`Team API GraphQL error for ${teamId}: ${result.errors[0]?.message}`);
    return null;
  }

  if (!result.data) {
    console.warn(`Team API returned no data for ${teamId}`);
    return null;
  }

  const team = result.data.team?.teamById?.team;
  if (!team) {
    console.warn(`Team not found for ID ${teamId}`);
    return null;
  }

  return { id: team.teamId, displayName: team.displayName };
}

// GraphQL query to fetch all scorecards for the cloud instance
const GET_SCORECARDS_QUERY = `
  query getScorecards($cloudId: String!) {
    compass {
      scorecards(cloudId: $cloudId, query: { first: 100 }) {
        ... on CompassScorecardConnection {
          nodes {
            id
            name
          }
        }
      }
    }
  }
`;

type GetScorecardsResponse = {
  data?: {
    compass: {
      scorecards: {
        nodes?: Array<{ id: string; name: string }>;
      };
    };
  };
  errors?: Array<{ message: string }>;
};

export async function fetchScorecardNames(
  config: Pick<ApiConfig, 'apiToken' | 'email' | 'baseUrl' | 'cloudId'>
): Promise<Map<string, string>> {
  const resolvedToken = resolveValue(config.apiToken);
  const resolvedEmail = resolveValue(config.email);
  const endpoint = `${config.baseUrl.replace(/\/$/, '')}/gateway/api/graphql`;
  const authHeader = buildAuthHeader(resolvedEmail, resolvedToken);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
        Accept: 'application/json',
      },
      body: JSON.stringify({
        query: GET_SCORECARDS_QUERY,
        variables: { cloudId: config.cloudId },
      }),
    });

    if (!response.ok) {
      console.warn(`Could not fetch scorecard names (HTTP ${response.status}), will use short IDs`);
      return new Map();
    }

    const result = (await response.json()) as GetScorecardsResponse;
    if (result.errors || !result.data?.compass?.scorecards?.nodes) {
      console.warn('Could not fetch scorecard names from API, will use short IDs');
      return new Map();
    }

    const map = new Map<string, string>();
    for (const sc of result.data.compass.scorecards.nodes) {
      map.set(sc.id, sc.name);
    }
    return map;
  } catch {
    console.warn('Failed to fetch scorecard names, will use short IDs');
    return new Map();
  }
}

export async function fetchComponents(config: ApiConfig, scorecardNames?: Map<string, string>): Promise<CompassConfig[]> {
  const resolvedToken = resolveValue(config.apiToken);
  const resolvedEmail = resolveValue(config.email);
  const endpoint = `${config.baseUrl.replace(/\/$/, '')}/gateway/api/graphql`;
  const authHeader = buildAuthHeader(resolvedEmail, resolvedToken);

  const components: CompassConfig[] = [];
  let cursor: string | null = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const variables: Record<string, unknown> = {
      cloudId: config.cloudId,
      after: cursor,
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
        Accept: 'application/json',
      },
      body: JSON.stringify({
        query: SEARCH_COMPONENTS_QUERY,
        variables,
      }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Compass API authentication failed: invalid email or API token');
      }
      if (response.status === 403) {
        throw new Error('Compass API authorization failed: insufficient permissions');
      }
      if (response.status === 429) {
        throw new Error('Compass API rate limit exceeded: too many requests');
      }
      throw new Error(`Compass API request failed with status ${response.status}`);
    }

    const result = (await response.json()) as SearchComponentsResponse;

    if (result.errors && result.errors.length > 0) {
      throw new Error(`Compass GraphQL error: ${result.errors[0].message}`);
    }

    if (!result.data) {
      throw new Error('Compass API returned no data');
    }

    const searchResult = result.data.compass.searchComponents;

    if (searchResult.__typename === 'QueryError') {
      throw new Error(`Compass API error: ${searchResult.message || 'Unknown error'}`);
    }

    if (!searchResult.nodes || !searchResult.pageInfo) {
      throw new Error('Compass API returned unexpected response structure');
    }

    for (const node of searchResult.nodes) {
      components.push(mapComponent(node.component, scorecardNames));
    }

    hasNextPage = searchResult.pageInfo.hasNextPage;
    cursor = searchResult.pageInfo.endCursor;
  }

  return components;
}
