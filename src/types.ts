type ServiceOptions = {
  id?: string;
  path: string;
  version?: string;
};

// Configuration the users give your catalog
export type GeneratorProps = {
  services: ServiceOptions[];
  // path: string | string[];
  compassUrl: string;
  domain?: DomainOption;
  debug?: boolean;
};

export type DomainOption = {
  id: string;
  name: string;
  version: string;
};

export type Service = {
  id: string;
  name: string;
  version: string;
  summary: string;
  markdown: string;
};

export type TeamMember = {
  member: {
    name: string
    picture: string
    email: string
  }
}

export type GetTeamMembersResponse = {
  team: {
    teamV2: {
      id: number,
      description: string,
      displayName: string,
      members: {
        nodes: TeamMember[]
      }
    }
  }
}

export type User = {
  id: string;
  name: string;
  avatarUrl: string;
  email?: string;
  markdown: string;
}