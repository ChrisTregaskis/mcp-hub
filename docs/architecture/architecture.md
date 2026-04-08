# Architecture: MCP Relay

**Status:** Draft v0.1
**Last Updated:** 2026-02-12
**Protocol Version:** 2025-11-25

---

## Contents

1. [Overview](#1-overview)
2. [System Context](#2-system-context)
3. [Architecture Approach](#3-architecture-approach)
4. [Project Structure](#4-project-structure)
5. [Visual References](#5-visual-references)
6. [Supporting Documentation](#6-supporting-documentation)

---

## 1. Overview

A centralised MCP server that provides shared AI tooling to teams. One server, one set of credentials, a curated tool catalogue — any MCP-compatible client connects with zero individual setup.

Implements the [Model Context Protocol](https://modelcontextprotocol.io) (MCP). While primarily validated with Claude-based clients (Claude Code, Cowork, Claude Desktop), the architecture is client-agnostic.

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
```

### POC Scope (Phase 1)

| In scope     | Jira tools (get, create, search, update), Brand Guidelines (S3 config fetch), shared auth (env vars), stdio transport, Zod validation, error handling, rate limiting hooks, structured logging |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Out of scope | Azure DevOps, SonarQube, CI/CD tools, Nanobanana/Gemini, per-user auth (OAuth), Streamable HTTP (Phase 1→2 gate), production hosting, plugin system                                            |

### Target Users

| User Type               | Client               | Use Case                                             |
| ----------------------- | -------------------- | ---------------------------------------------------- |
| Developers              | Claude Code, VS Code | Jira queries, brand guideline lookups                |
| Delivery teams          | Claude Code, Cowork  | Jira issue management, project config access         |
| Non-technical users     | Cowork               | Natural language access to Jira and brand guidelines |
| CI/CD agents (Phase 2+) | API consumers        | Headless tool invocation                             |

---

## 2. System Context

```
  MCP Clients                      MCP Server                    External Services
 ┌─────────────────┐          ┌──────────────────────┐       ┌─────────────────────┐
 │ Claude Code     │──stdio──►│                      │       │                     │
 │ Claude Desktop  │──stdio──►│   mcp-relay          │──────►│  Jira REST API v3   │
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

### Transport

- **Phase 1:** stdio (`StdioServerTransport`) — env var auth, per-developer
- **Phase 1→2 gate:** Streamable HTTP (`StreamableHTTPServerTransport`) — spike S3 must pass first
- **Phase 2+:** Streamable HTTP with OAuth 2.1

### Runtime (Phase 1)

Stateless, local process launched per-session, single client per process, no caching layer.

---

## 3. Architecture Approach

### MCP Server Pipeline

```
MCP Client Request
        │
        ▼
┌──────────────────┐
│  Transport Layer │  (stdio / Streamable HTTP)
└────────┬─────────┘
         ▼
┌──────────────────┐
│  MCP Protocol    │  (JSON-RPC routing — SDK handles)
└────────┬─────────┘
         ▼
┌──────────────────┐
│  Input Validation│  (Zod — automatic via SDK)
└────────┬─────────┘
         ▼
┌──────────────────┐
│  [Rate Limit]    │  (middleware slot — hooks only in Phase 1)
└────────┬─────────┘
         ▼
┌──────────────────┐
│  Tool Handler    │  (validate → execute → format)
└────────┬─────────┘
         ▼
┌──────────────────┐
│  Error Handling  │  (typed results, MCP error codes, logging)
└────────┬─────────┘
         ▼
  MCP Client Response
```

- Input validation is automatic (SDK parses Zod schemas before handler runs)
- Output validation is manual (external API responses validated with Zod inside handlers)
- Error handling wraps everything — handlers return typed results; unhandled errors caught at transport layer

### Tool Context

Handlers receive a lightweight `ToolContext` object providing access to the server and validated config:

```typescript
export interface ToolContext {
  server: McpServer;
  config: ServerConfig;
}
```

### Tool Handler Pattern

Functional with registration functions. Each tool domain is a directory with one file per operation. Adding a new operation = new file + one line in the domain's `index.ts`.

### Error Hierarchy

```
ToolError (base)
├── ExternalServiceError    — API failures, timeouts
├── ValidationError         — Zod parse failure on API responses
└── ConfigurationError      — Missing env var, invalid config at startup
```

Client-facing errors are generic (OWASP). Structured logging captures detail server-side with correlation IDs via `console.error` (stdout reserved for MCP protocol in stdio transport).

### Evolution Triggers

| Trigger                           | Action                                                   |
| --------------------------------- | -------------------------------------------------------- |
| Tool count exceeds 10             | Consider auto-discovery registry or plugin system        |
| Handler files exceed ~150 lines   | Extract shared utilities                                 |
| Multiple tools share complex auth | Extract auth into shared middleware                      |
| Streamable HTTP is added          | Introduce session management, per-session server factory |

### Implemented Tools (Phase 1)

| Tool Name              | Purpose                              | External Service | Type  |
| ---------------------- | ------------------------------------ | ---------------- | ----- |
| `jira_get_issue`       | Fetch a Jira issue by key            | Jira REST API    | Read  |
| `jira_create_issue`    | Create a new Jira issue              | Jira REST API    | Write |
| `jira_search_issues`   | Search issues via JQL                | Jira REST API    | Read  |
| `jira_update_issue`    | Update an existing issue             | Jira REST API    | Write |
| `brand_get_guidelines` | Fetch brand guidelines for a project | AWS S3           | Read  |

---

## 4. Project Structure

```
mcp-relay/
├── docs/
│   ├── architecture/
│   │   ├── architecture.md              # System design (this document)
│   │   └── supporting-docs/             # Detailed reference material
│   │       ├── key-decisions.md
│   │       ├── data-flow.md
│   │       ├── external-services.md
│   │       ├── tech-stack.md
│   │       └── open-items.md
│   └── roadmap.md                       # Phase roadmap (single source of truth)
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
│   └── pre-push                     # pnpm lint && pnpm format:check && pnpm typecheck && pnpm build
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
- `shared/` has no dependencies on tools or config (standalone utilities).
- `config/` is a leaf — depends on nothing internal.
- No `src/index.ts` barrel file. The entry points are the transport files.

---

## 5. Visual References

- **MCP Server Team AI Tooling Platform**: [Miro widget](https://miro.com/app/board/uXjVGFuezRU=/?moveToWidget=3458764659097372005&cot=14)
- **MCP Server Team Rollout Flow**: [Miro widget](https://miro.com/app/board/uXjVGFuezRU=/?moveToWidget=3458764659097372030&cot=14)
- **MCP Server Naming Convention**: [Miro widget](https://miro.com/app/board/uXjVGFuezRU=/?moveToWidget=3458764659097647598&cot=14)

---

## 6. Supporting Documentation

| Document                                                  | Contents                                                    |
| --------------------------------------------------------- | ----------------------------------------------------------- |
| [Key Decisions](supporting-docs/key-decisions.md)         | Resolved and deferred architecture questions with rationale |
| [Data Flow](supporting-docs/data-flow.md)                 | Per-tool data flow diagrams and Zod schema inventories      |
| [External Services](supporting-docs/external-services.md) | Jira, S3, and future service integration details            |
| [Tech Stack](supporting-docs/tech-stack.md)               | Full stack table, dev tooling, and future considerations    |
| [Open Items](supporting-docs/open-items.md)               | Risks, Phase 2+ MCP primitives, spikes, and phase roadmap   |
