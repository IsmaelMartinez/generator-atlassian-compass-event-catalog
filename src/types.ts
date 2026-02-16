import type { Service, Badge } from '@eventcatalog/sdk';

type ServiceOptions = {
  id?: string;
  path: string;
  version?: string;
};

export type ApiConfig = {
  cloudId: string;
  apiToken: string;
  email: string;
  baseUrl: string;
  typeFilter?: string[];
};

// Configuration the users give your catalog
export type GeneratorProps = {
  // YAML mode (existing)
  services?: ServiceOptions[];
  // API mode (new)
  api?: ApiConfig;
  compassUrl: string;
  domain?: DomainOption;
  debug?: boolean;
  overrideExisting?: boolean;
  typeFilter?: string[];
};

export type DomainOption = {
  id: string;
  name: string;
  version: string;
};

export type ResolvedDependency = {
  id: string;
  name: string;
};

// Re-export SDK types for convenience
export type { Service, Badge };
