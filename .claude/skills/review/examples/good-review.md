# Example Code Review Output

This is an example of a well-formatted code review following MCP Relay project standards.

---

# Code Review Summary

**Branch**: `feature/jira-get-issue`
**Base**: `main`
**Files Changed**: 6 files, +287 lines, -12 lines
**Review Context**: No review context provided

---

## [CRITICAL] Issues (Must Fix Before Merge)

### 1. Missing `.describe()` on Zod Input Fields

**Location**: `src/tools/jira/get-issue.ts:18-22`

**Issue**: Input schema fields lack `.describe()`. LLMs rely on these descriptions to understand what values to provide — without them, the LLM guesses.

```typescript
// WRONG: CURRENT CODE
inputSchema: {
  issueKey: z.string(),
  expand: z.string().optional(),
},
```

**Remediation**:

```typescript
// CORRECT
inputSchema: {
  issueKey: z.string().describe('The Jira issue key (e.g. "PROJ-123")'),
  expand: z
    .string()
    .optional()
    .describe('Comma-separated list of fields to expand (e.g. "changelog,renderedFields")'),
},
```

**Why**: The MCP specification requires that input schema descriptions are the primary way LLMs understand tool parameters. Missing descriptions lead to incorrect tool invocations.

**Priority**: CRITICAL — MCP protocol compliance.

---

### 2. Secrets Exposed in Error Message

**Location**: `src/tools/jira/client.ts:45-48`

**Issue**: Error message includes the full request URL which may contain authentication tokens in query parameters.

```typescript
// WRONG: CURRENT CODE
throw new ExternalServiceError(
  `Jira API request failed: ${response.status} ${response.statusText} at ${url}`,
  metadata,
  response.status
);
```

**Remediation**:

```typescript
// CORRECT
const sanitisedUrl = url.split('?')[0]; // Strip query string
throw new ExternalServiceError(
  `Jira API request failed: ${response.status} ${response.statusText} at ${sanitisedUrl}`,
  metadata,
  response.status
);
```

**Why**: OWASP requires that error messages never expose sensitive data. Query strings may contain tokens or API keys. The HTTP client wrapper already handles this — ensure consistency.

**Priority**: CRITICAL — Security vulnerability.

---

### 3. Tool Execution Error Missing `isError: true`

**Location**: `src/tools/jira/get-issue.ts:52-56`

**Issue**: Error response returned as normal content rather than with `isError: true`. The LLM cannot distinguish this from a successful result and won't attempt self-correction.

```typescript
// WRONG: CURRENT CODE
return {
  content: [{ type: 'text', text: 'Failed to fetch Jira issue.' }],
};
```

**Remediation**:

```typescript
// CORRECT
return {
  isError: true,
  content: [{ type: 'text', text: 'Failed to fetch Jira issue. Check server logs for details.' }],
};
```

**Why**: The MCP specification states: "Clients SHOULD provide tool execution errors to language models to enable self-correction." Without `isError: true`, the LLM treats the error message as a valid tool result.

**Priority**: CRITICAL — MCP protocol compliance.

---

## [HIGH] Priority (Should Fix)

### 4. Missing Correlation ID

**Location**: `src/tools/jira/get-issue.ts:25-30`

**Issue**: Handler does not generate a correlation ID at entry. Errors and log entries from this handler cannot be traced across the call chain.

```typescript
// WRONG: CURRENT CODE
async ({ issueKey }) => {
  const result = await jiraRequest(config, {
    method: 'GET',
    path: `/rest/api/3/issue/${encodeURIComponent(issueKey)}`,
    metadata: { toolName: TOOL_NAME, operation: 'getIssue' },
  });
```

**Remediation**:

```typescript
// CORRECT
async ({ issueKey }) => {
  const correlationId = crypto.randomUUID();
  const metadata: ErrorMetadata = {
    toolName: TOOL_NAME,
    operation: 'getIssue',
    correlationId,
  };

  log({ level: 'info', message: `Fetching Jira issue ${issueKey}`, ...metadata });
  const startTime = Date.now();

  const result = await jiraRequest(config, {
    method: 'GET',
    path: `/rest/api/3/issue/${encodeURIComponent(issueKey)}`,
    metadata,
  });
```

**Why**: Correlation IDs are essential for tracing requests across log entries, especially when debugging production issues. The architecture mandates them for all tool invocations.

**Priority**: HIGH — Architecture compliance and observability.

---

### 5. Missing Timeout on External API Call

**Location**: `src/tools/jira/client.ts:32-38`

