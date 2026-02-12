# Phase Roadmap

**Last Updated:** 2026-02-12

---

## Phases

| Phase   | Scope                                            | Tools                                    | Status  |
| ------- | ------------------------------------------------ | ---------------------------------------- | ------- |
| Phase 1 | Core server + two POC tools proving key patterns | Jira, Brand Guidelines                   | Current |
| Phase 2 | Developer tooling + enterprise integrations      | Azure DevOps, SonarQube, Snyk, CI/CD     | Planned |
| Phase 3 | Knowledge base + cross-service                   | Confluence, feature flags, observability | Future  |
| Future  | AI image generation (optional)                   | Nanobanana / Google Gemini               | Backlog |

---

## Phase 1: Core Server + POC Tools

**Goal:** Prove the MCP server pattern with two tools that demonstrate distinct integration patterns.

| Tool                 | What It Proves                                                 | External Service |
| -------------------- | -------------------------------------------------------------- | ---------------- |
| **Jira**             | Shared API credential access — one config, whole team benefits | Jira REST API    |
| **Brand Guidelines** | Per-project custom config fetched from external storage        | AWS S3           |

**Hypotheses:**

1. **Jira:** A single MCP server can provide authenticated Jira access to all team members without individual credential setup
2. **Brand Guidelines:** MCP tools can dynamically fetch and validate per-project configuration from external storage (S3), enabling project-specific behaviour without code changes

---

## Phase 2: Developer Tooling + Enterprise Integrations

**Goal:** Expand the tool catalogue with developer-facing integrations that reduce context-switching.

| Tool                   | Purpose                                       |
| ---------------------- | --------------------------------------------- |
| Azure DevOps Pipelines | Trigger builds, check status, view logs       |
| SonarQube / SonarCloud | Code quality metrics, technical debt tracking |
| Snyk / Dependabot      | Vulnerability scanning, dependency health     |
| CI/CD Integration      | Pipeline orchestration, deployment status     |

---

## Phase 3: Knowledge Base + Cross-Service

**Goal:** Connect information sources and enable cross-service workflows.

| Tool                | Purpose                                          |
| ------------------- | ------------------------------------------------ |
| Confluence / Notion | Internal documentation search                    |
| Feature flags       | LaunchDarkly or equivalent — status and toggling |
| Observability       | Datadog / New Relic — APM metrics, error rates   |

---

## Optional Future: AI Image Generation

**Goal:** Expose AI image generation capabilities via MCP (originated from the deck-localiser POC).

| Tool                       | Purpose                         |
| -------------------------- | ------------------------------- |
| Nanobanana / Google Gemini | AI image generation and editing |

Not phase-gated — can be added whenever there's a concrete need.

---

## Evolution Triggers

| Trigger                                 | Action                                               |
| --------------------------------------- | ---------------------------------------------------- |
| Phase 1 tools validated and in team use | Begin Phase 2 planning                               |
| Tool count exceeds 10                   | Consider plugin system or tool-per-package structure |
| Multiple teams using the server         | Evaluate hosting model (Docker, cloud deployment)    |
| Per-user auth requirements emerge       | Revisit auth mechanism (OAuth, per-user tokens)      |
