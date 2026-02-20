# MCP Server Security Review Checklist

This checklist provides detailed security patterns for reviewing MCP Relay code changes.

## Input Validation (CRITICAL)

### Zod Schemas at All Boundaries

**All tool inputs MUST be validated with Zod schemas:**

```typescript
// CORRECT: Every field has .describe() with LLM-friendly description
const inputSchema = {
  issueKey: z.string().describe('The Jira issue key (e.g. "PROJ-123")'),
  maxResults: z
    .number()
    .optional()
    .default(50)
    .describe('Maximum number of results to return (1–100)'),
};

// WRONG: Missing .describe() — LLM will guess input values
const inputSchema = {
  issueKey: z.string(),
  maxResults: z.number().optional(),
};
```

**API responses MUST also be validated:**

```typescript
// CORRECT: Validate external API response with Zod
const issue = parseResponse(JiraIssueResponseSchema, result.data, metadata);

// WRONG: Trust external API data blindly
const issue = result.data as JiraIssue;
```

**Checklist:**

- [ ] All tool input fields have Zod schemas with `.describe()`
- [ ] Input schemas are plain objects (not wrapped in `z.object()`)
- [ ] No `any` types on input parameters — use `z.unknown()` with validation if truly dynamic
- [ ] All external API responses validated with Zod schemas
- [ ] Config validated at startup with Zod (fail-fast)
- [ ] Validation errors return `isError: true` with generic messages

### URL Construction Safety

**Always encode user-supplied values in URL paths:**

```typescript
// CORRECT: encodeURIComponent on user input
const path = `/rest/api/3/issue/${encodeURIComponent(issueKey)}`;

// WRONG: Direct string interpolation — injection risk
const path = `/rest/api/3/issue/${issueKey}`;
```

**Checklist:**

- [ ] All user-supplied values in URLs use `encodeURIComponent()`
- [ ] No string concatenation for URL construction with user input
- [ ] Base URLs come from validated config, not user input

## Credential Management (CRITICAL)

### Environment Variables Only

**All secrets MUST be loaded from environment variables, validated at startup:**

```typescript
// CORRECT: Zod-validated config at startup
const JiraConfigSchema = z.object({
  baseUrl: z.string().url(),
  userEmail: z.string().email(),
  apiToken: z.string().min(1),
});

// CORRECT: Fail-fast if credentials missing
export function loadConfig(): ServerConfig {
  const result = ServerConfigSchema.safeParse({
    jira: {
      baseUrl: process.env.JIRA_BASE_URL,
      userEmail: process.env.JIRA_USER_EMAIL,
      apiToken: process.env.JIRA_API_TOKEN,
    },
  });

  if (!result.success) {
    throw new ConfigurationError('Invalid configuration', metadata, issues);
  }
  return result.data;
}

// WRONG: Hardcoded secrets
const apiToken = 'sk_live_abc123xyz789';
```

**Checklist:**

- [ ] No hardcoded passwords, API keys, or tokens
- [ ] All secrets loaded from environment variables
- [ ] `.env` file is gitignored
- [ ] `.env.example` documents required vars (no values)
- [ ] Zod validation at startup with fail-fast
- [ ] No secrets in comments or documentation

### Single Point of Credential Handling

**Auth headers MUST be built in domain client modules, not in handlers:**

```typescript
// CORRECT: Auth handling in Jira client module
export async function jiraRequest(
  config: JiraConfig,
  options: JiraRequestOptions
): Promise<JiraResult> {
  const authToken = Buffer.from(`${config.userEmail}:${config.apiToken}`).toString('base64');
  return await httpRequest({
    headers: {
      Authorization: `Basic ${authToken}`,
      Accept: 'application/json',
    },
    ...options,
  });
}

// WRONG: Auth handling in tool handler
async ({ issueKey }) => {
  const authToken = Buffer.from(`${config.jira.userEmail}:${config.jira.apiToken}`).toString(
    'base64'
  );
  const response = await fetch(url, {
    headers: { Authorization: `Basic ${authToken}` },
  });
};
```

**Checklist:**

- [ ] Auth headers built in domain client modules only
- [ ] Handlers never touch credentials directly
- [ ] One auth pattern per external service (not duplicated across tools)

## Error Handling (CRITICAL)

### OWASP-Safe Error Responses

**Never leak sensitive data in error messages:**

```typescript
// CORRECT: Generic client message, detailed server-side log
try {
  const result = await jiraRequest(config, { method: 'GET', path, metadata });
  if (!result.ok) return result.mcpResponse;
  // ...
} catch (error) {
  log({
    level: 'error',
    message: `Failed to fetch issue ${issueKey}`,
    error: error instanceof Error ? error.message : String(error),
    durationMs: Date.now() - startTime,
    ...metadata,
  });

  return {
    isError: true,
    content: [{ type: 'text', text: 'Failed to fetch Jira issue. Check server logs for details.' }],
  };
}

// WRONG: Leaks internal details to MCP client
return {
  isError: true,
  content: [{ type: 'text', text: `Error: ${error.stack}` }],
};
```

**Checklist:**

