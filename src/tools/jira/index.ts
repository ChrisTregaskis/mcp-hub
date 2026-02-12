// Registers all Jira tools with the MCP server
import type { ToolContext } from '../../types.js';

import { registerCreateIssue } from './create-issue.js';
import { registerGetIssue } from './get-issue.js';
import { registerSearchIssues } from './search-issues.js';
import { registerUpdateIssue } from './update-issue.js';

export function registerJiraTools(context: ToolContext): void {
  registerGetIssue(context);
  registerCreateIssue(context);
  registerSearchIssues(context);
  registerUpdateIssue(context);
}
