import { processMembers } from './users';
import utils from '@eventcatalog/sdk';
import chalk from 'chalk';

const email = '' // Your email
const apiToken = ''; // Your API token

const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');

const siteId = '0454b023-4ebe-41c7-889a-818336963ca4'
            
const getTeamMembers = `
    query GetTeamMembers ($id: ID!, $siteId: String!) {
        team {
            teamV2(
                id: $id
                siteId: $siteId
            ) {
                id 
                description
                displayName
                members {
                    nodes {
                        member {
                            name
                            picture
                            ... on AppUser {
                                name
                                picture
                            }
                            ... on AtlassianAccountUser {
                                email
                                name
                                picture
                            }
                            ... on CustomerUser {
                                email
                                name
                                picture
                            }
                        }
                    }
                }
            }
        }
    }
`


export async function loadTeam(
    teamId: string,
    projectDir: string,
) {
  
    try {
        const response = await fetch('https://api.atlassian.com/graphql', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                query: getTeamMembers,
                variables: {
                    id: teamId,
                    siteId: siteId
                }
            })
        });

        const data = await response.json();
        const { getTeam, writeTeam } = utils(projectDir);
        let team = data.data.team.teamV2;

        let users: string[] = await processMembers(projectDir, team.members.nodes);

        let teamIdentifier = team.displayName.split(' ').join('.');

        const exists = await getTeam(teamIdentifier);
        await writeTeam({
            id: teamIdentifier,
            // @ts-ignore
            members: users,
            markdown: ''
            //add link to compass team in markdown area
        }, { override: !!exists });
        console.log(chalk.cyan(` - Team ${teamIdentifier} created!`));
        
    } catch (error) {
        console.error(error);
    }
};

