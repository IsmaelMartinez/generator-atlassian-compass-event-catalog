import utils from '@eventcatalog/sdk';
import chalk from 'chalk';
import { CompassConfig } from './compass';

export default class Domain {
  id: string;
  name: string;
  version: string;
  projectDir: string;

  constructor(id: string, name: string, version: string, projectDir: string) {
    this.id = id;
    this.name = name;
    this.version = version;
    this.projectDir = projectDir;
  }

  async processDomain() {
    // EventCatalog SDK (https://www.eventcatalog.dev/docs/sdk)
    const { getDomain, writeDomain, versionDomain } = utils(this.projectDir);

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
    const { addServiceToDomain } = utils(this.projectDir);

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
