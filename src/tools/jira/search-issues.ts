// Stub: jira_search_issues — search Jira issues via JQL
import { z } from 'zod';

import type { ToolContext } from '../../types.js';

export function registerSearchIssues(context: ToolContext): void {
  context.server.registerTool(
    'jira_search_issues',
    {
      description: 'Search for Jira issues using a JQL query string',
      inputSchema: {
        jql: z.string().describe('A JQL query string (e.g. "project = PROJ AND status = Open")'),
        maxResults: z
          .number()
          .optional()
          .default(50)
          .describe('Maximum number of results to return (1–100)'),
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
