import { z } from 'zod';

const ServiceOptionsSchema = z.object({
  id: z.string().optional(),
  path: z.string().min(1, 'Service path is required'),
  version: z.string().optional(),
});

const DomainOptionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  version: z.string().min(1),
});

const ApiConfigSchema = z.object({
  cloudId: z.string().min(1, 'cloudId is required'),
  apiToken: z.string().min(1, 'apiToken is required'),
  email: z.string().min(1, 'email is required'),
  baseUrl: z
    .string()
    .url('baseUrl must be a valid URL')
    .refine((url) => url.startsWith('https://'), { message: 'baseUrl must use HTTPS to protect API credentials' }),
  typeFilter: z.array(z.string().min(1)).optional(),
});

const ServiceIdStrategySchema = z.union([z.enum(['name', 'compass-id']), z.function()]);

export const GeneratorPropsSchema = z
  .object({
    services: z.array(ServiceOptionsSchema).min(1, 'At least one service is required').optional(),
    api: ApiConfigSchema.optional(),
    compassUrl: z.string().url('compassUrl must be a valid URL'),
    domain: DomainOptionSchema.optional(),
    debug: z.boolean().optional(),
    overrideExisting: z.boolean().optional(),
    typeFilter: z.array(z.string().min(1)).optional(),
    markdownTemplate: z.function().optional(),
    format: z.enum(['md', 'mdx']).optional(),
    serviceIdStrategy: ServiceIdStrategySchema.optional(),
    dryRun: z.boolean().optional(),
  })
  .refine((data) => data.services || data.api, {
    message: 'Either "services" (YAML mode) or "api" (API mode) must be provided',
  })
  .refine((data) => !(data.services && data.api), {
    message: 'Cannot use both "services" and "api" — choose one mode',
  });
