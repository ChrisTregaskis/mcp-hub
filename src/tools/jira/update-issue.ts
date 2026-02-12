// Stub: jira_update_issue — update fields on an existing Jira issue
import { z } from 'zod';

import type { ToolContext } from '../../types.js';

export function registerUpdateIssue(context: ToolContext): void {
  context.server.registerTool(
    'jira_update_issue',
    {
      description: 'Update fields on an existing Jira issue',
      inputSchema: {
        issueKey: z.string().describe('The Jira issue key to update (e.g. "PROJ-123")'),
        fields: z
          .record(z.unknown())
          .describe(
            'A map of field names to new values (e.g. { "summary": "New title", "status": "Done" })'
          ),
      },
      annotations: {
        readOnlyHint: false,
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
