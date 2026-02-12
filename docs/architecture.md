# Architecture: MCP Server POC

**Status:** Draft v0.1
**Last Updated:** 2026-02-12
**Protocol Version:** 2025-11-25

---

## Contents

1. [Overview](#1-overview)
2. [System Context](#2-system-context)
3. [Key Questions](#3-key-questions)
4. [Architecture Approach](#4-architecture-approach)
5. [Data Flow](#5-data-flow)
6. [External Service Integration](#6-external-service-integration)
7. [Tech Stack](#7-tech-stack)
8. [Project Structure](#8-project-structure)
9. [Open Items](#9-open-items)

---

## 1. Overview

Most teams today either lack access to AI-powered workflows within their organisation, or rely on external chat tools that have no context about internal systems, credentials, or project-specific configuration. Even teams that do use AI tooling face fragmented setup — each member must individually configure API credentials, discover available integrations, and maintain their own connections. Non-technical team members are often excluded entirely.

This MCP server acts as a centralised AI tooling layer: one server, one set of credentials, and a curated tool catalogue that any MCP-compatible client can access with zero individual setup. A technical lead connects the server once; the entire team — developers, delivery managers, and non-technical users alike — gets immediate access to shared tools through natural language.

The server implements the [Model Context Protocol](https://modelcontextprotocol.io) (MCP), an open standard for connecting AI applications to external tools and data sources. While the POC is primarily validated with Claude-based clients (Claude Code, Cowork, Claude Desktop), the architecture is client-agnostic by design — VS Code, Cursor, and any MCP-compatible client can connect.

### User Journey

```
Team Member                    MCP Server                     External Services
    │                              │                                │
    ├─ Connects MCP client ───────►│                                │
    │  (Code/Desktop/VS Code/      │                                │
    │   Cowork/API agent)          │                                │
    │                              │                                │
    ├─ Invokes tool ──────────────►│                                │
    │  (e.g. "search Jira")        │                                │
    │                              ├─ Validates input (Zod) ───────►│
    │                              ├─ Authenticates (server creds) ─►│ Jira / S3
    │                              ├─ Executes API call ────────────►│
    │                              │◄─ Receives response ───────────┤
    │                              ├─ Validates response (Zod) ────►│
    │                              ├─ Transforms to MCP content ───►│
    │◄─ Formatted result ──────────┤                                │
    │                              │                                │
```

### POC Scope (Phase 1)

| Category         | Items                                                                                                                                                                                                                                                            |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **In scope**     | Jira tool (get, create, search, update), Brand Guidelines tool (S3 config fetch), shared auth layer (env vars), stdio transport, Zod validation at all boundaries, error handling (typed error hierarchy), rate limiting architectural hooks, structured logging |
| **Out of scope** | Azure DevOps, SonarQube, CI/CD tools, Nanobanana/Gemini, per-user auth (OAuth), Streamable HTTP transport (Phase 1→2 gate), production hosting, plugin system, automated testing (deferred)                                                                      |

### Target Users

| User Type               | Client               | Use Case                                                 |
| ----------------------- | -------------------- | -------------------------------------------------------- |
| Developers              | Claude Code, VS Code | Jira queries, brand guideline lookups during development |
| Delivery teams          | Claude Code, Cowork  | Jira issue management, project config access             |
| Non-technical users     | Cowork               | Natural language access to Jira and brand guidelines     |
| CI/CD agents (Phase 2+) | API consumers        | Headless tool invocation                                 |

---

## 2. System Context

### System Context Diagram

```
  MCP Clients                      MCP Server                    External Services
 ┌─────────────────┐          ┌──────────────────────┐       ┌─────────────────────┐
 │ Claude Code     │──stdio──►│                      │       │                     │
 │ Claude Desktop  │──stdio──►│   mcp-server-poc     │──────►│  Jira REST API v3   │
 │ VS Code         │──stdio──►│                      │       │  (Cloud)            │
 │ Cowork          │──HTTP───►│  ┌────────────────┐  │       └─────────────────────┘
 │ Other MCP       │──HTTP───►│  │ Tool Registry  │  │
 │   clients       │          │  │  ├─ Jira       │  │       ┌─────────────────────┐
 └─────────────────┘          │  │  ├─ Brand      │  │──────►│  AWS S3             │
                              │  │  └─ (future)   │  │       │  (Brand configs)    │
                              │  └────────────────┘  │       └─────────────────────┘
                              │                      │
                              │  ┌────────────────┐  │       ┌─────────────────────┐
                              │  │ Shared Layer   │  │       │  Future:            │
                              │  │  ├─ Auth       │  │ ─ ─ ─►│  Azure DevOps       │
                              │  │  ├─ Validation │  │       │  SonarQube          │
                              │  │  ├─ Rate limit │  │       │  Confluence         │
                              │  │  └─ Logging    │  │       │  Nanobanana/Gemini  │
                              │  └────────────────┘  │       └─────────────────────┘
                              └──────────────────────┘
```

### Runtime Characteristics

| Characteristic | Phase 1                             | Future (Phase 2+)                  |
| -------------- | ----------------------------------- | ---------------------------------- |
| Process model  | Local process, launched per-session | Long-running HTTP service          |
| State          | Stateless (no persistent storage)   | Session state via `Mcp-Session-Id` |
| Concurrency    | Single client per process           | Multiple concurrent clients        |
| Memory         | In-process only, no caching layer   | Potential for shared cache         |

### Transport Layer

**Decision:** stdio for Phase 1, Streamable HTTP as a hard dependency before Phase 2.

| Phase              | Transport                                         | Auth                                | Sharing               |
| ------------------ | ------------------------------------------------- | ----------------------------------- | --------------------- |
| **Phase 1**        | stdio (`StdioServerTransport`)                    | Environment variables               | Per-developer         |
| **Phase 1→2 gate** | Streamable HTTP (`StreamableHTTPServerTransport`) | API key / VPN (spike to determine)  | Internal team         |
| **Phase 2+**       | Streamable HTTP                                   | OAuth 2.1 (SDK built-in middleware) | Cross-team / org-wide |

**Rationale:**

- Phase 1 hypotheses are about tool patterns (shared creds, per-project config), not transport/deployment.
- stdio is the path of least resistance for Claude Code, VS Code, and Claude Desktop.
- The SDK is transport-agnostic — tool code is identical across transports; only the entry point differs.
- Streamable HTTP is a hard gate before Phase 2 because team-sharing is a core hypothesis, not optional.
- The old HTTP+SSE transport (protocol version 2024-11-05) is deprecated and excluded from this architecture.
- This server targets **protocol version 2025-11-25** — the latest stable spec at time of writing.

**Evolution trigger:** Streamable HTTP spike (S3) must be completed and validated before Phase 2 begins.

---

## 3. Key Questions

### Resolved

| #   | Question                    | Decision                                             | Rationale                                                              |
| --- | --------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------- |
| Q1  | Transport layer?            | stdio (Phase 1) + Streamable HTTP (pre-Phase 2 gate) | Fastest POC path; HTTP required before team-sharing                    |
| Q2  | Old HTTP+SSE support?       | Excluded                                             | Deprecated as of protocol 2025-06-18; confirmed excluded in 2025-11-25 |
| Q3  | Framework?                  | `@modelcontextprotocol/sdk`                          | Official SDK, first-class Zod + TypeScript support                     |
| Q4  | Language?                   | TypeScript strict mode                               | Type safety, Zod compatibility                                         |
| Q5  | Validation?                 | Zod at all boundaries                                | Consistent with SDK patterns, type-safe                                |
| Q6  | Testing?                    | Deferred for POC                                     | Add Vitest before Streamable HTTP gate                                 |
| Q7  | Phase 1 tools?              | Jira + Brand Guidelines                              | Proves shared creds + per-project config patterns                      |
| Q8  | Rate limiting scope?        | Architectural hooks only (Phase 1)                   | Pipeline slot + config shape defined; enforcement deferred             |
| Q9  | Package manager?            | pnpm                                                 | Strict dependency hoisting, fast installs, prior experience            |
| Q10 | Tool handler pattern?       | Functional + registration functions                  | Aligns with SDK design, zero abstraction overhead                      |
| Q11 | Monorepo vs single package? | Single package                                       | Simplest for Phase 1; evolution trigger: production build-out          |
| Q12 | Tool granularity?           | One tool per operation                               | Better LLM tool selection with focused descriptions and narrow schemas |
| Q13 | Auth mechanism (Phase 1)?   | Env vars only                                        | stdio + single developer; OAuth 2.1 at Streamable HTTP gate            |

### Deferred

| #   | Question                                     | Why It Matters                                              | Status                                                  |
| --- | -------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------- |
| Q14 | Jira API version (v2 vs v3)?                 | Affects endpoint URLs, response shapes, available features  | Deferred — spike S1                                     |
| Q15 | Jira auth method (API token vs OAuth 2.0)?   | API token simpler for POC; OAuth needed for per-user access | Deferred — API token for Phase 1                        |
| Q16 | S3 access pattern (IAM role vs access keys)? | Affects deployment model and credential management          | Deferred — access keys for POC, IAM role for production |
| Q17 | Brand config format (JSON vs YAML)?          | Affects parsing, Zod schema design, S3 object structure     | Deferred — JSON (simpler, native, no extra parser)      |
| Q18 | S3 bucket structure for per-project configs? | Affects key naming, access control granularity              | Deferred — spike S2                                     |
| Q19 | Hosting model for Streamable HTTP?           | Docker, serverless, cloud VM                                | Deferred — spike S3                                     |

---

## 4. Architecture Approach

### MCP Server Pipeline

```
MCP Client Request
        │
        ▼
┌─────────────────┐
│  Transport Layer │  (stdio / Streamable HTTP)
│  Deserialise     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  MCP Protocol    │  (JSON-RPC routing, tools/list, tools/call)
│  SDK handles     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Input Validation│  (Zod schema — automatic via SDK)
│                  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  [Rate Limit]    │  (middleware slot — hooks only in Phase 1)
│                  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Tool Handler    │  (domain logic: API call, S3 fetch, etc.)
│                  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Response Format │  (structure MCP content response)
│  Output Validate │  (Zod on API responses — manual, in handler)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Error Handling  │  (typed results, MCP error codes, logging)
│                  │
└────────┬────────┘
         │
         ▼
  MCP Client Response
```

**Key points:**

- Input validation is automatic — the SDK parses Zod schemas before the handler is called.
- Output validation is manual — external API responses (Jira, S3) are validated with Zod inside the handler.
- Rate limiting is a middleware slot — Phase 1 defines the config shape but does not enforce.
- Error handling wraps everything — handlers return typed results; unhandled errors are caught at the transport layer.

### Tool Context Object

Tool handlers need access to both the MCP server (for registration) and shared infrastructure (validated config, logger, HTTP client). A lightweight context object provides this without a class wrapper:

```typescript
// src/types.ts
export interface ToolContext {
  server: McpServer;
  config: ServerConfig;
}
```

**Rationale:** The server has no local state (no DB, no sessions) — tools are stateless API proxies. A context interface is simpler than a class and avoids unnecessary lifecycle management. If shared infrastructure grows (logger, HTTP client, rate limiter), the interface extends naturally without refactoring registration functions.

### Tool Handler Pattern

Functional with registration functions. Each tool domain is a directory containing one file per operation:

```
src/tools/jira/
  ├── index.ts              # registerJiraTools(context) — wires all operations
  ├── get-issue.ts          # jira_get_issue handler + input schema
  ├── create-issue.ts       # jira_create_issue handler + input schema
  ├── search-issues.ts      # jira_search_issues handler + input schema
  ├── update-issue.ts       # jira_update_issue handler + input schema
  └── schemas.ts            # Shared Jira Zod schemas (response types)
```

Each handler file co-locates:

1. Input schema (Zod) — what the tool accepts (every field must have `.describe()` — see [Input Schema Conventions](#input-schema-conventions))
2. Handler function — validate → execute → format
3. Tool metadata (name, description, annotations) — co-located, not in a separate config file

The `index.ts` registration function composes them:

```typescript
// src/tools/jira/index.ts
export function registerJiraTools(context: ToolContext): void {
  registerGetIssue(context);
  registerCreateIssue(context);
  registerSearchIssues(context);
  registerUpdateIssue(context);
}
```

**Rationale:** Aligns with the SDK's functional `registerTool()` API. Zero abstraction overhead. Adding a new operation = new file + one line in `index.ts`.

### Tool Annotations

Every tool must include an `annotations` object in its `registerTool()` config. Annotations communicate behavioural hints to MCP clients, enabling them to make safety decisions (e.g. auto-approve read-only tools, prompt before destructive operations).

```typescript
// src/tools/jira/get-issue.ts
export function registerGetIssue(context: ToolContext): void {
  context.server.registerTool(
    'jira_get_issue',
    {
      description: 'Fetch a Jira issue by its key (e.g. PROJ-123)',
      inputSchema: {
        issueKey: z.string().describe('The Jira issue key (e.g. "PROJ-123")'),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: true,
      },
    },
    async ({ issueKey }) => {
      // handler implementation
    }
  );
}
```

**Standard annotation patterns for this server:**

| Tool Type                | `readOnlyHint` | `destructiveHint` | `openWorldHint` | `idempotentHint` |
| ------------------------ | -------------- | ----------------- | --------------- | ---------------- |
| Read (get, search, list) | `true`         | `false`           | `true`          | `true`           |
| Create                   | `false`        | `false`           | `true`          | `false`          |
| Update                   | `false`        | `false`           | `true`          | `true`           |
| Delete (future)          | `false`        | `true`            | `true`          | `true`           |

**Note:** All tools in this server set `openWorldHint: true` because they access external services (Jira, S3). This differs from local-only servers where `openWorldHint: false` is appropriate.

### Input Schema Conventions

**Mandatory: `.describe()` on every Zod input field.** Descriptions are consumed by LLMs to understand what values to provide. Without them, LLMs guess — often incorrectly.

```typescript
// Correct — every field has .describe()
const inputSchema = {
  issueKey: z.string().describe('The Jira issue key (e.g. "PROJ-123")'),
  jql: z.string().describe('A JQL query string (e.g. "project = PROJ AND status = Open")'),
  maxResults: z
    .number()
    .optional()
    .default(50)
    .describe('Maximum number of results to return (1–100)'),
};

// Wrong — missing descriptions
const inputSchema = {
  issueKey: z.string(),
  jql: z.string(),
  maxResults: z.number().optional(),
};
```

**Guidelines:**

- Include example values for non-obvious fields (JQL syntax, key formats)
- Use `.optional()` and `.default()` for sensible defaults
- Input schemas are plain objects of Zod fields (not wrapped in `z.object()`) — the SDK handles wrapping internally

### Server Entry Point Pattern

The `createServer()` factory is transport-agnostic — the clean seam between tool registration and transport:

```typescript
// src/server.ts
export function createServer(config: ServerConfig): McpServer {
  const server = new McpServer(
    {
      name: 'mcp-server-poc',
      version: '1.0.0',
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
```

Each transport entry point wires the server to a transport:

```
src/transports/
  ├── stdio.ts    # createServer() + StdioServerTransport (Phase 1)
  └── http.ts     # createServer() + StreamableHTTPServerTransport (Phase 1→2 gate)
```

### Implemented Tools (Phase 1)

| Tool Name              | Purpose                              | External Service | Type  | Status  |
| ---------------------- | ------------------------------------ | ---------------- | ----- | ------- |
| `jira_get_issue`       | Fetch a Jira issue by key            | Jira REST API    | Read  | Planned |
| `jira_create_issue`    | Create a new Jira issue              | Jira REST API    | Write | Planned |
| `jira_search_issues`   | Search issues via JQL                | Jira REST API    | Read  | Planned |
| `jira_update_issue`    | Update an existing issue             | Jira REST API    | Write | Planned |
| `brand_get_guidelines` | Fetch brand guidelines for a project | AWS S3           | Read  | Planned |

### Error Handling

**Error class hierarchy:**

```
ToolError (base)
├── ExternalServiceError    — Jira API returned 500, S3 timeout, etc.
├── ValidationError         — Zod parse failure on API response (not input — SDK handles that)
└── ConfigurationError      — Missing env var, invalid config at startup
```

Each error carries structured metadata (tool name, operation, correlation ID) for logging.

| Layer                   | Strategy                                                                                  |
| ----------------------- | ----------------------------------------------------------------------------------------- |
| Input validation errors | Handled by SDK automatically (Zod parse failure → MCP error response)                     |
| External API errors     | Caught in handler, wrapped in `ExternalServiceError`, returned as `isError: true` content |
| Unexpected errors       | Caught at transport layer, generic message to client, detailed log server-side            |
| MCP protocol errors     | Handled by SDK (unknown tool, malformed request, etc.)                                    |

Client-facing error messages are generic (OWASP). Structured logging captures detail server-side with correlation IDs.

**Logging:**

- Thin logging utility writing structured JSON to `console.error` (stdout is reserved for MCP protocol messages in stdio transport)
- Captures: tool name, operation, correlation ID, duration, error detail
- OWASP-safe: never logs API keys, tokens, or sensitive input fields
- Evolution trigger: swap for pino if structured log output needs more capability

### Evolution Triggers

| Trigger                                   | Action                                                              |
| ----------------------------------------- | ------------------------------------------------------------------- |
| Tool count exceeds 10                     | Consider auto-discovery registry or plugin system                   |
| Handler files exceed ~150 lines           | Extract shared utilities (API client wrappers, response formatters) |
| Multiple tools share complex auth         | Extract auth into shared middleware layer                           |
| Streamable HTTP is added                  | Introduce session management, per-session server factory            |
| Tool grouping proves better than granular | Refactor to grouped tools with action parameter                     |

---

## 5. Data Flow

### Shared Patterns

Every tool handler follows the same flow:

```
Input (Zod-validated by SDK)
  │
  ▼
Construct API request (build URL, headers, body)
  │
  ▼
Execute external call (with timeout + retry)
  │
  ▼
Validate API response (Zod parse — catch malformed upstream data)
  │
  ▼
Map to MCP content response ({ content: [{ type: "text", text: "..." }] })
  │
  ▼
Return (or throw ToolError on failure)
```

**Shared infrastructure:**

| Component           | Responsibility                                            |
| ------------------- | --------------------------------------------------------- |
| HTTP client wrapper | Thin native `fetch` wrapper with timeouts, error wrapping |
| Response formatter  | Consistent MCP content structure across tools             |
| Error classes       | `ToolError` hierarchy for typed, loggable errors          |
| Logger              | Structured JSON logging with correlation IDs, OWASP-safe  |
| Config loader       | Zod-validated env var loading at startup                  |

### Jira Tool Data Flow

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐     ┌──────────────┐
│ MCP Client   │────►│ jira_get_issue   │────►│ Jira REST API   │────►│ MCP Response │
│              │     │                  │     │ (Cloud v3)      │     │              │
│ Input:       │     │ 1. Build URL     │     │                 │     │ Output:      │
│ { issueKey:  │     │ 2. Add auth      │     │ GET /rest/api/3/│     │ { content:   │
│   "PROJ-123" │     │    header (env)  │     │   issue/PROJ-123│     │   [{ type:   │
│ }            │     │ 3. Fetch         │     │                 │     │     "text",  │
│              │     │ 4. Zod validate  │     │ Returns: JSON   │     │     text:    │
│              │     │    response      │     │ issue object    │     │     "..."    │
│              │     │ 5. Format result │     │                 │     │   }]         │
└─────────────┘     └──────────────────┘     └─────────────────┘     └──────────────┘
```

**Jira schemas:**

| Schema                 | Purpose                        | Key Fields                                     |
| ---------------------- | ------------------------------ | ---------------------------------------------- |
| `JiraGetIssueInput`    | Input for `jira_get_issue`     | `issueKey: z.string()`                         |
| `JiraCreateIssueInput` | Input for `jira_create_issue`  | `project, summary, issueType, description?`    |
| `JiraSearchInput`      | Input for `jira_search_issues` | `jql: z.string(), maxResults?: z.number()`     |
| `JiraUpdateIssueInput` | Input for `jira_update_issue`  | `issueKey, fields: z.record(...)`              |
| `JiraIssueResponse`    | Validates Jira API response    | `key, summary, status, assignee, ...` (subset) |

The server acts as a **transformer layer** — Jira returns a 200+ field object; we Zod-validate and surface only the fields that matter to the MCP client.

### Brand Guidelines Tool Data Flow

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐     ┌──────────────┐
│ MCP Client   │────►│ brand_get_       │────►│ AWS S3          │────►│ MCP Response │
│              │     │  guidelines      │     │                 │     │              │
│ Input:       │     │                  │     │                 │     │ Output:      │
│ { projectId: │     │ 1. Construct S3  │     │ GET object:     │     │ { content:   │
│   "deck-loc" │     │    key from      │     │ {bucket}/       │     │   [{ type:   │
│ }            │     │    projectId     │     │  deck-loc/      │     │     "text",  │
│              │     │ 2. Fetch from S3 │     │  guidelines.json│     │     text:    │
│              │     │ 3. Parse JSON    │     │                 │     │     "..."    │
│              │     │ 4. Zod validate  │     │ Returns: JSON   │     │   }]         │
│              │     │ 5. Format result │     │ brand config    │     │ }            │
└─────────────┘     └──────────────────┘     └─────────────────┘     └──────────────┘
```

**Brand Guidelines schemas:**

| Schema                    | Purpose                          | Key Fields                                                            |
| ------------------------- | -------------------------------- | --------------------------------------------------------------------- |
| `BrandGetGuidelinesInput` | Input for `brand_get_guidelines` | `projectId: z.string()`                                               |
| `BrandGuidelinesConfig`   | Validates S3 JSON payload        | TBD during spike S4 — likely `colours, typography, tone, assets, ...` |

**S3 key pattern:** `{bucket}/{projectId}/guidelines.json`

If a project does not have guidelines, the tool returns a clear "not found" message rather than an error.

---

## 6. External Service Integration

### Phase 1 Services

**Jira REST API**

| Aspect            | Detail                                                                                               |
| ----------------- | ---------------------------------------------------------------------------------------------------- |
| Purpose           | Issue CRUD — get, create, search, update                                                             |
| API version       | Cloud REST API v3 (to be confirmed during spike S1)                                                  |
| Base URL          | `https://{domain}.atlassian.net/rest/api/3/`                                                         |
| Auth method       | API token via env var (`JIRA_API_TOKEN` + `JIRA_USER_EMAIL`), Basic Auth header                      |
| HTTP client       | Native `fetch` (Node 22+) — Jira's REST API is straightforward, no SDK needed                        |
| Rate limits       | Atlassian Cloud: ~100 requests/minute (varies by plan). Rate limit middleware slot accommodates this |
| Cost              | Free within Atlassian Cloud subscription                                                             |
| Key env vars      | `JIRA_BASE_URL`, `JIRA_USER_EMAIL`, `JIRA_API_TOKEN`                                                 |
| Enterprise caveat | Enterprise Atlassian may require OAuth 2.0 (3LO) or SAML-backed tokens. Escalate at Phase 2+         |

**AWS S3**

| Aspect           | Detail                                                                                |
| ---------------- | ------------------------------------------------------------------------------------- |
| Purpose          | Fetch per-project brand guidelines config (JSON)                                      |
| SDK              | `@aws-sdk/client-s3` (v3) — modular, S3 client only                                   |
| Auth method      | Access keys via env vars (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`) |
| Bucket structure | `{bucket-name}/{projectId}/guidelines.json`                                           |
| Cost             | Negligible — S3 GET requests are $0.0004 per 1,000 requests                           |
| Key env vars     | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `S3_BUCKET_NAME`          |

### Config Loader

All environment variables validated at startup with Zod. **Fail-fast** — the server refuses to start if any credential is missing or malformed. No silent defaults, no graceful degradation.

```
src/config/
  ├── index.ts          # Exports validated config object
  └── schemas.ts        # Zod schemas for all env vars
```

Illustrative schema:

```typescript
const ServerConfigSchema = z.object({
  jira: z.object({
    baseUrl: z.string().url(),
    userEmail: z.string().email(),
    apiToken: z.string().min(1),
  }),
  s3: z.object({
    accessKeyId: z.string().min(1),
    secretAccessKey: z.string().min(1),
    region: z.string().min(1),
    bucketName: z.string().min(1),
  }),
});
```

### Future Services

| Service           | Phase   | Purpose                                                                                                                  | Integration Type |
| ----------------- | ------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------- |
| Azure DevOps      | Phase 2 | Pipeline status, work items                                                                                              | REST API         |
| SonarQube         | Phase 2 | Static code analysis — bugs, code smells, security vulnerabilities, technical debt (free community edition / paid cloud) | REST API         |
| Snyk              | Phase 2 | Dependency vulnerability scanning — known CVEs in packages, fix suggestions (free tier / paid enterprise)                | REST API         |
| Confluence        | Phase 3 | Documentation search                                                                                                     | REST API         |
| Nanobanana/Gemini | Future  | AI image generation                                                                                                      | REST API / SDK   |

> **Note:** SonarQube and Snyk represent the _categories_ of code quality and dependency security tooling. The specific vendor choice is flexible — alternatives include SonarCloud, ESLint (for lighter analysis), npm audit, or GitHub Dependabot. These are listed as future placeholders for the integration pattern, not firm vendor commitments.

---

## 7. Tech Stack

### Stack

| Layer           | Technology                   | Notes                                                                                                                                           |
| --------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime         | Node.js 22+ (LTS)            | Native fetch, stable ESM                                                                                                                        |
| Language        | TypeScript 5.x (strict mode) | `strict: true`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`                                                                        |
| MCP Framework   | `@modelcontextprotocol/sdk`  | Official SDK, Zod-native tool registration                                                                                                      |
| Validation      | Zod 3.25.x                   | All boundaries: inputs, API responses, config. Pinned to 3.25.x — Zod v4 has known incompatibility with MCP SDK v1.x. Revisit when SDK v2 ships |
| HTTP Client     | Native `fetch` (Node 22+)    | No external dependency; reassess if retry/interceptor needs arise                                                                               |
| AWS             | `@aws-sdk/client-s3` (v3)    | Modular — S3 client only                                                                                                                        |
| Package Manager | pnpm                         | Strict dependency hoisting, fast installs                                                                                                       |
| Formatting      | Prettier                     | 2-space indent, trailing commas ES5, semicolons required                                                                                        |
| Linting         | ESLint + `typescript-eslint` | Strict TypeScript rules, no `any` without justification                                                                                         |
| Build           | `tsc` (TypeScript compiler)  | ESM output to `dist/`; no bundler needed                                                                                                        |
| Git Hooks       | Husky                        | Pre-commit: lint + format. Pre-push: lint + format + type-check + build                                                                         |
| Module Format   | ESM                          | `"type": "module"` in `package.json`; `NodeNext` module resolution                                                                              |

### Testing (Deferred)

Testing is deferred for the POC to reduce overhead during rapid iteration. Zod validation at all boundaries provides a level of runtime safety.

**Evolution trigger:** Add Vitest before Streamable HTTP gate. Framework choice: Vitest (fast, TypeScript-native).

### Dev Tooling

**Git hooks (Husky):** Included.

- **Pre-commit:** `pnpm lint && pnpm format:check`
- **Pre-push:** `pnpm lint && pnpm format:check && pnpm type-check && pnpm build`

**CI/CD:** Deferred — no pipeline until there is something to deploy.

**Changelog:** Deferred — POC does not need release management yet.

**Editor config:** Prettier + ESLint configs committed. Minimal but consistent.

### Future Considerations

| Consideration              | When to Revisit                                                        |
| -------------------------- | ---------------------------------------------------------------------- |
| Bundler (esbuild/tsup)     | If distribution size matters or startup time is critical               |
| Monorepo (pnpm workspaces) | If tools need independent packaging/versioning or production build-out |
| Docker                     | When Streamable HTTP deployment is tackled                             |
| Structured logger (pino)   | If JSON log output needs more than the thin wrapper provides           |
| Vitest                     | Before Streamable HTTP gate                                            |

---

## 8. Project Structure

```
mcp-server-poc/
├── docs/
│   ├── architecture.md              # System design (this document)
│   └── roadmap.md                   # Phase roadmap (single source of truth)
│
├── src/
│   ├── server.ts                    # createServer(config) factory — registers all tools
│   ├── types.ts                     # ToolContext interface, shared types
│   │
│   ├── transports/
│   │   ├── stdio.ts                 # Entry point: stdio transport (Phase 1)
│   │   └── http.ts                  # Entry point: Streamable HTTP (Phase 1→2 gate)
│   │
│   ├── tools/
│   │   ├── jira/
│   │   │   ├── index.ts             # registerJiraTools(context)
│   │   │   ├── get-issue.ts         # jira_get_issue handler + input schema
│   │   │   ├── create-issue.ts      # jira_create_issue handler + input schema
│   │   │   ├── search-issues.ts     # jira_search_issues handler + input schema
│   │   │   ├── update-issue.ts      # jira_update_issue handler + input schema
│   │   │   └── schemas.ts           # Shared Jira Zod schemas (response types)
│   │   │
│   │   └── brand-guidelines/
│   │       ├── index.ts             # registerBrandTools(context)
│   │       ├── get-guidelines.ts    # brand_get_guidelines handler + input schema
│   │       └── schemas.ts           # Brand config Zod schemas
│   │
│   ├── shared/
│   │   ├── errors.ts                # ToolError hierarchy (ExternalServiceError, etc.)
│   │   ├── logger.ts                # Structured JSON logger (console.error for stdio)
│   │   ├── http-client.ts           # Thin fetch wrapper (timeouts, error wrapping)
│   │   └── rate-limit.ts            # Rate limit config shape + middleware slot
│   │
│   └── config/
│       ├── index.ts                 # Exports validated config object
│       └── schemas.ts               # Zod schemas for all env vars
│
├── .husky/
│   ├── pre-commit                   # pnpm lint && pnpm format:check
│   └── pre-push                     # pnpm lint && pnpm format:check && pnpm type-check && pnpm build
│
├── .claude/                          # Claude Code configuration
│
├── .env.example                      # Template with all required env vars (no values)
├── .env                              # Actual credentials (gitignored)
├── .gitignore
├── .prettierrc                       # Prettier config
├── eslint.config.js                  # ESLint flat config (ESM)
├── package.json
├── tsconfig.json
└── README.md
```

### Dependency Flow

```
transports/stdio.ts ──► server.ts ──► tools/jira/index.ts ──► tools/jira/get-issue.ts
transports/http.ts  ──►     │    ──► tools/brand/index.ts ──► tools/brand/get-guidelines.ts
                            │                    │
                            ▼                    ▼
                       types.ts           shared/errors.ts
                       config/index.ts    shared/logger.ts
                                          shared/http-client.ts
                                          config/index.ts
```

**Rules:**

- Transport entry points depend on `server.ts` and `config/` only — never on tools directly.
- `server.ts` depends on tool registration functions and `types.ts` — never on tool internals.
- Tool handlers receive `ToolContext` and depend on `shared/` and `config/` — never on each other.
- `types.ts` depends on `config/` (for `ServerConfig` type) and SDK types — nothing else.
- `shared/` has no dependencies on tools or config (standalone utilities).
- `config/` is a leaf — depends on nothing internal.

**Notes:**

- No `src/index.ts` barrel file. The entry points are the transport files.
- `.env.example` is committed as documentation of required env vars. `.env` is gitignored.
- ESLint uses flat config (`eslint.config.js`) — the newer format for ESM projects.
- `dist/` is gitignored. `tsc` outputs there (configured in `tsconfig.json`).

---

## 9. Open Items

### Risks

| #   | Risk                                                   | Mitigation                                                                                    | Status    |
| --- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------- | --------- |
| R1  | Jira API token restrictions in enterprise environments | POC uses personal/service account token; escalate to OAuth 2.0 (3LO) for enterprise Atlassian | Monitored |
| R2  | S3 bucket permissions misconfigured                    | Fail-fast at startup with clear error; `.env.example` documents required IAM permissions      | Open      |
| R3  | MCP SDK breaking changes (protocol still evolving)     | Pin SDK version in `package.json`; monitor changelog before upgrading                         | Monitored |
| R4  | Streamable HTTP complexity underestimated              | Dedicated spike (S3) before Phase 2 gate; SDK has built-in transport + auth middleware        | Open      |
| R5  | Tool response too verbose for LLM context windows      | Transformer layer surfaces only essential fields; monitor token usage during testing          | Open      |
| R6  | Native fetch limitations surface during implementation | Thin `http-client.ts` wrapper provides a single swap point if an external library is needed   | Open      |

### Phase 2+ MCP Primitives

The following MCP capabilities are out of scope for Phase 1 but should be evaluated during Phase 2 planning:

| Primitive                   | Purpose                                                                            | Phase 1 Relevance                                | Phase 2+ Opportunity                                                                               |
| --------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| **Resources**               | Expose listable, URI-addressable data to clients                                   | None — tools are stateless API proxies           | Brand guidelines as a resource (`brand://deck-loc/guidelines`); Jira projects as a resource list   |
| **Prompts**                 | Reusable workflow templates that chain tool calls                                  | None                                             | Common workflows (e.g. "search Jira for open bugs in project X and summarise") as prompt templates |
| **Output schemas**          | Typed `structuredContent` alongside human-readable `content`                       | None — text responses sufficient for human users | CI/CD agents and API consumers (Phase 2 target users) benefit from typed, parseable responses      |
| **Elicitation**             | Server-initiated user confirmation before actions                                  | None — Jira create/update are reversible         | Destructive operations (delete tools, bulk updates)                                                |
| **Progress / Cancellation** | Progress reporting and cooperative cancellation for long-running tasks             | None — API calls are sub-second                  | Image generation, bulk operations, report generation                                               |
| **Sampling**                | Server-initiated LLM calls                                                         | None                                             | Automated workflows (e.g. auto-tagging, summarisation)                                             |
| **Tasks primitive**         | Async long-running operations with durable state (experimental in 2025-11-25 spec) | None                                             | Truly long-running operations (minutes/hours)                                                      |

### Spikes

| #   | Spike                          | Purpose                                                                                          | Status  |
| --- | ------------------------------ | ------------------------------------------------------------------------------------------------ | ------- |
| S1  | Jira REST API v3 exploration   | Confirm API version, auth flow, response shapes, rate limits                                     | Planned |
| S2  | S3 brand config structure      | Define bucket layout, JSON schema shape, access patterns                                         | Planned |
| S3  | Streamable HTTP transport      | Validate SDK's `StreamableHTTPServerTransport` with Express, session management, auth middleware | Planned |
| S4  | Brand guidelines config schema | Define the actual Zod schema for brand config JSON                                               | Planned |

### Phase Roadmap

Single source of truth: `docs/roadmap.md`

```
Phase 1 (stdio + Jira + Brand Guidelines)
    │
    ▼
Streamable HTTP Gate (spike S3 — must pass before Phase 2)
    │
    ▼
Phase 2 (developer tooling + enterprise integrations)
    │
    ▼
Phase 3 (knowledge base + cross-service)
```

---

## Visual References

- **MCP Server Team AI Tooling Platform**: [Miro widget](https://miro.com/app/board/uXjVGFuezRU=/?moveToWidget=3458764659097372005&cot=14)
- **MCP Server Team Rollout Flow**: [Miro widget](https://miro.com/app/board/uXjVGFuezRU=/?moveToWidget=3458764659097372030&cot=14)
- **MCP Server Naming Convention**: [Miro widget](https://miro.com/app/board/uXjVGFuezRU=/?moveToWidget=3458764659097647598&cot=14)
