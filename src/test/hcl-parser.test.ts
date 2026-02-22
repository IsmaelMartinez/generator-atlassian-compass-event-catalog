import { describe, expect, it } from 'vitest';
import { parseTeamNames } from '../hcl-parser';

const SAMPLE_TFVARS = `
application_name = "provisioning"

groups = [
  {
    name = "laas-customer-team"
    members = ["user1", "user2"]
  },
  {
    name       = "cloud-core-team"
    saml_group = "zz_plg_aws_team_cloud_core_engineers"
  },
  {
    name = "laas-payments-team"
    members = ["user3"]
  },
]
`;

describe('parseTeamNames', () => {
  it('extracts all team names from a groups block', () => {
    expect(parseTeamNames(SAMPLE_TFVARS)).toEqual(['laas-customer-team', 'cloud-core-team', 'laas-payments-team']);
  });

  it('returns empty array when no groups block exists', () => {
    expect(parseTeamNames('application_name = "foo"\n')).toEqual([]);
  });

  it('handles extra whitespace around equals signs', () => {
    const input = 'groups = [\n  {\n    name       =       "my-team"\n  }\n]';
    expect(parseTeamNames(input)).toEqual(['my-team']);
  });

  it('ignores other name-like keys (application_name, environment_code)', () => {
    const input = 'application_name = "provisioning"\ngroups = [\n  { name = "real-team" }\n]';
    expect(parseTeamNames(input)).toEqual(['real-team']);
  });

  it('extracts names from mixed multi-line and inline entries', () => {
    const input = `groups = [\n  { name = "inline-team" },\n  {\n    name = "multiline-team"\n  },\n]`;
    expect(parseTeamNames(input)).toEqual(['inline-team', 'multiline-team']);
  });
});
