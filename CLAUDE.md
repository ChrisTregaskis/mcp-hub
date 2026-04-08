# Claude Code Configuration: MCP Relay

## Project Overview

MCP Relay — a custom Model Context Protocol server that exposes shared AI tools (image generation, document processing, integrations) to any Claude-based workflow: Cowork, Claude Code, or API agents. This is a **server/library project**, not a UI application.

## Tech Stack

- **Runtime**: Node.js (LTS)
- **Language**: TypeScript (strict mode)
- **MCP Framework**: `@modelcontextprotocol/sdk`
- **Validation**: Zod for all tool inputs, outputs, and configuration
- **Testing**: Vitest
- **Formatting**: Prettier (2-space indentation)
- **Language variant**: British English throughout

## Project Structure

```
mcp-relay/
├── docs/                          # Source of truth (committed)
│   └── architecture.md             # System design (v0.1)
├── .claude/
│   └── docs/
│       └── mcp-integration-strategy.md  # Seed strategy document
├── src/                            # Application code
└── [root config files]
```

> **Note:** This is a server/library project. No React, no Next.js, no Tailwind. Focus is on MCP protocol, tool handlers, and API integrations.

## Code Style Guidelines

### Language & Formatting

- **English variant**: British English throughout (colour, localise, organise, behaviour, etc.)
- **Indentation**: 2 spaces
- **TypeScript**: Strict mode enabled, no `any` types without justification
- **Semicolons**: Required
- **Trailing commas**: ES5

### Principles

- **SOLID Principles**: Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, Dependency Inversion
- **OWASP**: Particularly relevant here — input validation, secure API key management, output encoding, rate limiting, no secrets in code
- **Zod Validation**: All tool inputs, API responses, configuration, and data boundaries use Zod schemas
- **Error Handling**: Explicit error handling with typed results, no silent failures

### MCP Server Conventions

- Each tool handler is a self-contained module with its own Zod input/output schemas
- Tool handlers follow a consistent pattern: validate → execute → format response
- Tool handlers receive a `ToolContext` object (server + config) — not the server directly
- API keys and secrets are loaded from environment variables with Zod validation
- Tool metadata (name, description, inputSchema, annotations) is co-located with the handler
- **Every Zod input field must have `.describe()`** with an LLM-friendly description — include example values for non-obvious fields
- **Every tool must include `annotations`** (`readOnlyHint`, `destructiveHint`, `openWorldHint`, `idempotentHint`)
- Input schemas are plain objects of Zod fields (not wrapped in `z.object()`) — the SDK handles wrapping
- All external API calls include timeout handling and retry logic

### API & Security (OWASP Focus)

- **Input validation**: Zod on all tool inputs — no trusting MCP client data
- **API key management**: Environment variables only, validated at startup, never logged
- **Output encoding**: Sanitise responses before returning to MCP clients
- **Rate limiting**: Centralised per-tool rate limiting to prevent cost overruns
- **Error messages**: Generic messages to clients, detailed logging server-side
- **No secrets in code**: Use `.env` files (gitignored) with Zod-validated config loaders

## Key Commands

```bash
# Development
pnpm dev                    # Start development server (watch mode)
pnpm build                  # Compile TypeScript

# Code Quality
pnpm lint                   # Run ESLint
pnpm format                 # Format with Prettier
pnpm format:check           # Check formatting without changes
pnpm typecheck              # TypeScript strict check

# Testing
pnpm test                   # Run Vitest
pnpm test:watch             # Watch mode
pnpm test:coverage          # Coverage report
```

## Architecture & Documentation

**Source of Truth**: `docs/architecture.md` (to be drafted interactively)

**Seed Document**: `.claude/docs/mcp-integration-strategy.md` — captures initial thinking from the deck-localiser POC.

Refer to architecture docs for:

- MCP server design and tool registration
- Transport layer decisions (stdio vs HTTP/SSE)
- API integration patterns
- Authentication and authorisation approach
- Rate limiting and cost management
- Deployment architecture

## Git Operations

Git operations are user-controlled. Claude Code will not:

- Create branches
- Add/commit files
- Push changes
- Merge pull requests

Users manage all git workflows directly.

## Validation Standards

### Zod Schemas

Every boundary requires Zod validation:

- MCP tool input parameters
- MCP tool output responses
- External API responses (Nanobanana, Jira, Azure DevOps, etc.)
- Environment configuration
- Server startup configuration

### API Keys & Secrets

- Store in `.env` (gitignored)
- Load via `process.env` with Zod validation at startup
- Never log or expose in error messages or MCP responses
- Rotate centrally — the MCP server is the single point of credential management

## Development Workflow

1. Read `docs/architecture.md` to understand system design
2. Use appropriate skill based on task context
3. Follow code style guidelines strictly
4. Run `pnpm lint && pnpm format` before committing
5. Request code review with the senior-code-reviewer agent for significant changes

## Claude Code Features

- **Plans**: Available for multi-step implementation; outlined before execution
- **Agents**: Senior code reviewer available for autonomous review
- **Skills**: Domain skills to be populated as architecture solidifies
- **Spikes**: Technical exploration documents in `.claude/spikes/`
- **Local files**: Optional `.claude/local/` directory for developer-specific files (gitignored) — e.g. `project-state.md`, `review-context.md`. Not every developer will create one
- **Session continuity**: `.claude/local/project-state.md` maintains context across sessions (if the directory exists)
