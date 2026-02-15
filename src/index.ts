import utils from '@eventcatalog/sdk';
import chalk from 'chalk';
import { loadConfig, CompassConfig } from './compass';
import { loadService } from './service';
import Domain from './domain';
import { GeneratorProps, ResolvedDependency } from './types';
import { GeneratorPropsSchema } from './validation';

// Sanitize IDs to prevent path traversal from untrusted sources
function sanitizeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9-_]/g, '-');
}

// The event.catalog.js values for your plugin
type EventCatalogConfig = Record<string, unknown>;

export default async (_config: EventCatalogConfig, options: GeneratorProps) => {
  // Validate configuration
  GeneratorPropsSchema.parse(options);

  // This is set by EventCatalog. This is the directory where the catalog is stored
  console.log(chalk.green(`Processing ${options.services.length} Compass files...`));

  if (!process.env.PROJECT_DIR) {
    process.env.PROJECT_DIR = process.cwd();
  }

  const projectDir = process.env.PROJECT_DIR;

  if (options.debug) {
    console.debug(chalk.magenta('Configuration provided', JSON.stringify(_config)));
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

  // First pass: collect all services into a map (Compass ARN → service info)
  // This allows resolving DEPENDS_ON relationships between services
  const serviceMap = new Map<string, { serviceId: string; name: string; config: CompassConfig }>();

  for (const file of compassFiles) {
    const compassConfig: CompassConfig = loadConfig(file.path);

    // If typeFilter is set, skip components whose typeId is not in the list
    if (options.typeFilter && options.typeFilter.length > 0) {
      if (!compassConfig.typeId || !options.typeFilter.includes(compassConfig.typeId)) {
        continue;
      }
    }

    const serviceId = sanitizeId(file.id || compassConfig.name);
    if (compassConfig.id) {
      serviceMap.set(compassConfig.id, { serviceId, name: compassConfig.name, config: compassConfig });
    }
  }

  // Second pass: write services with resolved dependencies
  for (const file of compassFiles) {
    const compassConfig: CompassConfig = loadConfig(file.path);

    // If typeFilter is set, skip components whose typeId is not in the list
    if (options.typeFilter && options.typeFilter.length > 0) {
      if (!compassConfig.typeId || !options.typeFilter.includes(compassConfig.typeId)) {
        console.log(
          chalk.yellow(`\nSkipping ${compassConfig.name} (type ${compassConfig.typeId || 'unknown'} not in typeFilter)`)
        );
        continue;
      }
    }

    console.log(chalk.blue(`\nProcessing component: ${compassConfig.name} (type: ${compassConfig.typeId || 'unknown'})`));

    const serviceId = sanitizeId(file.id || compassConfig.name);

    if (domain) {
      // Add the service to the domain
      await domain.addServiceToDomain(serviceId, file.version);
    }

    // Resolve DEPENDS_ON relationships
    const dependencies: ResolvedDependency[] = [];
    if (compassConfig.relationships?.DEPENDS_ON) {
      for (const arn of compassConfig.relationships.DEPENDS_ON) {
        const target = serviceMap.get(arn);
        if (target) {
          dependencies.push({ id: target.serviceId, name: target.name });
        } else {
          console.log(chalk.yellow(` - Dependency ${arn} not found in processed services, skipping`));
        }
      }
    }

    const existing = await getService(serviceId);
    const compassService = loadService(
      compassConfig,
      options.compassUrl.replace(/\/$/, ''),
      file.version,
      serviceId,
      dependencies
    );

    if (existing && options.overrideExisting !== false) {
      await writeService(compassService, { override: true });
      console.log(chalk.cyan(` - Service ${compassConfig.name} updated`));
    } else if (!existing) {
      await writeService(compassService);
      console.log(chalk.cyan(` - Service ${compassConfig.name} created`));
    } else {
      console.log(chalk.yellow(` - Service ${compassConfig.name} skipped (already exists)`));
    }
  }
  console.log(chalk.green(`\nFinished generating event catalog for the Compass files provided!`));
};
