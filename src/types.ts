// Shared types — ToolContext interface passed to all tool registration functions
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { ServerConfig } from './config/index.js';

export interface ToolContext {
  server: McpServer;
  config: ServerConfig;
}
