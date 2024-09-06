import { CompassConfig } from './compass';

export type Service = {
    id: string
    name: string
    version: string
    summary: string
    markdown: string
}

export const defaultMarkdown = (config: CompassConfig, compassComponentUrl?: string, compassTeamUrl?: string) => {
    return `

## Architecture diagram

<NodeGraph />

## Links

${compassComponentUrl ? ` * [Atlassian Compass Component](${compassComponentUrl})` : ''}
${compassTeamUrl ? ` * [Atlassian Compass Team](${compassTeamUrl})` : ''}
${config.links?.map(link => ` * [${link.name}](${link.url})`).join("\n")}
`;

//   typeId?: TypeId
//   fields?: Field
//   relationships?: {
//       DEPENDS_ON?: string[]
//   }
//   customFields?: CustomField[]
//   labels?: string[]
  // ## Relationships
  // ${compass.config.relationships?.DEPENDS_ON?.map(dependency => `* ${dependency}`).join("\n")}
  // ## Labels
  // ${compass.config.labels?.map(label => `* ${label}`).join("\n")}
  // ## Lifecycle
  // ${compass.config.fields?.lifecycle}
  // ## Tier
  // ${compass.config.fields?.tier}
  // ## Type
  // ${compass.config.typeId}
  // ## Custom Fields
  // ${compass.config.customFields?.map(customField => `* ${customField.name}: ${customField.value}`).join("\n")}

  };

const getComponentUrl = (compassUrl: string, config: CompassConfig) => {
    const parts = config?.id?.split("/")
    let componentId = "/components";
    if (parts) {
        componentId = `/component/${parts[parts.length - 1]}`;
    }
    return `${compassUrl}${componentId}`;
}

const getTeamUrl = (compassUrl: string, config: CompassConfig) => {
    const parts = config?.ownerId?.split("/")
    if (parts) {
        return `${compassUrl}/people/team/${parts[parts.length - 1]}`;
    };
}

export function loadService(config: CompassConfig, compassUrl: string): Service {
    const markdownTemplate = defaultMarkdown(config, 
        getComponentUrl(compassUrl, config), 
        getTeamUrl(compassUrl, config)
    );

    return  {
        id: config.name,
        name: config.name,
        version: '1',
        summary: config.description || "",
        markdown: markdownTemplate 
    }
}