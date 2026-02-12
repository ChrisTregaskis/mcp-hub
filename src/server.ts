// createServer(config) factory — returns McpServer with all tools registered
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { ServerConfig } from './config/index.js';
import { registerBrandTools } from './tools/brand-guidelines/index.js';
import { registerJiraTools } from './tools/jira/index.js';
import type { ToolContext } from './types.js';

export function createServer(config: ServerConfig): McpServer {
  const server = new McpServer(
    {
      name: 'mcp-server-poc',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
      instructions: `
MCP Server POC provides shared AI tooling for teams.
Available integrations: Jira (issue CRUD and JQL search)
and Brand Guidelines (per-project config from S3).
Tools use shared credentials — individual users do not
need their own API keys.
      `.trim(),
    }
  );

  const context: ToolContext = { server, config };
  registerJiraTools(context);
  registerBrandTools(context);

  return server;
}
