import { TeamMember } from './types';
import utils from '@eventcatalog/sdk';
import chalk from 'chalk';


export async function processMembers(projectDir: string, teamMembers: TeamMember[]): Promise<string[]> {

  const { getUser, writeUser } = utils(projectDir);
            
  const members: string[] = [];
  for (const memberObject of teamMembers) {
    let userId = memberObject.member.name.split(' ').join('.');;
    members.push(memberObject.member.name.trim());
    await writeUser({
      id: userId,
      name: memberObject.member.name,
      avatarUrl: memberObject.member.picture,
      email: memberObject.member.email || '',
      markdown: '',
    }, { override: await getUser(userId) ? true : false });
    console.log(chalk.cyan(` - User ${userId} created!`));
    // console.log(chalk.yellow(` - Team ${team.displayName} already exists, skipped creation...`));
  }
  return members;
}
