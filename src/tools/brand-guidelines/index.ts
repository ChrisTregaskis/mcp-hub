// Registers all brand guidelines tools with the MCP server
import type { ToolContext } from '../../types.js';

import { registerGetGuidelines } from './get-guidelines.js';

export function registerBrandTools(context: ToolContext): void {
  registerGetGuidelines(context);
}
