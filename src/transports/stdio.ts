// Entry point: loads config, creates server, connects StdioServerTransport
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { loadConfig } from '../config/index.js';
import { createServer } from '../server.js';
import { log } from '../shared/logger.js';

const config = loadConfig();
const server = createServer(config);
const transport = new StdioServerTransport();

await server.connect(transport);

log({
  level: 'info',
  message: 'MCP server started on stdio transport',
});
