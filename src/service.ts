import { CompassConfig } from './compass';
import { Service } from './types';

enum UrlTypeToIcon {
    CHAT_CHANNEL = '💬',
    DOCUMENT = '📖',
    DASHBOARD = '👀',
    ON_CALL = '📲',
    PROJECT = '🚀',
    REPOSITORY = '🏡',
    OTHER_LINK = '⭐',
}


export const defaultMarkdown = (config: CompassConfig, compassComponentUrl?: string, compassTeamUrl?: string) => {
  return `

## Links

* 🧭 [Compass Component](${compassComponentUrl})
* 🪂 [Compass Team](${compassTeamUrl})
${config.links
  ?.filter((link) => link.name)
  .map((link) => `* ${UrlTypeToIcon[link.type]} [${link.name}](${link.url})`)
  .join('\n')}

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

export function loadService(
  config: CompassConfig,
  compassUrl: string,
  serviceVersion: string = '0.0.0',
  serviceId: string = config.name
): Service {
  const markdownTemplate = defaultMarkdown(config, getComponentUrl(compassUrl, config), getTeamUrl(compassUrl, config));

  return {
    id: serviceId,
    name: config.name,
    version: serviceVersion,
    summary: config.description || '',
    markdown: markdownTemplate,
  };
}
