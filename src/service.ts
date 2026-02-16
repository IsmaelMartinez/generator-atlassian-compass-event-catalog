import { CompassConfig } from './compass';
import { Service, Badge, ResolvedDependency, MarkdownTemplateFn } from './types';

// Sanitize text for safe markdown/MDX embedding: escape HTML special chars and markdown link syntax
function sanitizeMarkdownText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/[[\]()]/g, (char) => `\\${char}`);
}

// Sanitize URL for safe markdown link embedding: only allow http/https protocols
function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return url.replace(/[()]/g, (char) => encodeURIComponent(char));
    }
    return '';
  } catch {
    return '';
  }
}

enum UrlTypeToIcon {
  CHAT_CHANNEL = '💬',
  DOCUMENT = '📖',
  DASHBOARD = '👀',
  ON_CALL = '📲',
  PROJECT = '🚀',
  REPOSITORY = '🏡',
  OTHER_LINK = '⭐',
}

const lifecycleColors: Record<string, { backgroundColor: string; textColor: string }> = {
  Active: { backgroundColor: '#22c55e', textColor: '#fff' },
  'Pre-release': { backgroundColor: '#f59e0b', textColor: '#fff' },
  Deprecated: { backgroundColor: '#ef4444', textColor: '#fff' },
};

const tierColors: Record<number, { backgroundColor: string; textColor: string }> = {
  1: { backgroundColor: '#3b82f6', textColor: '#fff' },
  2: { backgroundColor: '#6366f1', textColor: '#fff' },
  3: { backgroundColor: '#8b5cf6', textColor: '#fff' },
  4: { backgroundColor: '#a78bfa', textColor: '#fff' },
};

function buildBadges(config: CompassConfig): Badge[] {
  const badges: Badge[] = [];

  if (config.typeId) {
    badges.push({
      content: config.typeId,
      backgroundColor: '#6366f1',
      textColor: '#fff',
    });
  }

  if (config.fields?.lifecycle) {
    const colors = lifecycleColors[config.fields.lifecycle] || { backgroundColor: '#6b7280', textColor: '#fff' };
    badges.push({
      content: config.fields.lifecycle,
      ...colors,
    });
  }

  if (config.fields?.tier) {
    const colors = tierColors[config.fields.tier] || { backgroundColor: '#6b7280', textColor: '#fff' };
    badges.push({
      content: `Tier ${config.fields.tier}`,
      ...colors,
    });
  }

  if (config.labels) {
    for (const label of config.labels) {
      badges.push({
        content: label,
        backgroundColor: '#e5e7eb',
        textColor: '#374151',
      });
    }
  }

  return badges;
}

function getRepositoryUrl(config: CompassConfig): string | undefined {
  return config.links?.find((link) => link.type === 'REPOSITORY')?.url;
}

// Extract team UUID from Compass ownerId ARN (e.g., ari:cloud:teams::team/UUID -> UUID)
export function extractTeamId(ownerId: string): string | undefined {
  const parts = ownerId.split('/');
  const teamId = parts[parts.length - 1];
  return teamId || undefined;
}

function getOwners(config: CompassConfig): string[] {
  if (!config.ownerId) return [];
  const teamId = extractTeamId(config.ownerId);
  return teamId ? [teamId] : [];
}

export const defaultMarkdown = (
  config: CompassConfig,
  compassComponentUrl?: string,
  compassTeamUrl?: string,
  dependencies?: ResolvedDependency[]
) => {
  const safeComponentUrl = compassComponentUrl ? sanitizeUrl(compassComponentUrl) : '';
  const safeTeamUrl = compassTeamUrl ? sanitizeUrl(compassTeamUrl) : '';

  const linkLines = config.links
    ?.filter((link) => link.name)
    .map((link) => {
      const safeName = sanitizeMarkdownText(link.name || '');
      const safeUrl = sanitizeUrl(link.url);
      if (!safeUrl) return null;
      return `* ${UrlTypeToIcon[link.type]} [${safeName}](${safeUrl})`;
    })
    .filter(Boolean)
    .join('\n');

  const dependencyLines =
    dependencies && dependencies.length > 0
      ? dependencies.map((dep) => `* [${sanitizeMarkdownText(dep.name)}](/docs/services/${dep.id})`).join('\n')
      : 'No known dependencies.';

  return `

## Links

* 🧭 [Compass Component](${safeComponentUrl})
* 🪂 [Compass Team](${safeTeamUrl})
${linkLines}

## Dependencies

${dependencyLines}

## Architecture diagram

<NodeGraph />

`;
};

const getComponentUrl = (compassUrl: string, config: CompassConfig) => {
  const parts = config?.id?.split('/');
  let componentId = '/components';
  if (parts) {
    componentId = `/component/${parts[parts.length - 1]}`;
  }
  return `${compassUrl}${componentId}`;
};

const getTeamUrl = (compassUrl: string, config: CompassConfig) => {
  const parts = config?.ownerId?.split('/');
  if (parts) {
    return `${compassUrl}/people/team/${parts[parts.length - 1]}`;
  }
};

function getOpenApiSpecifications(config: CompassConfig): Array<{ type: 'openapi'; path: string; name?: string }> {
  if (!config.links) return [];
  const specs: Array<{ type: 'openapi'; path: string; name?: string }> = [];
  for (const link of config.links) {
    if (!link.name) continue;
    const nameLower = link.name.toLowerCase();
    if (nameLower.includes('openapi') || nameLower.includes('swagger')) {
      const safeUrl = sanitizeUrl(link.url);
      if (safeUrl) {
        specs.push({ type: 'openapi', path: safeUrl, name: link.name });
      }
    }
  }
  return specs;
}

export function loadService(
  config: CompassConfig,
  compassUrl: string,
  serviceVersion: string = '0.0.0',
  serviceId: string = config.name,
  dependencies?: ResolvedDependency[],
  customMarkdownTemplate?: MarkdownTemplateFn
): Service {
  const markdown = customMarkdownTemplate
    ? customMarkdownTemplate(config, dependencies || [])
    : defaultMarkdown(config, getComponentUrl(compassUrl, config), getTeamUrl(compassUrl, config), dependencies);
  const badges = buildBadges(config);
  const repositoryUrl = getRepositoryUrl(config);
  const owners = getOwners(config);
  const specifications = getOpenApiSpecifications(config);

  const service: Service = {
    id: serviceId,
    name: config.name,
    version: serviceVersion,
    summary: config.description || '',
    markdown,
  };

  if (badges.length > 0) {
    service.badges = badges;
  }

  if (repositoryUrl) {
    service.repository = { url: repositoryUrl };
  }

  if (owners.length > 0) {
    service.owners = owners;
  }

  if (specifications.length > 0) {
    service.specifications = specifications;
  }

  return service;
}
