import utils from '@eventcatalog/sdk';
import chalk from 'chalk';
import { loadConfig, CompassConfig } from './compass';
import { loadService, extractTeamId } from './service';
import Domain from './domain';
import { GeneratorProps, ResolvedDependency, ServiceIdStrategy } from './types';
export type { StructuredLink } from './types';
import { GeneratorPropsSchema } from './validation';
import { fetchComponents, fetchTeamById } from './compass-api';
import { sanitizeId, sanitizeHtml } from './sanitize';

// Resolve service ID based on strategy
function resolveServiceId(config: CompassConfig, strategy: ServiceIdStrategy | undefined, fileId?: string): string {
  // If a file-level override ID is provided (YAML mode), it takes precedence
  if (fileId) return sanitizeId(fileId);

  if (typeof strategy === 'function') {
    return sanitizeId(strategy(config));
  }

  if (strategy === 'compass-id') {
    return sanitizeId(config.id || config.name);
  }

  // Default: 'name'
  return sanitizeId(config.name);
}

// The event.catalog.js values for your plugin
type EventCatalogConfig = Record<string, unknown>;

type ProcessableEntry = {
  config: CompassConfig;
  serviceId: string;
  version: string;
};

export default async (_config: EventCatalogConfig, options: GeneratorProps) => {
  // Validate configuration
  GeneratorPropsSchema.parse(options);

  if (!process.env.PROJECT_DIR) {
    process.env.PROJECT_DIR = process.cwd();
  }

  const projectDir = process.env.PROJECT_DIR;

  if (options.debug) {
    console.debug(chalk.magenta('Configuration provided', JSON.stringify(_config)));
    const { api, markdownTemplate: _tpl, ...safeOptions } = options;
    if (api) {
      const { apiToken: _token, email: _email, ...safeApi } = api;
      console.debug(
        chalk.magenta(
          'Generator properties',
          JSON.stringify({
            ...safeOptions,
            api: { ...safeApi, apiToken: '***', email: '***' },
            markdownTemplate: _tpl ? '[Function]' : undefined,
          })
        )
      );
    } else {
      console.debug(
        chalk.magenta(
          'Generator properties',
          JSON.stringify({ ...safeOptions, markdownTemplate: _tpl ? '[Function]' : undefined })
        )
      );
    }
  }

  // EventCatalog SDK (https://www.eventcatalog.dev/docs/sdk)
  const { getService, writeService, writeTeam } = utils(projectDir);

  const format = options.format || 'mdx';
  const teamsWritten = new Set<string>();

  let domain = null;

  if (options.domain) {
    domain = new Domain(options.domain.id, options.domain.name, options.domain.version, projectDir);
    await domain.processDomain();
  }

  // First pass: build processable entries from either API or YAML mode
  const serviceMap = new Map<string, { serviceId: string; name: string }>();
  const processableEntries: ProcessableEntry[] = [];
  let loadFailureCount = 0;
  const loadFailures: Array<{ name: string; error: string }> = [];

  if (options.api) {
    // API mode: fetch components from Compass GraphQL API
    console.log(chalk.green('Fetching components from Compass API...'));
    const components = await fetchComponents(options.api);
    console.log(chalk.green(`Fetched ${components.length} components from Compass API`));

    for (const config of components) {
      // Apply top-level typeFilter (api.typeFilter is handled server-side in the query)
      if (options.typeFilter && options.typeFilter.length > 0) {
        if (!config.typeId || !options.typeFilter.includes(config.typeId)) {
          console.log(chalk.yellow(`\nSkipping ${config.name} (type ${config.typeId || 'unknown'} not in typeFilter)`));
          continue;
        }
      }

      // Apply nameFilter to only process specific components
      if (options.nameFilter && options.nameFilter.length > 0) {
        if (!options.nameFilter.includes(config.name)) {
          continue;
        }
      }

      // Apply nameMapping: if the component name has a mapping, use the mapped value as service ID
      const mappedId = options.nameMapping?.[config.name];
      const serviceId = mappedId ? sanitizeId(mappedId) : resolveServiceId(config, options.serviceIdStrategy);
      if (config.id) {
        serviceMap.set(config.id, { serviceId, name: config.name });
      }
      processableEntries.push({ config, serviceId, version: options.defaultVersion || '0.0.0' });
    }
  } else if (options.services) {
    // YAML mode: read local files (existing behavior)
    const compassFiles = Array.isArray(options.services) ? options.services : [options.services];
    console.log(chalk.green(`Processing ${compassFiles.length} Compass files...`));

    for (const file of compassFiles) {
      try {
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

        const serviceId = resolveServiceId(compassConfig, options.serviceIdStrategy, file.id);
        if (compassConfig.id) {
          serviceMap.set(compassConfig.id, { serviceId, name: compassConfig.name });
        }
        processableEntries.push({ config: compassConfig, serviceId, version: file.version || options.defaultVersion || '0.0.0' });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(chalk.red(`\n✗ Failed to load ${file.path}: ${errorMessage}`));
        loadFailureCount++;
        loadFailures.push({ name: file.path, error: errorMessage });
      }
    }
  }

  // Second pass: write services with resolved dependencies
  const dryRun = options.dryRun === true;
  let successCount = 0;
  let failureCount = loadFailureCount;
  const failures: Array<{ name: string; error: string }> = [...loadFailures];

  if (dryRun) {
    console.log(chalk.yellow('\n[DRY RUN] No changes will be written to the catalog.\n'));
  }

  for (const { config: compassConfig, serviceId, version } of processableEntries) {
    try {
      console.log(chalk.blue(`\nProcessing component: ${compassConfig.name} (type: ${compassConfig.typeId || 'unknown'})`));

      if (domain && !dryRun) {
        // Add the service to the domain
        await domain.addServiceToDomain(serviceId, version);
      } else if (domain && dryRun) {
        console.log(chalk.yellow(` - [DRY RUN] Would add service ${serviceId} to domain ${domain.id}`));
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

      // Write team entity if ownerId is present and not yet written
      if (compassConfig.ownerId) {
        const rawTeamId = extractTeamId(compassConfig.ownerId);
        if (rawTeamId) {
          const teamId = sanitizeId(rawTeamId);
          if (!teamsWritten.has(teamId)) {
            // In API mode, try to fetch team display name from Compass
            let teamName: string | null = null;
            if (options.api && !dryRun) {
              try {
                const teamData = await fetchTeamById(options.api, rawTeamId);
                if (teamData?.displayName) {
                  teamName = sanitizeHtml(teamData.displayName);
                } else {
                  console.warn(chalk.yellow(` - Could not resolve team name for ${rawTeamId}, skipping team creation`));
                }
              } catch {
                console.warn(chalk.yellow(` - Failed to fetch team name for ${rawTeamId}`));
              }
            } else if (!options.api) {
              // YAML mode: use the UUID as name (no API to resolve)
              teamName = teamId;
            }
            if (teamName && !dryRun) {
              await writeTeam({ id: teamId, name: teamName, markdown: '' }, { override: true });
              console.log(chalk.cyan(` - Team ${teamId} (${teamName}) created`));
            } else if (teamName && dryRun) {
              console.log(chalk.yellow(` - [DRY RUN] Would create team ${teamId} (${teamName})`));
            }
            teamsWritten.add(teamId);
          }
        }
      }

      const compassService = loadService(
        compassConfig,
        options.compassUrl.replace(/\/$/, ''),
        version,
        serviceId,
        dependencies,
        options.markdownTemplate,
        options.badges ?? true
      );

      if (dryRun) {
        console.log(
          chalk.yellow(` - [DRY RUN] Would write service ${compassConfig.name} (id: ${serviceId}, version: ${version})`)
        );
        if (compassService.badges) {
          console.log(chalk.yellow(`   Badges: ${compassService.badges.map((b) => b.content).join(', ')}`));
        }
        if (dependencies.length > 0) {
          console.log(chalk.yellow(`   Dependencies: ${dependencies.map((d) => d.name).join(', ')}`));
        }
      } else {
        const existing = await getService(serviceId);

        if (existing && options.overrideExisting !== false) {
          await writeService(compassService, { override: true, format });
          console.log(chalk.cyan(` - Service ${compassConfig.name} updated`));
        } else if (!existing) {
          await writeService(compassService, { format });
          console.log(chalk.cyan(` - Service ${compassConfig.name} created`));
        } else {
          console.log(chalk.yellow(` - Service ${compassConfig.name} skipped (already exists)`));
        }
      }

      successCount++;
    } catch (error) {
      failureCount++;
      const errorMessage = error instanceof Error ? error.message : String(error);
      failures.push({ name: compassConfig.name, error: errorMessage });
      console.error(chalk.red(`\n✗ Failed to process ${compassConfig.name}: ${errorMessage}`));
    }
  }

  // Summary
  console.log(chalk.green(`\nFinished generating event catalog for the Compass files provided!`));
  console.log(chalk.green(`  Succeeded: ${successCount}, Failed: ${failureCount}`));
  if (failures.length > 0) {
    console.log(chalk.red('  Failures:'));
    for (const f of failures) {
      console.log(chalk.red(`    - ${f.name}: ${f.error}`));
    }
  }
  if (dryRun) {
    console.log(chalk.yellow('  [DRY RUN] No changes were written.'));
  }
};
