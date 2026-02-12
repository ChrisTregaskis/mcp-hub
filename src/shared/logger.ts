// Structured JSON logger — writes to stderr (stdout reserved for MCP protocol in stdio transport)

type LogLevel = 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  toolName?: string;
  operation?: string;
  correlationId?: string;
  durationMs?: number;
  error?: string;
  [key: string]: unknown;
}

export function log(entry: LogEntry): void {
  const output = {
    timestamp: new Date().toISOString(),
    ...entry,
  };

  console.error(JSON.stringify(output));
}