- [ ] Client-facing errors are generic (no stack traces, paths, or API keys)
- [ ] `isError: true` set on all tool execution failures
- [ ] Detailed errors logged server-side with correlation IDs
- [ ] Known HTTP errors (401/403/404) return specific, helpful MCP responses
- [ ] Unexpected errors caught at handler boundary with generic fallback
- [ ] Error class hierarchy used (`ExternalServiceError`, `ValidationError`, `ConfigurationError`)

### Correlation IDs

**Every tool invocation MUST generate a correlation ID for tracing:**

```typescript
// CORRECT: Correlation ID at handler entry
const correlationId = crypto.randomUUID();
const metadata: ErrorMetadata = {
  toolName: TOOL_NAME,
  operation: 'getIssue',
  correlationId,
};

// Log, HTTP client, and error classes all receive metadata
log({ level: 'info', message: `Fetching issue ${issueKey}`, ...metadata });
```

**Checklist:**

- [ ] `crypto.randomUUID()` called at handler entry
- [ ] Metadata object passed through entire call chain
- [ ] All log entries include `correlationId`
- [ ] Error classes carry `ErrorMetadata`

## Log Sanitisation (CRITICAL)

### Never Log Secrets

**All log output MUST be sanitised to redact sensitive values:**

```typescript
// CORRECT: Logger sanitises sensitive keys recursively
// Keys redacted: apitoken, api_token, apikey, api_key, password,
// secret, token, authorization, cookie (case-insensitive)
log({
  level: 'info',
  message: 'Request completed',
  config: { baseUrl: 'https://...', apiToken: 'sk_live_...' },
  // apiToken will be redacted to '[REDACTED]'
});

// WRONG: Logging raw config objects without sanitisation
console.error(JSON.stringify({ config, response }));
```

**Checklist:**

- [ ] Logger sanitises all objects recursively before output
- [ ] Sensitive keys redacted (apitoken, password, secret, authorization, cookie, etc.)
- [ ] No `console.log()` or `console.error()` called directly — use the logger
- [ ] URL query strings and fragments stripped from error/log messages
- [ ] API response bodies not logged in full (only relevant fields)

## HTTP Client Safety

### Timeout Handling

**All external API calls MUST have timeouts:**

```typescript
// CORRECT: AbortController with configurable timeout
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

try {
  const response = await fetch(url, { signal: controller.signal, ...options });
} finally {
  clearTimeout(timeoutId);
}

// WRONG: No timeout — hung API blocks tool indefinitely
const response = await fetch(url, options);
```

**Checklist:**

- [ ] All `fetch` calls use AbortController with timeout
- [ ] Default timeout configured (30 seconds)
- [ ] Timeout errors wrapped as `ExternalServiceError`
- [ ] Network errors wrapped as `ExternalServiceError`
- [ ] URL sanitised in error output (strip query string and fragments)

## MCP Protocol Security

### Tool Annotations Accuracy

**Annotations MUST accurately reflect tool behaviour — clients use them for safety decisions:**

```typescript
// CORRECT: Read-only tool marked as such
annotations: {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: true,
  idempotentHint: true,
}

// WRONG: Write tool marked as read-only — clients may auto-approve
annotations: {
  readOnlyHint: true,  // WRONG! This tool creates issues
  destructiveHint: false,
  openWorldHint: true,
  idempotentHint: false,
}
```

**Checklist:**

- [ ] `readOnlyHint: true` only for tools that do NOT modify state
- [ ] `destructiveHint: true` for tools that delete or irreversibly modify
- [ ] `openWorldHint: true` for all tools that call external APIs
- [ ] `idempotentHint` accurate (create = false, update = true, get = true)
- [ ] Annotations are not used as a substitute for actual authorisation logic

### stdout/stderr Separation

**Only MCP protocol messages on stdout:**

```typescript
// CORRECT: Logging to stderr via structured logger
log({ level: 'info', message: 'Server starting...' });
// Internally writes JSON to process.stderr

// WRONG: Logging to stdout — corrupts MCP protocol stream
console.log('Server starting...');
```

**Checklist:**

- [ ] No `console.log()` calls (stdout reserved for MCP protocol)
- [ ] All logging via structured logger (writes to `stderr`)
- [ ] No `process.stdout.write()` outside of MCP transport

## OWASP Top 10 Coverage (MCP Server Context)

1. **Broken Access Control**: Credential isolation — server-held, not client-provided. Rate limiting.
2. **Cryptographic Failures**: TLS for all external API calls. No secrets in code or logs.
3. **Injection**: `encodeURIComponent()` on URL paths. Zod validation on all inputs. No string concatenation.
4. **Insecure Design**: Typed error hierarchy. Result discriminator pattern. Fail-fast config.
5. **Security Misconfiguration**: Strict TypeScript. Zod at startup. No debug mode in production.
6. **Vulnerable Components**: `pnpm audit`. Pinned SDK version (Zod 3.25.x compatibility).
7. **Authentication Failures**: Basic Auth over HTTPS. Token never logged. Single auth point.
8. **Data Integrity Failures**: Zod validation on API responses. Schema-based response parsing.
9. **Logging Failures**: Structured JSON logging. Correlation IDs. Log sanitisation. Duration tracking.
10. **SSRF**: Base URLs from validated config only. `encodeURIComponent()` on user input. No user-controlled URLs.

**Checklist:**

- [ ] All 10 categories addressed in new code
- [ ] No regressions in existing coverage
- [ ] External API calls use HTTPS only
