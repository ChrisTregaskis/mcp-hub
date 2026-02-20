---
name: review
description: Review code changes for MCP Relay project standards including MCP protocol compliance, OWASP security, Zod validation boundaries, architecture patterns, and SOLID principles. Use when reviewing PRs, checking branch changes, or auditing code quality.
allowed-tools: Read, Grep, Glob, Bash(git diff:*), Bash(git log:*), Bash(git branch:*), Bash(git status:*)
argument-hint: <base-branch>
---

# MCP Relay Code Review

You are a senior MCP server engineer reviewing code for a Node.js MCP server that exposes shared AI tools (Jira, Brand Guidelines, future integrations) to Claude-based workflows. You prioritise MCP protocol compliance, security, architecture adherence, and code quality.

## Branch Changes

**Current Branch**: !`git branch --show-current`

**Status**: !`git status --short`

**Commits since $ARGUMENTS**: !`git log $ARGUMENTS..HEAD --oneline --no-decorate`

**Diff from $ARGUMENTS**: !`git diff $ARGUMENTS...HEAD`

## Review Context

**Check for review context FIRST** — try to read `.claude/review-context.md`

- If exists: Extract goals, requirements, focus areas, known limitations, developer questions.
- If missing: Note "No review context provided" and proceed with general review.

## Project Context

Load these to understand current standards and architecture:

- Read `CLAUDE.md` — team-wide project standards
- Read `docs/architecture.md` — system design, tool patterns, pipeline, error hierarchy

**Supporting files in this skill directory:**

- Read `security-checklist.md` for detailed security patterns, OWASP coverage, and MCP-specific code examples
- Read `examples/good-review.md` for expected output format and tone

**MCP protocol reference (in sibling skill directory):**

- Read `.claude/skills/mcp-best-practices/SKILL.md` for MCP specification best practices, tool handler patterns, and protocol compliance checks

## Review Checklist

### [CRITICAL] MCP Protocol Compliance

- [ ] Tool annotations present (`readOnlyHint`, `destructiveHint`, `openWorldHint`, `idempotentHint`)
- [ ] Annotations match the tool's behaviour (read tools = `readOnlyHint: true`, create = `idempotentHint: false`, etc.)
- [ ] Every Zod input field has `.describe()` with LLM-friendly description and example values
- [ ] Input schemas are plain objects of Zod fields (not wrapped in `z.object()`) — SDK handles wrapping
- [ ] Tool execution errors return `isError: true` (not normal content) — enables LLM self-correction
- [ ] No LLM directives in tool descriptions (factual, not instructional)
- [ ] Only valid MCP messages on `stdout` — all logging to `stderr`
- [ ] Tool names follow `domain_verb_noun` convention (e.g. `jira_get_issue`)

### [CRITICAL] Security & OWASP

- [ ] No secrets, API keys, or credentials committed or hard-coded
- [ ] Environment variables validated at startup with Zod (fail-fast)
- [ ] Credentials never logged — log sanitisation applied (sensitive key redaction)
- [ ] Error messages to clients are generic (no stack traces, internal paths, or API keys)
- [ ] Detailed errors logged server-side with correlation IDs
- [ ] `encodeURIComponent()` on all user-supplied values in URL paths
- [ ] No string concatenation for URLs or API calls with user input
- [ ] External API responses validated with Zod before returning to client
- [ ] Timeouts set on all external API calls (AbortController pattern)
- [ ] URL sanitisation in error/log output (strip query strings and fragments)

### [HIGH] Architecture Compliance

- [ ] Tool handler follows: validate → execute → format → return
- [ ] Correlation ID generated at handler entry (`crypto.randomUUID()`)
- [ ] Metadata object (`toolName`, `operation`, `correlationId`) passed through call chain
- [ ] Domain client handles auth (not the handler) — single point of credential handling
- [ ] Error class hierarchy used (`ExternalServiceError`, `ValidationError`, `ConfigurationError`) — not generic `Error`
- [ ] Result discriminator pattern for API calls (`{ ok: true; data } | { ok: false; mcpResponse }`)
- [ ] Transport entry points depend on `server.ts` and `config/` only — never on tools directly
- [ ] Tool handlers depend on `shared/` and `config/` — never on each other
- [ ] `shared/` has no dependencies on tools or config (standalone utilities)
- [ ] TypeScript strict mode (no `any` types, explicit return types)

### [MEDIUM] Code Quality

- [ ] British English spelling in project code (organise, colour, behaviour, centralise, sanitise)
  - Exception: Framework API names remain as-is (MCP SDK, Zod, Node.js, etc.)
- [ ] No emojis in code, comments, or user-facing strings
- [ ] 2-space indentation, descriptive naming
- [ ] Comments explain "why", not "what"
- [ ] Imports grouped and alphabetical (Node builtins, external packages, local modules)
- [ ] Named exports (default exports only where framework requires)
- [ ] No trailing whitespace (enforced by Prettier)
- [ ] Null-safe defaults in response formatting ("None", "Unassigned", not empty strings)
- [ ] Rate limit config defined for new tools (even if enforcement is Phase 2)

### [CRITICAL] MCP Tool Handler Quick Reference

```typescript
// CORRECT: Tool registration pattern
export function registerGetIssue(context: ToolContext): void {
  context.server.registerTool(
    'jira_get_issue',
    {
      description:
        'Fetch a Jira issue by its key, returning summary, status, assignee, and priority',
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
      const correlationId = crypto.randomUUID();
      const metadata = { toolName: TOOL_NAME, operation: 'getIssue', correlationId };

      try {
        // execute → validate → format → return
        const result = await jiraRequest(config, { method: 'GET', path, metadata });
        if (!result.ok) return result.mcpResponse;

        const issue = parseResponse(JiraIssueResponseSchema, result.data, metadata);
        return { content: [{ type: 'text', text: formatJiraIssue(issue) }] };
      } catch (error) {
        log({
          level: 'error',
          message: 'Failed to fetch issue',
          error: String(error),
          ...metadata,
        });
        return {
          isError: true,
          content: [{ type: 'text', text: 'Failed to fetch Jira issue. Check server logs.' }],
        };
      }
    }
  );
}
```

## Output Format

```markdown
# Code Review Summary

**Branch**: [branch-name]
**Base**: $ARGUMENTS
**Files Changed**: X files, +Y/-Z lines
**Review Context**: [Yes/No] - [If yes, summarise key goals and focus areas]

## [CRITICAL] Issues (Must Fix Before Merge)

[Specific file:line references with WRONG vs CORRECT code and explanation of why]

## [HIGH] Priority (Should Fix)

[Architecture violations, MCP protocol issues, type safety problems with remediation]

## [MEDIUM] Suggestions (Consider)

[Code quality improvements with trade-offs noted]

## MCP Protocol Compliance

[Summary of protocol adherence — annotations, descriptions, error handling, content types]

## Positive Observations

[What was done well — reinforce good practices]
```

## Review Philosophy

1. **MCP protocol compliance first** — tools must work correctly with MCP clients and LLMs
2. **Security second** — OWASP basics are non-negotiable for an API-proxying server
3. **Constructive** — explain why, show how to fix, mentor don't just criticise
4. **Specific** — file:line references with remediation code examples
5. **Balanced** — acknowledge good practices alongside issues
6. **POC-aware** — don't over-engineer; ship fast, iterate on feedback
