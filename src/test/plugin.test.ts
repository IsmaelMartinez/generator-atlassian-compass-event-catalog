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

describe('MyPlugin test', () => {

  beforeEach(() => {
    catalogDir = join(__dirname, 'catalog') || '';
    process.env.PROJECT_DIR = catalogDir;
  });

  afterEach(async () => {
    await fs.rm(join(catalogDir), { recursive: true });
  });

  it('creates a test event in the catalog', async () => {
    const { getEvent } = utils(catalogDir);
    await plugin(eventCatalogConfig, {});

    const event = await getEvent('my-event');
    expect(event).toBeDefined();

    expect(event).toEqual({
      "id": "my-event",
      "name": "My Event",
      "version": "1.0.0",
      "summary": "This is my event",
      "badges": [
        {
          "content": "Event",
          "textColor": "blue",
          "backgroundColor": "blue"
        }
      ],
      "markdown": "This is my event"
    })

  });

});
