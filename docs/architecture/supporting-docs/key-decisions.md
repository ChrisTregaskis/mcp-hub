# Key Decisions

**Parent:** [architecture.md](../architecture.md)

---

## Resolved

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

## Deferred

| #   | Question                                     | Why It Matters                                              | Status                                                  |
| --- | -------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------- |
| Q14 | Jira API version (v2 vs v3)?                 | Affects endpoint URLs, response shapes, available features  | Deferred — spike S1                                     |
| Q15 | Jira auth method (API token vs OAuth 2.0)?   | API token simpler for POC; OAuth needed for per-user access | Deferred — API token for Phase 1                        |
| Q16 | S3 access pattern (IAM role vs access keys)? | Affects deployment model and credential management          | Deferred — access keys for POC, IAM role for production |
| Q17 | Brand config format (JSON vs YAML)?          | Affects parsing, Zod schema design, S3 object structure     | Deferred — JSON (simpler, native, no extra parser)      |
| Q18 | S3 bucket structure for per-project configs? | Affects key naming, access control granularity              | Deferred — spike S2                                     |
| Q19 | Hosting model for Streamable HTTP?           | Docker, serverless, cloud VM                                | Deferred — spike S3                                     |
