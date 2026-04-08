# External Service Integration

**Parent:** [architecture.md](../architecture.md)

---

## Phase 1 Services

### Jira REST API

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

### AWS S3

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

---

## Future Services

| Service           | Phase   | Purpose                                                                                                                  | Integration Type |
| ----------------- | ------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------- |
| Azure DevOps      | Phase 2 | Pipeline status, work items                                                                                              | REST API         |
| SonarQube         | Phase 2 | Static code analysis — bugs, code smells, security vulnerabilities, technical debt (free community edition / paid cloud) | REST API         |
| Snyk              | Phase 2 | Dependency vulnerability scanning — known CVEs in packages, fix suggestions (free tier / paid enterprise)                | REST API         |
| Confluence        | Phase 3 | Documentation search                                                                                                     | REST API         |
| Nanobanana/Gemini | Future  | AI image generation                                                                                                      | REST API / SDK   |

> **Note:** SonarQube and Snyk represent the _categories_ of code quality and dependency security tooling. The specific vendor choice is flexible — alternatives include SonarCloud, ESLint (for lighter analysis), npm audit, or GitHub Dependabot. These are listed as future placeholders for the integration pattern, not firm vendor commitments.
