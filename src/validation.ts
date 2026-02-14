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

export const GeneratorPropsSchema = z.object({
  services: z.array(ServiceOptionsSchema).min(1, 'At least one service is required'),
  compassUrl: z.string().url('compassUrl must be a valid URL'),
  domain: DomainOptionSchema.optional(),
  debug: z.boolean().optional(),
  overrideExisting: z.boolean().optional(),
});
