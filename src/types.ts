// Configuration the users give your catalog
export type GeneratorProps = {
  path: string | string[];
  compassUrl: string;
  domain?: DomainOption;
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
