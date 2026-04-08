# Data Flow

**Parent:** [architecture.md](../architecture.md)

---

## Shared Pattern

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

### Shared Infrastructure

| Component           | Responsibility                                            |
| ------------------- | --------------------------------------------------------- |
| HTTP client wrapper | Thin native `fetch` wrapper with timeouts, error wrapping |
| Response formatter  | Consistent MCP content structure across tools             |
| Error classes       | `ToolError` hierarchy for typed, loggable errors          |
| Logger              | Structured JSON logging with correlation IDs, OWASP-safe  |
| Config loader       | Zod-validated env var loading at startup                  |

---

## Jira Tool Data Flow

```
┌──────────────┐     ┌──────────────────┐     ┌─────────────────┐     ┌──────────────┐
│ MCP Client   │────►│ jira_get_issue   │────►│ Jira REST API   │────►│ MCP Response │
│              │     │                  │     │ (Cloud v3)      │     │              │
│ Input:       │     │ 1. Build URL     │     │                 │     │ Output:      │
│ { issueKey:  │     │ 2. Add auth      │     │ GET /rest/api/3/│     │ { content:   │
│   "PROJ-123" │     │    header (env)  │     │   issue/PROJ-123│     │   [{ type:   │
│ }            │     │ 3. Fetch         │     │                 │     │     "text",  │
│              │     │ 4. Zod validate  │     │ Returns: JSON   │     │     text:    │
│              │     │    response      │     │ issue object    │     │     "..."    │
│              │     │ 5. Format result │     │                 │     │   }]         │
└──────────────┘     └──────────────────┘     └─────────────────┘     └──────────────┘
```

### Jira Schemas

| Schema                 | Purpose                        | Key Fields                                     |
| ---------------------- | ------------------------------ | ---------------------------------------------- |
| `JiraGetIssueInput`    | Input for `jira_get_issue`     | `issueKey: z.string()`                         |
| `JiraCreateIssueInput` | Input for `jira_create_issue`  | `project, summary, issueType, description?`    |
| `JiraSearchInput`      | Input for `jira_search_issues` | `jql: z.string(), maxResults?: z.number()`     |
| `JiraUpdateIssueInput` | Input for `jira_update_issue`  | `issueKey, fields: z.record(...)`              |
| `JiraIssueResponse`    | Validates Jira API response    | `key, summary, status, assignee, ...` (subset) |

The server acts as a **transformer layer** — Jira returns a 200+ field object; we Zod-validate and surface only the fields that matter to the MCP client.

---

## Brand Guidelines Tool Data Flow

```
┌──────────────┐     ┌──────────────────┐     ┌─────────────────┐     ┌──────────────┐
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
└──────────────┘     └──────────────────┘     └─────────────────┘     └──────────────┘
```

### Brand Guidelines Schemas

| Schema                    | Purpose                          | Key Fields                                                            |
| ------------------------- | -------------------------------- | --------------------------------------------------------------------- |
| `BrandGetGuidelinesInput` | Input for `brand_get_guidelines` | `projectId: z.string()`                                               |
| `BrandGuidelinesConfig`   | Validates S3 JSON payload        | TBD during spike S4 — likely `colours, typography, tone, assets, ...` |

**S3 key pattern:** `{bucket}/{projectId}/guidelines.json`

If a project does not have guidelines, the tool returns a clear "not found" message rather than an error.
