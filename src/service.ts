import { CompassConfig } from './compass';
import { Service } from './types';

export const defaultMarkdown = (config: CompassConfig, compassComponentUrl?: string, compassTeamUrl?: string) => {
  return `

## Architecture diagram

<NodeGraph />

## Links

${compassComponentUrl ? ` * [Atlassian Compass Component](${compassComponentUrl})` : ''}
${compassTeamUrl ? ` * [Atlassian Compass Team](${compassTeamUrl})` : ''}
${config.links
  ?.filter((link) => link.name)
  .map((link) => ` * [${link.name}](${link.url})`)
  .join('\n')}
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

export function loadService(config: CompassConfig, compassUrl: string): Service {
  const markdownTemplate = defaultMarkdown(config, getComponentUrl(compassUrl, config), getTeamUrl(compassUrl, config));

  return {
    id: config.name,
    name: config.name,
    version: config.configVersion.toString(),
    summary: config.description || '',
    markdown: markdownTemplate,
  };
}
