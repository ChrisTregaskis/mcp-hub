// Stub: jira_create_issue — create a new Jira issue
import { z } from 'zod';

import type { ToolContext } from '../../types.js';

export function registerCreateIssue(context: ToolContext): void {
  context.server.registerTool(
    'jira_create_issue',
    {
      description: 'Create a new Jira issue in the specified project',
      inputSchema: {
        project: z.string().describe('The Jira project key (e.g. "PROJ")'),
        summary: z.string().describe('A brief summary of the issue'),
        issueType: z.string().describe('The issue type name (e.g. "Task", "Bug", "Story")'),
        description: z
          .string()
          .optional()
          .describe('Detailed description of the issue (plain text)'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: false,
      },
    },
    async (_args) => {
      return { content: [{ type: 'text' as const, text: 'Not yet implemented' }] };
    }
  );
}
