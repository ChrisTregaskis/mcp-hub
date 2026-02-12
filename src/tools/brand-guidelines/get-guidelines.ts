// Stub: brand_get_guidelines — fetch brand guidelines for a project from S3
import { z } from 'zod';

import type { ToolContext } from '../../types.js';

export function registerGetGuidelines(context: ToolContext): void {
  context.server.registerTool(
    'brand_get_guidelines',
    {
      description:
        'Fetch brand guidelines configuration for a project from S3 (colours, typography, tone)',
      inputSchema: {
        projectId: z
          .string()
          .describe('The project identifier used as the S3 key prefix (e.g. "deck-loc")'),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: true,
      },
    },
    async (_args) => {
      return { content: [{ type: 'text' as const, text: 'Not yet implemented' }] };
    }
  );
}
