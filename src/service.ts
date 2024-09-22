import { CompassConfig } from './compass';
import { Service } from './types';

export const defaultMarkdown = (config: CompassConfig, compassComponentUrl?: string, compassTeamUrl?: string) => {
  return `

## Links

<Tiles>
  ${compassComponentUrl ? `<Tile icon="RocketLaunchIcon" href="${compassComponentUrl}"  title="Compass Component" description="Open the Atlassian Compass Component in a new window" openWindow/>` : ''}
  ${compassTeamUrl ? `<Tile icon="UserGroupIcon" href="${compassTeamUrl}"  title="Compass Team" description="Open Atlassian Compass Team in a new window" openWindow/>` : ''}
${config.links
  ?.filter((link) => link.name)
  .map((link) => `<Tile href="${link.url}" openWindow title="${link.name}"/>`)
  .join('\n')}
</Tiles>

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
