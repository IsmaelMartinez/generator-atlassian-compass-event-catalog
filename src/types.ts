import type { Service, Badge } from '@eventcatalog/sdk';
import type { CompassConfig } from './compass';

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

export type MarkdownTemplateFn = (config: CompassConfig, dependencies: ResolvedDependency[]) => string;

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
  // Phase 5: Custom markdown template function
  markdownTemplate?: MarkdownTemplateFn;
  // Phase 5: Output format (md or mdx), default: 'mdx'
  format?: 'md' | 'mdx';
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
