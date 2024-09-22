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
  console.log(chalk.green(`Processing ${options.services.length} Compass files...`));

  const projectDir = process.env.PROJECT_DIR;

  if (!projectDir) {
    throw new Error('Please provide catalog url (env variable PROJECT_DIR)');
  }

  if (options.debug) {
    console.debug(chalk.magenta('Configuration provided', JSON.stringify(config)));
    console.debug(chalk.magenta('Generator properties', JSON.stringify(options)));
  }
  const compassFiles = Array.isArray(options.services) ? options.services : [options.services];

  // EventCatalog SDK (https://www.eventcatalog.dev/docs/sdk)
  const { getService, writeService } = utils(projectDir);

  let domain = null;

  if (options.domain) {
    domain = new Domain(options.domain.id, options.domain.name, options.domain.version, projectDir);
    await domain.processDomain();
  }

  for (const file of compassFiles) {
    const compassConfig: CompassConfig = loadConfig(file.path);

    if (compassConfig.typeId !== 'SERVICE') {
      throw new Error('Only SERVICE type is supported');
    }

    console.log(chalk.blue(`\nProcessing service: ${compassConfig.name}`));

    if (domain) {
      // Add the service to the domain
      await domain.addServiceToDomain(file.id || compassConfig.name, file.version);
    }
    const service = await getService(file.id || compassConfig.name);

    if (!service) {
      const compassService = loadService(
        compassConfig,
        options.compassUrl.replace(/\/$/, ''),
        file.version,
        file.id
      )
      await writeService(compassService);
      console.log(chalk.cyan(` - Service ${compassConfig.name} created!`));
    } else {
      console.log(chalk.yellow(` - Service ${compassConfig.name} already exists, skipped creation...`));
    }
  }
  console.log(chalk.green(`\nFinished generating event catalog for the Compass files provided!`));
};
