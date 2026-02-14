import type { Service, Badge } from '@eventcatalog/sdk';

type ServiceOptions = {
  id?: string;
  path: string;
  version?: string;
};

// Configuration the users give your catalog
export type GeneratorProps = {
  services: ServiceOptions[];
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

// Re-export SDK types for convenience
export type { Service, Badge };
