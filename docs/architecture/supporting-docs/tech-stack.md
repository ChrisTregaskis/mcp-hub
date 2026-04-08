# Tech Stack

**Parent:** [architecture.md](../architecture.md)

---

## Stack

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
| Git Hooks       | Husky                        | Pre-commit: lint + format. Pre-push: lint + format + typecheck + build                                                                          |
| Module Format   | ESM                          | `"type": "module"` in `package.json`; `NodeNext` module resolution                                                                              |

## Testing (Deferred)

Testing is deferred for the POC to reduce overhead during rapid iteration. Zod validation at all boundaries provides a level of runtime safety.

**Evolution trigger:** Add Vitest before Streamable HTTP gate. Framework choice: Vitest (fast, TypeScript-native).

## Dev Tooling

**Git hooks (Husky):**

- **Pre-commit:** `pnpm lint && pnpm format:check`
- **Pre-push:** `pnpm lint && pnpm format:check && pnpm typecheck && pnpm build`

**CI/CD:** Deferred — no pipeline until there is something to deploy.

**Changelog:** Deferred — POC does not need release management yet.

**Editor config:** Prettier + ESLint configs committed. Minimal but consistent.

## Future Considerations

| Consideration              | When to Revisit                                                        |
| -------------------------- | ---------------------------------------------------------------------- |
| Bundler (esbuild/tsup)     | If distribution size matters or startup time is critical               |
| Monorepo (pnpm workspaces) | If tools need independent packaging/versioning or production build-out |
| Docker                     | When Streamable HTTP deployment is tackled                             |
| Structured logger (pino)   | If JSON log output needs more than the thin wrapper provides           |
| Vitest                     | Before Streamable HTTP gate                                            |
