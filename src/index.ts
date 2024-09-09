import utils from '@eventcatalog/sdk';
import chalk from 'chalk';
import { loadConfig, CompassConfig } from './compass';
import { loadService } from './service';
import Domain from './domain';
import { GeneratorProps } from './types';

// The event.catalog.js values for your plugin
type EventCatalogConfig = any;

export default async (config: EventCatalogConfig, options: GeneratorProps) => {
  // This is set by EventCatalog. This is the directory where the catalog is stored
  const projectDir = process.env.PROJECT_DIR;

  if (!projectDir) {
    throw new Error('Please provide catalog url (env variable PROJECT_DIR)');
  }

  console.debug(chalk.green('processing config', JSON.stringify(config)));
  console.log('options', options);
  const compassFiles = Array.isArray(options.path) ? options.path : [options.path];

  // EventCatalog SDK (https://www.eventcatalog.dev/docs/sdk)
  const { getService, writeService } = utils(projectDir);

  let domain = null;

  if (options.domain) {
    domain = new Domain(options.domain.id, options.domain.name, options.domain.version, projectDir);
    await domain.processDomain();
  }

  for (const path of compassFiles) {
    const compassConfig: CompassConfig = loadConfig(path);

    if (compassConfig.typeId !== 'SERVICE') {
      throw new Error('Only SERVICE type is supported');
    }

    if (domain) {
      // Add the service to the domain
      await domain.addServiceToDomain(compassConfig);
    }
    const service = await getService(compassConfig.name);

    if (!service) {
      await writeService(loadService(compassConfig, options.compassUrl.replace(/\/$/, '')));
      console.log(chalk.green(`Service ${compassConfig.name} created!`));
    } else {
      console.log(chalk.yellow(`Service ${compassConfig.name} already exists!`));
    }
  }
};
