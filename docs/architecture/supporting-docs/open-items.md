# Open Items

**Parent:** [architecture.md](../architecture.md)

---

## Risks

| #   | Risk                                                   | Mitigation                                                                                    | Status    |
| --- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------- | --------- |
| R1  | Jira API token restrictions in enterprise environments | POC uses personal/service account token; escalate to OAuth 2.0 (3LO) for enterprise Atlassian | Monitored |
| R2  | S3 bucket permissions misconfigured                    | Fail-fast at startup with clear error; `.env.example` documents required IAM permissions      | Open      |
| R3  | MCP SDK breaking changes (protocol still evolving)     | Pin SDK version in `package.json`; monitor changelog before upgrading                         | Monitored |
| R4  | Streamable HTTP complexity underestimated              | Dedicated spike (S3) before Phase 2 gate; SDK has built-in transport + auth middleware        | Open      |
| R5  | Tool response too verbose for LLM context windows      | Transformer layer surfaces only essential fields; monitor token usage during testing          | Open      |
| R6  | Native fetch limitations surface during implementation | Thin `http-client.ts` wrapper provides a single swap point if an external library is needed   | Open      |

## Phase 2+ MCP Primitives

The following MCP capabilities are out of scope for Phase 1 but should be evaluated during Phase 2 planning:

| Primitive                   | Purpose                                                                            | Phase 2+ Opportunity                                                                               |
| --------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **Resources**               | Expose listable, URI-addressable data to clients                                   | Brand guidelines as a resource (`brand://deck-loc/guidelines`); Jira projects as a resource list   |
| **Prompts**                 | Reusable workflow templates that chain tool calls                                  | Common workflows (e.g. "search Jira for open bugs in project X and summarise") as prompt templates |
| **Output schemas**          | Typed `structuredContent` alongside human-readable `content`                       | CI/CD agents and API consumers (Phase 2 target users) benefit from typed, parseable responses      |
| **Elicitation**             | Server-initiated user confirmation before actions                                  | Destructive operations (delete tools, bulk updates)                                                |
| **Progress / Cancellation** | Progress reporting and cooperative cancellation for long-running tasks             | Image generation, bulk operations, report generation                                               |
| **Sampling**                | Server-initiated LLM calls                                                         | Automated workflows (e.g. auto-tagging, summarisation)                                             |
| **Tasks primitive**         | Async long-running operations with durable state (experimental in 2025-11-25 spec) | Truly long-running operations (minutes/hours)                                                      |

## Spikes

| #   | Spike                          | Purpose                                                                                          | Status  |
| --- | ------------------------------ | ------------------------------------------------------------------------------------------------ | ------- |
| S1  | Jira REST API v3 exploration   | Confirm API version, auth flow, response shapes, rate limits                                     | Planned |
| S2  | S3 brand config structure      | Define bucket layout, JSON schema shape, access patterns                                         | Planned |
| S3  | Streamable HTTP transport      | Validate SDK's `StreamableHTTPServerTransport` with Express, session management, auth middleware | Planned |
| S4  | Brand guidelines config schema | Define the actual Zod schema for brand config JSON                                               | Planned |

## Phase Roadmap

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
