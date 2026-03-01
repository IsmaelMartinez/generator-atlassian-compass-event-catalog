import { CompassConfig } from './compass';
import { Service, Badge, ResolvedDependency, MarkdownTemplateFn, StructuredLink } from './types';
import { sanitizeHtml } from './sanitize';

// Sanitize text for safe markdown/MDX embedding: escape HTML special chars and markdown link syntax
function sanitizeMarkdownText(text: string): string {
  return sanitizeHtml(text).replace(/[[\]()]/g, (char) => `\\${char}`);
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

const UrlTypeToCategory: Record<string, string> = {
  CHAT_CHANNEL: 'Chat Channel',
  DOCUMENT: 'Document',
  DASHBOARD: 'Dashboard',
  ON_CALL: 'On-Call',
  PROJECT: 'Project',
  REPOSITORY: 'Repository',
  OTHER_LINK: 'Other',
};

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

const typeIdToIcon: Record<string, string> = {
  APPLICATION: 'app-window',
  SERVICE: 'server',
  CAPABILITY: 'puzzle',
  CLOUD_RESOURCE: 'cloud',
  DATA_PIPELINE: 'workflow',
  LIBRARY: 'library',
  MACHINE_LEARNING_MODEL: 'brain',
  OTHER: 'box',
  UI_ELEMENT: 'layout',
  WEBSITE: 'globe',
};

const LINK_CATEGORIES: Array<{ label: string; types: string[] }> = [
  { label: 'Development', types: ['REPOSITORY', 'PROJECT'] },
  { label: 'Operations', types: ['DASHBOARD', 'ON_CALL', 'CHAT_CHANNEL'] },
  { label: 'Documentation', types: ['DOCUMENT'] },
  { label: 'Other', types: ['OTHER_LINK'] },
];

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

export function buildStructuredLinks(
  config: CompassConfig,
  compassComponentUrl?: string,
  compassTeamUrl?: string
): StructuredLink[] {
  const links: StructuredLink[] = [];

  const safeComponentUrl = compassComponentUrl ? sanitizeUrl(compassComponentUrl) : '';
  if (safeComponentUrl) {
    links.push({ url: safeComponentUrl, title: 'Compass Component', type: 'Compass', icon: '🧭', rawType: 'COMPASS_COMPONENT' });
  }

  const safeTeamUrl = compassTeamUrl ? sanitizeUrl(compassTeamUrl) : '';
  if (safeTeamUrl) {
    links.push({ url: safeTeamUrl, title: 'Compass Team', type: 'Compass', icon: '🪂', rawType: 'COMPASS_TEAM' });
  }

  for (const link of config.links ?? []) {
    const safeUrl = sanitizeUrl(link.url);
    if (!safeUrl) continue;
    const title = link.name || new URL(safeUrl).hostname;
    links.push({
      url: safeUrl,
      title,
      type: UrlTypeToCategory[link.type] ?? 'Other',
      icon: UrlTypeToIcon[link.type] ?? '🔗',
      rawType: link.type,
    });
  }

  return links;
}

function toTitleCase(text: string): string {
  return text
    .split(' ')
    .map((word) => (word.length > 0 ? word[0].toUpperCase() + word.slice(1).toLowerCase() : ''))
    .join(' ');
}

function buildCustomFieldsTable(config: CompassConfig): string {
  if (!config.customFields || config.customFields.length === 0) return '';

  const rows = config.customFields.map((field) => {
    const safeName = sanitizeMarkdownText(toTitleCase(field.name)).replace(/\|/g, '\\|');
    // js-yaml parses unquoted true/false as native booleans
    const isBoolean = field.type === 'boolean' || typeof (field.value as unknown) === 'boolean';
    const safeValue = isBoolean
      ? (field.value as unknown) === true || field.value === 'true'
        ? '✅'
        : '❌'
      : sanitizeMarkdownText(String(field.value)).replace(/\|/g, '\\|');
    return `| ${safeName} | ${safeValue} |`;
  });

  return `## Custom Fields

| Field Name | Value |
|---|---|
${rows.join('\n')}`;
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

  // Bucket user links by category label
  const buckets = new Map<string, string[]>(LINK_CATEGORIES.map((c) => [c.label, []]));

  for (const link of config.links ?? []) {
    const safeUrl = sanitizeUrl(link.url);
    if (!safeUrl) continue;
    const label = link.name || new URL(safeUrl).hostname;
    const safeName = sanitizeMarkdownText(label);
    const icon = UrlTypeToIcon[link.type] || '🔗';
    const bullet = `* ${icon} [${safeName}](${safeUrl})`;

    const category = LINK_CATEGORIES.find((c) => c.types.includes(link.type));
    const bucketKey = category?.label ?? 'Other';
    buckets.get(bucketKey)?.push(bullet);
  }

  // Build subsection blocks. "Compass" is always first.
  const subsections: string[] = [];

  const compassLines: string[] = [];
  if (safeComponentUrl) compassLines.push(`* 🧭 [Compass Component](${safeComponentUrl})`);
  if (safeTeamUrl) compassLines.push(`* 🪂 [Compass Team](${safeTeamUrl})`);
  if (compassLines.length > 0) {
    subsections.push(`### Compass\n\n${compassLines.join('\n')}`);
  }

  for (const { label } of LINK_CATEGORIES) {
    const lines = buckets.get(label);
    if (lines && lines.length > 0) {
      subsections.push(`### ${label}\n\n${lines.join('\n')}`);
    }
  }

  const linksBlock = subsections.length > 0 ? subsections.join('\n\n') : '';

  const customFieldsSection = buildCustomFieldsTable(config);

  const dependencyLines =
    dependencies && dependencies.length > 0
      ? dependencies.map((dep) => `* [${sanitizeMarkdownText(dep.name)}](../../${dep.id}/)`).join('\n')
      : 'No known dependencies.';

  return `

## Links

${linksBlock}
${customFieldsSection ? '\n' + customFieldsSection + '\n' : ''}
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

type SpecType = 'openapi' | 'asyncapi';

function isRemoteUrl(path: string): boolean {
  return path.startsWith('http://') || path.startsWith('https://');
}

function sanitizeLocalPath(path: string): string | null {
  // Reject absolute paths and path traversal sequences
  if (path.startsWith('/') || /(?:^|[\\/])\.\.(?:[\\/]|$)/.test(path)) return null;
  return path;
}

function getSpecifications(config: CompassConfig): Array<{ type: SpecType; path: string; name?: string }> {
  if (!config.links) return [];
  const specs: Array<{ type: SpecType; path: string; name?: string }> = [];
  for (const link of config.links) {
    if (!link.name) continue;
    // Skip remote URLs — EventCatalog expects local file paths for specifications.
    // Remote links are already rendered in the markdown body.
    if (isRemoteUrl(link.url)) continue;
    const safePath = sanitizeLocalPath(link.url);
    if (!safePath) continue;
    const nameLower = link.name.toLowerCase();
    if (nameLower.includes('openapi') || nameLower.includes('swagger')) {
      specs.push({ type: 'openapi', path: safePath, name: link.name });
    } else if (nameLower.includes('asyncapi')) {
      specs.push({ type: 'asyncapi', path: safePath, name: link.name });
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
  const componentUrl = getComponentUrl(compassUrl, config);
  const teamUrl = getTeamUrl(compassUrl, config);
  const structuredLinks = buildStructuredLinks(config, componentUrl, teamUrl);

  const markdown = customMarkdownTemplate
    ? customMarkdownTemplate(config, dependencies || [], structuredLinks)
    : defaultMarkdown(config, componentUrl, teamUrl, dependencies);
  const badges = buildBadges(config);
  const repositoryUrl = getRepositoryUrl(config);
  const owners = getOwners(config);
  const specifications = getSpecifications(config);

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

  if (structuredLinks.length > 0) {
    service.attachments = structuredLinks.map((link) => ({
      url: link.url,
      title: link.title,
      type: link.type,
      icon: link.icon,
    }));
  }

  if (dependencies && dependencies.length > 0) {
    service.sends = dependencies.map((dep) => ({ id: dep.id }));
  }

  if (config.typeId) {
    const icon = typeIdToIcon[config.typeId];
    if (icon) {
      service.styles = { icon };
    }
  }

  return service;
}
