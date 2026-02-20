---
name: mcp-best-practices
description: MCP protocol best practices reference for building tools, debugging issues, and validating patterns against the official specification. Use when implementing new tools, adding features, or reviewing MCP server code.
allowed-tools: Read, Grep, Glob, WebFetch, WebSearch
---

# MCP Protocol Best Practices

You are a senior MCP server engineer. Use this reference when building new tools, debugging protocol issues, or validating that implementation patterns align with the official specification.

## Reference Sources

When asked to check the latest specification or verify a pattern, consult these in order:

1. **Official MCP Specification**: https://modelcontextprotocol.io/specification
2. **MCP TypeScript SDK**: https://github.com/modelcontextprotocol/typescript-sdk
3. **MCP Security Best Practices**: https://modelcontextprotocol.io/specification/security
4. **Project Architecture**: Read `docs/architecture.md` for project-specific decisions
5. **Project Standards**: Read `CLAUDE.md` for code style and conventions

## Protocol Version

This project targets **MCP protocol version 2025-11-25** — the latest stable specification. The old HTTP+SSE transport (protocol version 2024-11-05) is deprecated and excluded.

---

## 1. Tool Handler Best Practices

### Registration Pattern

Every tool handler follows this structure:

```typescript
export function registerMyTool(context: ToolContext): void {
  context.server.registerTool(
    'domain_verb_noun', // Tool name
    {
      description: 'Action-oriented description stating what the tool does and returns',
      inputSchema: {
        fieldName: z.string().describe('LLM-friendly description (e.g. "PROJ-123")'),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: true,
      },
    },
    async (args) => {
      // validate → execute → format
    }
  );
}
```

### Input Schema Rules

- **Every Zod field MUST have `.describe()`** with an LLM-friendly description
- Include example values for non-obvious fields (JQL syntax, key formats, date formats)
- Use `.optional()` and `.default()` for sensible defaults
- Input schemas are **plain objects of Zod fields** (not wrapped in `z.object()`) — the SDK handles wrapping
- Use `z.enum()` for known-value fields rather than open strings
- Regex-constrain string inputs where format is known
- No `any` types — use `z.unknown()` if truly dynamic, with validation after

### Handler Flow

Every handler follows: **validate → execute → format → return**

```
1. Generate correlation ID (crypto.randomUUID())
2. Build metadata object (toolName, operation, correlationId)
3. Log start (with metadata)
4. Execute external API call (with timeout + metadata)
5. Validate API response (Zod parse)
6. Format as MCP content
7. Log success (with duration)
8. Return { content: [{ type: 'text', text }] }

On error:
- Log detailed error server-side (with metadata + duration)
- Return { isError: true, content: [{ type: 'text', text: genericMessage }] }
```

### Tool Annotations

**Every tool MUST include annotations.** These are behavioural hints clients use for safety decisions:

| Tool Type                | `readOnlyHint` | `destructiveHint` | `openWorldHint` | `idempotentHint` |
| ------------------------ | -------------- | ----------------- | --------------- | ---------------- |
| Read (get, search, list) | `true`         | `false`           | `true`          | `true`           |
| Create                   | `false`        | `false`           | `true`          | `false`          |
| Update                   | `false`        | `false`           | `true`          | `true`           |
| Delete (future)          | `false`        | `true`            | `true`          | `true`           |

All tools in this server set `openWorldHint: true` because they access external services.

**Note**: Annotations are _hints_, not enforcement. The server must still enforce its own authorisation logic. The spec states: "Clients MUST consider tool annotations to be untrusted unless they come from trusted servers."

### Output Schema & Structured Content (2025-11-25 spec)

New capability — tools may define an `outputSchema` for machine-parseable structured output:

```typescript
outputSchema: z.object({ bmi: z.number() });
```

If `outputSchema` is provided:

- Server MUST return `structuredContent` conforming to the schema
- ALSO return serialised JSON in a `TextContent` block in `content` for backwards compatibility
- Clients SHOULD validate results against the schema

**When to use**: When API consumers or CI/CD agents need typed responses (Phase 2+ consideration).

---

## 2. Security Best Practices

### Specification Requirements (MUST)

The spec requires servers to:

1. **Validate all tool inputs** (Zod schemas at every boundary)
2. **Implement proper access controls**
3. **Rate limit tool invocations**
4. **Sanitise tool outputs**

### Credential Management

- **Environment variables only** for API keys and secrets
- **Fail-fast** — server refuses to start if any credential is missing or malformed (Zod validation at startup)
- **Never log** API keys, tokens, or secrets — sanitise all log output
- **Never expose** credentials in error messages or MCP responses
- **Single point of credential handling** — auth headers built in domain client modules, never in handlers
- MCP servers are classified as OAuth Resource Servers (June 2025 spec update)

### Input Sanitisation

- `encodeURIComponent()` all user-supplied values in URL paths
- Parameterised queries only — no string concatenation for URLs, SQL, or API calls
- Treat all stored content as untrusted when returned to the LLM
- Strip or escape control characters from API responses

### Error Handling (OWASP)

- **Generic messages to clients** — never expose stack traces, internal paths, or API keys
- **Detailed logging server-side** — full error details with correlation IDs
- **`isError: true`** for all tool execution failures — enables LLM self-correction
- Known HTTP errors (401/403/404) return specific MCP responses
- Unexpected errors throw and are caught at the handler boundary

