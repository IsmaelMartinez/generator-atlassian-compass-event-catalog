import { processMembers } from './users';
import utils from '@eventcatalog/sdk';
import chalk from 'chalk';

const email = 'a-valid-email'; // to be pass from the config
const apiToken = 'api/token'; // to be pass from the config

const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');

const siteId = 'site-id'; //to be query from the api
            
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


export function loadTeam(
    teamId: string,
    projectDir: string,
) {
  
    try {
        fetch('https://api.atlassian.com/graphql', {
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
        })
        .then(response => response.json())
        .then(async data => {
            const { getTeam, writeTeam} = utils(projectDir);
            let team = data.data.team.teamV2;

            let users: string[] = await processMembers(projectDir, team.members.nodes)

            let teamId = team.displayName.split(' ').join('.');

            await writeTeam({
                id: teamId,
                name: team.displayName,
                // @ts-ignore
                members: users, 
                markdown: ''
                //add link to compass team in markdown area
            }, { override: await getTeam(teamId) ? true : false});
            console.log(chalk.cyan(` - Team ${teamId} created!`));
            // console.log(chalk.yellow(` - Team ${team.displayName} already exists, skipped creation...`));
        })
        .catch(error => console.error(error));

    } catch (error) {
        console.error(error);
    }
};

