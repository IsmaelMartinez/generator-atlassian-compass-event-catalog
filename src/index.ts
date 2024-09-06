import utils from '@eventcatalog/sdk';
import chalk from 'chalk';
import { loadConfig, CompassConfig } from './compass';
import { loadService } from './service';

type DomainOption = {
  id: string;
  name: string;
  version: string;
};

// The event.catalog.js values for your plugin
type EventCatalogConfig = any;

// Configuration the users give your catalog
type GeneratorProps = {
  path: string | string[];
  compassUrl: string;
  domain?: DomainOption;
};

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
  const { 
    addServiceToDomain,
    getDomain,
    getService,
    writeService,
    writeDomain,
    versionDomain,
   } = utils(projectDir);

  if (options.domain) {
    // Try and get the domain
    const domain = await getDomain(options.domain.id, options.domain.version || 'latest');
    const currentDomain = await getDomain(options.domain.id, 'latest');

    console.log(chalk.blue(`\nProcessing domain: ${options.domain.name} (v${options.domain.version})`));

    // Found a domain, but the versions do not match
    if (currentDomain && currentDomain.version !== options.domain.version) {
        await versionDomain(options.domain.id);
        console.log(chalk.cyan(` - Versioned previous domain (v${currentDomain.version})`));
    }

    // Do we need to create a new domain?
    if (!domain || (domain && domain.version !== options.domain.version)) {
        await writeDomain({
            id: options.domain.id,
            name: options.domain.name,
            version: options.domain.version,
            markdown: `## Architecture diagram
  <NodeGraph />`,
        });
        console.log(chalk.cyan(` - Domain (v${options.domain.version}) created`));
    }

    if (currentDomain && currentDomain.version === options.domain.version) {
        console.log(chalk.yellow(` - Domain (v${options.domain.version}) already exists, skipped creation...`));
    }
  }

  for (const path of compassFiles) {
    const compassConfig: CompassConfig = loadConfig(path);
    
    if (compassConfig.typeId !== 'SERVICE') {
      throw new Error('Only SERVICE type is supported');
    }

    if (options.domain){
      // Add the service to the domain
      await addServiceToDomain(options.domain.id, 
        {
          id: compassConfig.name,
          version: '1',
        }, options.domain.version);
      console.log(chalk.green(`Service added to domain ${options.domain.id}!`));
    }
    // Example, get an existing service
    const service = await getService(compassConfig.name);

    if (!service) {
      await writeService(loadService(compassConfig, options.compassUrl.replace(/\/$/, '')));
      console.log(chalk.green(`Service ${compassConfig.name} created!`));
    } else {
      console.log(chalk.yellow(`Service ${compassConfig.name} already exists!`));
    }
  }

};
