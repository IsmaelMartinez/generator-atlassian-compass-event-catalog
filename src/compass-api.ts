import { CompassConfig } from './compass';
import { ApiConfig } from './types';

// Type-level extraction from CompassConfig to avoid importing internal enums
type LinkType = NonNullable<CompassConfig['links']>[number]['type'];
type FieldType = NonNullable<CompassConfig['fields']>;
type CustomFieldType = NonNullable<CompassConfig['customFields']>[number]['type'];

// GraphQL response types
type GraphQLComponent = {
  id: string;
  name: string;
  type: string;
  description: string | null;
  ownerId: string | null;
  fields: {
    lifecycle: { label: string } | null;
    tier: { label: string } | null;
  } | null;
  links: Array<{
    type: string;
    url: string;
    name: string | null;
  }> | null;
  relationships: {
    nodes: Array<{
      type: string;
      endNodeAri: string;
    }>;
  } | null;
  labels: string[] | null;
  customFields: Array<{
    definition: { name: string; type: string };
    textValue?: string;
    booleanValue?: boolean;
    numberValue?: number;
  }> | null;
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
              type
              description
              ownerId
              fields {
                lifecycle { label }
                tier { label }
              }
              links {
                type
                url
                name
              }
              relationships(type: DEPENDS_ON) {
                nodes {
                  type
                  endNodeAri
                }
              }
              labels
              customFields {
                definition { name type }
                textValue
                booleanValue
                numberValue
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

function mapTier(label: string | null | undefined): 1 | 2 | 3 | 4 | undefined {
  if (!label) return undefined;
  const match = label.match(/(\d)/);
  if (match) {
    const num = parseInt(match[1], 10);
    if (num >= 1 && num <= 4) return num as 1 | 2 | 3 | 4;
  }
  return undefined;
}

function mapLifecycle(label: string | null | undefined): string | undefined {
  if (!label) return undefined;
  const valid: Record<string, string> = {
    Active: 'Active',
    'Pre-release': 'Pre-release',
    Deprecated: 'Deprecated',
  };
  return valid[label];
}

function mapComponent(component: GraphQLComponent): CompassConfig {
  const config: CompassConfig = {
    name: component.name,
    id: component.id,
    description: component.description || undefined,
    typeId: component.type as CompassConfig['typeId'],
  };

  if (component.ownerId) {
    config.ownerId = component.ownerId;
  }

  const lifecycle = mapLifecycle(component.fields?.lifecycle?.label);
  const tier = mapTier(component.fields?.tier?.label);
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
    const dependsOn = component.relationships.nodes.filter((r) => r.type === 'DEPENDS_ON').map((r) => r.endNodeAri);
    if (dependsOn.length > 0) {
      config.relationships = { DEPENDS_ON: dependsOn };
    }
  }

  if (component.labels && component.labels.length > 0) {
    config.labels = component.labels;
  }

  if (component.customFields && component.customFields.length > 0) {
    config.customFields = component.customFields.map((cf) => ({
      type: cf.definition.type as CustomFieldType,
      name: cf.definition.name,
      value: cf.textValue ?? String(cf.booleanValue ?? cf.numberValue ?? ''),
    }));
  }

  return config;
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
