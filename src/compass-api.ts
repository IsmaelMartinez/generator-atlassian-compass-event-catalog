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
  scorecard: {
    name: string;
  };
  score: number;
  maxScore: number;
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
    nodes: Array<{
      type: string;
      nodeId: string;
    }>;
  } | null;
  labels: Array<{ name: string }> | null;
  customFields: Array<{
    definition: { name: string; type: string };
    textValue?: string;
    booleanValue?: boolean;
    numberValue?: number;
  }> | null;
  scorecardScores: GraphQLScorecardScore[] | null;
};

type SearchComponentsResponse = {
  data?: {
    compass: {
      searchComponents: {
        nodes: Array<{ component: GraphQLComponent }>;
        pageInfo: {
          hasNextPage: boolean;
          endCursor: string | null;
        };
      };
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
  query searchComponents($cloudId: String!, $after: String, $types: [CompassComponentType!]) {
    compass {
      searchComponents(
        cloudId: $cloudId
        query: { after: $after, first: 50, componentTypes: $types }
      ) {
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
                nodes {
                  type
                  nodeId
                }
              }
              labels { name }
              customFields {
                definition { name type }
                textValue
                booleanValue
                numberValue
              }
              scorecardScores {
                scorecard { name }
                score
                maxScore
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

function mapTier(value: string | null | undefined): 1 | 2 | 3 | 4 | undefined {
  if (!value) return undefined;
  const match = value.match(/(\d)/);
  if (match) {
    const num = parseInt(match[1], 10);
    if (num >= 1 && num <= 4) return num as 1 | 2 | 3 | 4;
  }
  return undefined;
}

function mapLifecycle(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  // API may return uppercase (ACTIVE) or title case (Active) — normalize both
  const normalized = value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
  const valid: Record<string, string> = {
    Active: 'Active',
    'Pre-release': 'Pre-release',
    Prerelease: 'Pre-release',
    Deprecated: 'Deprecated',
  };
  return valid[normalized] || valid[value];
}

function extractField(fields: GraphQLField[] | null, fieldName: string): string | undefined {
  if (!fields) return undefined;
  const field = fields.find((f) => f.definition.name.toLowerCase() === fieldName.toLowerCase());
  return field?.value || undefined;
}

function mapComponent(component: GraphQLComponent): CompassConfig {
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
    const dependsOn = component.relationships.nodes.filter((r) => r.type === 'DEPENDS_ON').map((r) => r.nodeId);
    if (dependsOn.length > 0) {
      config.relationships = { DEPENDS_ON: dependsOn };
    }
  }

  if (component.labels && component.labels.length > 0) {
    config.labels = component.labels.map((l) => l.name);
  }

  if (component.customFields && component.customFields.length > 0) {
    config.customFields = component.customFields.map((cf) => ({
      type: cf.definition.type as CustomFieldType,
      name: cf.definition.name,
      value: cf.textValue ?? String(cf.booleanValue ?? cf.numberValue ?? ''),
    }));
  }

  if (component.scorecardScores && component.scorecardScores.length > 0) {
    config.scorecards = component.scorecardScores.map((sc) => ({
      name: sc.scorecard.name,
      score: sc.score,
      maxScore: sc.maxScore,
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
    return null;
  }

  const result = (await response.json()) as GetTeamResponse;

  if (result.errors || !result.data) {
    return null;
  }

  const team = result.data.team.teamById.team;
  if (!team) {
    return null;
  }

  return { id: team.teamId, displayName: team.displayName };
}

export async function fetchComponents(config: ApiConfig): Promise<CompassConfig[]> {
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

    if (config.typeFilter && config.typeFilter.length > 0) {
      variables.types = config.typeFilter;
    }

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
    for (const node of searchResult.nodes) {
      components.push(mapComponent(node.component));
    }

    hasNextPage = searchResult.pageInfo.hasNextPage;
    cursor = searchResult.pageInfo.endCursor;
  }

  return components;
}
