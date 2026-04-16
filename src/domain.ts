import utils from '@eventcatalog/sdk';
import chalk from 'chalk';
import type { CompassConfig } from './compass';
import type { DomainOption, DomainSpec } from './types';

function isDomainSpec(option: DomainOption): option is DomainSpec {
  return 'id' in option && 'name' in option && 'version' in option;
}

export function resolveDomain(config: CompassConfig, option: DomainOption): DomainSpec | null {
  if (isDomainSpec(option)) {
    return option;
  }

  if (option.from === 'label') {
    if (config.labels) {
      for (const label of config.labels) {
        if (Object.prototype.hasOwnProperty.call(option.mapping, label)) {
          return option.mapping[label];
        }
      }
    }
  } else if (option.from === 'customField' && option.key) {
    const field = config.customFields?.find((f) => f.name === option.key);
    if (field && typeof field.value === 'string' && Object.prototype.hasOwnProperty.call(option.mapping, field.value)) {
      return option.mapping[field.value];
    }
  }

  if (option.fallback && option.fallback !== 'skip') {
    return option.fallback;
  }
  return null;
}

export default class Domain {
  id: string;
  name: string;
  version: string;
  private sdk: ReturnType<typeof utils>;

  constructor(id: string, name: string, version: string, projectDir: string) {
    this.id = id;
    this.name = name;
    this.version = version;
    this.sdk = utils(projectDir);
  }

  async processDomain() {
    const { getDomain, writeDomain, versionDomain } = this.sdk;

    // Try and get the domain
    const domain = await getDomain(this.id, this.version || 'latest');
    const currentDomain = await getDomain(this.id, 'latest');

    console.log(chalk.blue(`\nProcessing domain: ${this.name} (v${this.version})`));

    // Found a domain, but the versions do not match
    if (currentDomain && currentDomain.version !== this.version) {
      await versionDomain(this.id);
      console.log(chalk.cyan(` - Versioned previous domain (v${currentDomain.version})`));
    }

    // Do we need to create a new domain?
    if (!domain || (domain && domain.version !== this.version)) {
      await writeDomain({
        id: this.id,
        name: this.name,
        version: this.version,
        markdown: `## Architecture diagram
  <NodeGraph />`,
      });
      console.log(chalk.cyan(` - Domain (v${this.version}) created`));
    }

    if (currentDomain && currentDomain.version === this.version) {
      console.log(chalk.yellow(` - Domain (v${this.version}) already exists, skipped creation...`));
    }
  }

  async addServiceToDomain(serviceId: string, serviceVersion: string = '0.0.0') {
    const { addServiceToDomain } = this.sdk;

    await addServiceToDomain(
      this.id,
      {
        id: serviceId,
        version: serviceVersion,
      },
      this.version
    );
    console.log(chalk.cyan(` - Service ID ${serviceId} version ${serviceVersion} added to domain ${this.id}!`));
  }
}
