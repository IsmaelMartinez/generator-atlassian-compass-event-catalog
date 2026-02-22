import fs from 'fs';
import chalk from 'chalk';
import { parseTeamNames } from './hcl-parser';
import { ensureTeam, AtlassianTeam, TeamsApiConfig } from './teams-api';
import { fetchComponents, updateComponentOwner } from './compass-api';
import type { ApiConfig } from './types';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function parseArgs(): { tfvarsPath: string; mappingsPath: string; dryRun: boolean } {
  const args = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : undefined;
  };
  const tfvarsPath = get('--tfvars');
  const mappingsPath = get('--mappings');
  const dryRun = args.includes('--dry-run');

  if (!tfvarsPath) throw new Error('Missing required argument: --tfvars <path>');
  if (!mappingsPath) throw new Error('Missing required argument: --mappings <path>');

  return { tfvarsPath, mappingsPath, dryRun };
}

async function main(): Promise<void> {
  const { tfvarsPath, mappingsPath, dryRun } = parseArgs();

  const compassToken = requireEnv('COMPASS_API_TOKEN');
  const teamsToken = requireEnv('ATLASSIAN_TEAMS_TOKEN');
  const email = requireEnv('COMPASS_EMAIL');
  const cloudId = requireEnv('COMPASS_CLOUD_ID');
  const orgId = requireEnv('ATLASSIAN_ORG_ID');
  const baseUrl = requireEnv('COMPASS_BASE_URL');

  const directoryId = process.env['ATLASSIAN_DIRECTORY_ID'];

  const apiConfig: ApiConfig = { cloudId, apiToken: compassToken, email, baseUrl };
  const teamsConfig: TeamsApiConfig = { baseUrl, orgId, apiToken: teamsToken, email, siteId: cloudId, directoryId };

  if (dryRun) console.log(chalk.yellow('[DRY RUN] No changes will be made.\n'));

  // 1. Parse team names from tfvars
  const tfvarsContent = fs.readFileSync(tfvarsPath, 'utf-8');
  const teamNames = parseTeamNames(tfvarsContent);
  console.log(chalk.green(`Found ${teamNames.length} teams in ${tfvarsPath}`));

  // 2. Parse team->component mappings
  const mappings: Record<string, string[]> = JSON.parse(fs.readFileSync(mappingsPath, 'utf-8'));

  // 3. Ensure each team exists in Atlassian
  const teamAriByName = new Map<string, string>();
  let teamsFailed = 0;
  for (const name of teamNames) {
    if (dryRun) {
      console.log(chalk.yellow(`[DRY RUN] Would ensure team: ${name}`));
      teamAriByName.set(name, `ari:cloud:identity::team/dry-run-${name}`);
    } else {
      try {
        const team: AtlassianTeam = await ensureTeam(teamsConfig, name);
        teamAriByName.set(name, team.id);
        console.log(chalk.cyan(`  Team ${name} -> ${team.id}`));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(chalk.yellow(`  Warning: could not ensure team "${name}": ${msg}`));
        teamsFailed++;
      }
    }
  }
  if (teamsFailed > 0) {
    console.warn(chalk.yellow(`\n${teamsFailed} team(s) could not be created/found and will be skipped for assignment.\n`));
  }

  // 4. Fetch all Compass components to build name->ARI map
  console.log(chalk.green('\nFetching Compass components...'));
  const components = await fetchComponents(apiConfig);
  const componentAriByName = new Map(components.filter((c) => c.id && c.name).map((c) => [c.name, c.id as string]));
  console.log(chalk.green(`Fetched ${components.length} components\n`));

  // 5. Set ownerId for each component listed in mappings
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const [teamName, componentNames] of Object.entries(mappings)) {
    const teamAri = teamAriByName.get(teamName);
    if (!teamAri) {
      console.warn(chalk.yellow(`Warning: team "${teamName}" not available (not in tfvars or creation failed), skipping`));
      skipped += componentNames.length;
      continue;
    }

    for (const componentName of componentNames) {
      const componentAri = componentAriByName.get(componentName);
      if (!componentAri) {
        console.warn(chalk.yellow(`Warning: component "${componentName}" not found in Compass, skipping`));
        skipped++;
        continue;
      }

      if (dryRun) {
        console.log(chalk.yellow(`[DRY RUN] Would set "${componentName}" owner -> ${teamName}`));
        updated++;
      } else {
        try {
          await updateComponentOwner(apiConfig, componentAri, teamAri);
          console.log(chalk.cyan(`  "${componentName}" owner -> ${teamName}`));
          updated++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(chalk.red(`  Failed to update "${componentName}": ${msg}`));
          failed++;
        }
      }
    }
  }

  console.log(chalk.green(`\nDone. Updated: ${updated}, Skipped: ${skipped}, Failed: ${failed}`));
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(chalk.red(`Fatal: ${err instanceof Error ? err.message : err}`));
  process.exit(1);
});