### Key Attack Vectors to Guard Against

| Vector                            | Mitigation                                                                 |
| --------------------------------- | -------------------------------------------------------------------------- |
| Prompt injection via tool outputs | Sanitise API response content before returning                             |
| SSRF                              | Validate all URLs, enforce HTTPS, block private IP ranges                  |
| Credential leakage                | Sanitise logs, generic error messages, never log tokens                    |
| Tool poisoning                    | Validate response schemas, treat all external data as untrusted            |
| Token passthrough                 | Never accept tokens from clients to forward downstream (forbidden in spec) |

---

## 3. Transport Best Practices

### stdio (Phase 1)

- Server reads from `stdin`, writes to `stdout` — only valid MCP messages on `stdout`
- Logging goes to `stderr` (JSON structured) — `stdout` is reserved for protocol
- Clients SHOULD support stdio whenever possible for local tools
- Security advantage: access limited to the MCP client process only

### Streamable HTTP (Phase 2+)

- **MUST validate Origin header** on all connections (prevent DNS rebinding)
- **SHOULD bind to `127.0.0.1` only** for local servers (never `0.0.0.0`)
- Session IDs MUST be globally unique and cryptographically secure (UUIDs)
- Sessions MUST NOT be used for authentication
- Support both stateless and stateful modes

---

## 4. Tool Naming Conventions

### Name Format

- 1–128 characters, case-sensitive
- Allowed: `A-Z`, `a-z`, `0-9`, `_`, `-`, `.`
- Must be unique within a server

### Naming Pattern

This project uses `domain_verb_noun`:

- `jira_get_issue`, `jira_create_issue`, `jira_search_issues`
- `brand_get_guidelines`

### Description Conventions

- **Concise and action-oriented**: State what the tool does and what it returns
- **Include constraints**: "Issue key must be in the format PROJ-123"
- **No LLM directives**: Descriptions should be factual, not instructional ("Always call this first" is wrong)
- **Use `title`** for human-readable display names in UIs

---

## 5. Rate Limiting

### Specification Requirement

The spec states servers **MUST** rate limit tool invocations. This is mandatory.

### Patterns

- **Per-tool limits**: Different tools have different cost profiles
- **Sliding window or token bucket**: Preferred over fixed window (which allows burst at boundaries)
- **Centralised tracking**: Cross-tool aggregate limits, not per-handler implementation
- **Graceful degradation**: Return `isError: true` with reset timing so the LLM can decide to wait or try alternatives

```
Rate limit exceeded for jira_get_issue. Limit: 60 requests per minute. Try again in 23 seconds.
```

---

## 6. Response Formatting

### Content Types

| Type            | Use Case                                                   |
| --------------- | ---------------------------------------------------------- |
| `text`          | Default. Plain text or formatted text for LLM consumption  |
| `image`         | Base64-encoded image data with MIME type                   |
| `resource_link` | URI reference to a resource the client can fetch on demand |

### Content Annotations

- **`audience`**: `["user"]`, `["assistant"]`, or `["user", "assistant"]`
- **`priority`**: `0.0` to `1.0` — higher priority content presented first

### Formatting for LLMs

- Plain text with clear structure works better than markdown for most LLM consumption
- Keep responses lean — only fields the LLM or user needs
- Use `resource_link` for large content rather than embedding inline
- Null-safe defaults: "None", "Unassigned", "No description" rather than empty strings

---

## 7. Logging & Observability

### Server-Side Logging

- Structured JSON to `stderr` (stdout reserved for MCP protocol in stdio transport)
- Every log entry includes: `toolName`, `operation`, `correlationId`
- Duration tracking: `startTime` at entry, `durationMs` at exit
- Recursive sanitisation of all log objects (redact: apitoken, api_key, password, secret, authorization, cookie)
- OWASP: never log API keys, tokens, or sensitive request/response bodies

### Protocol Logging (2025-11-25 spec)

The SDK supports client-visible logging via `ctx.mcpReq.log()`:

```typescript
await ctx.mcpReq.log('info', `Fetching Jira issue ${issueKey}`);
```

Server must declare the `logging` capability. Log levels: `debug`, `info`, `warning`, `error`. Client can set minimum level filter.

---

## 8. Common Anti-Patterns

1. **Missing `.describe()` on Zod fields** — LLMs guess input values without descriptions
2. **Not setting `isError: true`** — LLM cannot distinguish errors from normal content
3. **Returning full API responses** — Over-fetching creates noisy context for LLMs
4. **Token passthrough** — Accepting and forwarding client tokens is forbidden in spec
5. **Secrets in error messages** — Stack traces, API keys, internal paths in tool results
6. **Binding HTTP to `0.0.0.0`** — DNS rebinding attack surface for local servers
7. **Missing Origin validation** — Critical for Streamable HTTP transport
8. **Missing timeouts** — Hung downstream API blocks the tool indefinitely
9. **Silent tool changes** — Must emit `notifications/tools/list_changed` if tools change
10. **Using sessions for authentication** — Spec explicitly forbids this

---

## Usage

When building a new tool or feature, reference this skill to ensure alignment with the MCP specification. For code reviews, the `/review` skill references these best practices automatically.

When in doubt about a specific protocol detail, use `WebFetch` to check the official spec at https://modelcontextprotocol.io/specification.
