// Stub: jira_get_issue — fetch a Jira issue by key
import { z } from 'zod';

import type { ToolContext } from '../../types.js';

export function registerGetIssue(context: ToolContext): void {
  context.server.registerTool(
    'jira_get_issue',
    {
      description: 'Fetch a Jira issue by its key, returning summary, status, and assignee',
      inputSchema: {
        issueKey: z.string().describe('The Jira issue key (e.g. "PROJ-123")'),
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
