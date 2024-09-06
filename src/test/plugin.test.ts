import { expect, it, describe, beforeEach, afterEach } from 'vitest';
import utils from '@eventcatalog/sdk';
import plugin from '../index';
import { join } from 'node:path';
import fs from 'fs/promises';

// Fake eventcatalog config
const eventCatalogConfig = {
  title: "My EventCatalog"
};

let catalogDir: string;

const expectedMarkdown = `## Architecture diagram

<NodeGraph />

## Links

 * [Atlassian Compass Component](https://compass.atlassian.com/00000000-0000-0000-0000-000000000000)
 * [Atlassian Compass Team](https://compass.atlassian.com/people/team/00000000-0000-0000-0000-000000000000)
 * [My Jira project](https://www.example.com/projects/myproject)
 * [null](https://www.example.com/resources/)
 * [Service dashboard](https://www.example.com/dashboards/service-dashboard)
 * [Service repository](https://www.example.com/repos/my-service-repo)`;

describe('Atlassian Compass generator tests', () => {

  beforeEach(() => {
    catalogDir = join(__dirname, 'catalog') || '';
    process.env.PROJECT_DIR = catalogDir;
  });

  afterEach(async () => {
    await fs.rm(join(catalogDir), { recursive: true });
  });

  it('creates a test service in the catalog for the domain', async () => {
    const { getService, getDomain } = utils(catalogDir);
    await plugin(eventCatalogConfig, {
      "path": join(__dirname, 'my-service-compass.yml'),
      "compassUrl": "https://compass.atlassian.com",
      "domain": {
        "id": "my-domain",
        "name": "My Domain",
        "version": "0.0.1"
      }
    });

    //Validate the domain is created
    const domain = await getDomain('my-domain', '0.0.1');
    expect(domain).toBeDefined();

    expect(domain).toEqual({
      "id": "my-domain",
      "markdown": `## Architecture diagram
  <NodeGraph />`,
      "name": "My Domain",
      "version": "0.0.1",
      "services": [{"id": "my-service", "version": "1"}],
    });

    //Check that the service is created
    const service = await getService('my-service');
    expect(service).toBeDefined();

    expect(service).toEqual({
      "id": "my-service",
      "markdown": expectedMarkdown,
      "name": "my-service",
      "summary": "This is a sample component in Compass.",
      "version": "1",
    });
  });

});
