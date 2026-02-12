// Zod schemas for all environment variable validation
import { z } from 'zod';

export const JiraConfigSchema = z.object({
  baseUrl: z.string().url(),
  userEmail: z.string().email(),
  apiToken: z.string().min(1),
});

export const S3ConfigSchema = z.object({
  accessKeyId: z.string().min(1),
  secretAccessKey: z.string().min(1),
  region: z.string().min(1),
  bucketName: z.string().min(1),
});

export const ServerConfigSchema = z.object({
  jira: JiraConfigSchema,
  s3: S3ConfigSchema,
});

export type ServerConfig = z.infer<typeof ServerConfigSchema>;
