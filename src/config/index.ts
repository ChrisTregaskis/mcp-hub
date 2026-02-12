// Loads environment variables, validates with Zod, exports typed config — fail-fast on invalid config
import { ServerConfigSchema } from './schemas.js';

import type { ServerConfig } from './schemas.js';

export type { ServerConfig };

export function loadConfig(): ServerConfig {
  const result = ServerConfigSchema.safeParse({
    jira: {
      baseUrl: process.env['JIRA_BASE_URL'],
      userEmail: process.env['JIRA_USER_EMAIL'],
      apiToken: process.env['JIRA_API_TOKEN'],
    },
    s3: {
      accessKeyId: process.env['AWS_ACCESS_KEY_ID'],
      secretAccessKey: process.env['AWS_SECRET_ACCESS_KEY'],
      region: process.env['AWS_REGION'],
      bucketName: process.env['S3_BUCKET_NAME'],
    },
  });

  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    throw new Error(`Configuration validation failed:\n${formatted}`);
  }

  return result.data;
}