**Issue**: `fetch` call has no timeout. A hung Jira API would block the tool indefinitely.

```typescript
// WRONG: CURRENT CODE
const response = await fetch(url, {
  method,
  headers,
  body,
});
```

**Remediation**:

```typescript
// CORRECT: Use the shared HTTP client which handles timeouts
const response = await httpRequest({
  url,
  method,
  headers,
  body,
  timeoutMs: 30_000,
  metadata,
});
```

**Why**: The MCP specification requires timeout handling: "Implementations SHOULD establish timeouts for all sent requests, to prevent hung connections and resource exhaustion." The shared HTTP client wrapper already provides this — use it.

**Priority**: HIGH — Reliability and spec compliance.

---

## [MEDIUM] Suggestions (Consider)

### 6. American Spelling in Domain Code

**Location**: `src/tools/jira/schemas.ts:34`, `src/shared/errors.ts:12`

**Issue**: American spelling used in project-specific code.

```typescript
// WRONG: CURRENT CODE
export function normalizeResponse(data: unknown) { ... }
const sanitizedUrl = url.split('?')[0];
```

**Remediation**:

```typescript
// CORRECT
export function normaliseResponse(data: unknown) { ... }
const sanitisedUrl = url.split('?')[0];
```

**Why**: Project standards require British English throughout (CLAUDE.md). Framework API names remain as-is, but project-specific identifiers use British spelling.

**Priority**: MEDIUM — Code quality and consistency.

---

### 7. External API Response Not Validated

**Location**: `src/tools/brand-guidelines/get-guidelines.ts:42-45`

**Issue**: S3 JSON response parsed but not validated with Zod. Malformed upstream data would propagate unchecked.

```typescript
// WRONG: CURRENT CODE
const config = JSON.parse(responseBody);
return { content: [{ type: 'text', text: JSON.stringify(config, null, 2) }] };
```

**Remediation**:

```typescript
// CORRECT
const parsed = JSON.parse(responseBody);
const config = parseResponse(BrandGuidelinesConfigSchema, parsed, metadata);
return { content: [{ type: 'text', text: formatBrandGuidelines(config) }] };
```

**Why**: Zod validation at all boundaries is a project standard. External API responses are untrusted data — they must be validated before being returned to MCP clients.

**Priority**: MEDIUM — Validation standard and data integrity.

---

## MCP Protocol Compliance

### Summary

| Check                             | Status              |
| --------------------------------- | ------------------- |
| Tool annotations present          | Pass                |
| Annotations match behaviour       | Pass                |
| `.describe()` on all input fields | **FAIL** (Issue #1) |
| `isError: true` on failures       | **FAIL** (Issue #3) |
| stdout/stderr separation          | Pass                |
| Tool naming convention            | Pass                |

---

## Positive Observations

### Strong Points in This PR

1. **Correct Tool Annotations**: `readOnlyHint: true` correctly set for the get-issue tool. Annotation pattern matches the architecture doc conventions.

2. **Clean `encodeURIComponent()` Usage**: User-supplied `issueKey` correctly encoded in URL path construction (`get-issue.ts:28`).

3. **Proper Domain Separation**: Jira client module (`client.ts`) handles auth — handler never touches credentials directly.

4. **Zod Response Schema**: `JiraIssueResponseSchema` validates the subset of Jira fields we need, avoiding over-fetching the full 200+ field response.

5. **Null-Safe Formatting**: `formatJiraIssue()` handles nullable fields gracefully with "Unassigned", "None", "No description" defaults.

6. **ADF Text Extraction**: `extractTextFromAdf()` correctly walks the Atlassian Document Format tree and degrades gracefully for unknown node types.

---

## Summary

**Overall Assessment**: Solid implementation with critical MCP protocol compliance issues that must be fixed before merge.

**Must Fix**: 3 critical issues (input descriptions, secret in error, missing isError flag)
**Should Fix**: 2 high-priority issues (correlation ID, timeout handling)
**Consider**: 2 medium-priority improvements (British English, response validation)

**Next Steps**:

1. Fix critical issues (#1, #2, #3)
2. Address high-priority architecture issues (#4, #5)
3. Run `pnpm lint && pnpm format && pnpm typecheck && pnpm build` to verify
4. Consider suggestions for code quality improvements

**Recommendation**: Do not merge until critical issues are resolved. High-priority items should be addressed in this PR or tracked as follow-up tasks.

---

**Reviewer**: Claude Code (review skill)
**Review Date**: 2026-02-20
