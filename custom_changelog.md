# Custom Fork Guidelines & Changelog

Welcome to our customized fork of Activepieces! To avoid merge conflict nightmares and ensure we never lose track of our custom code during upstream syncs, all developers must follow these three core rules:

### 1. Branching & Updating (Rebase, Never Merge)
* **Keep `main` Pristine:** The `main` branch must remain an exact, untouched mirror of the official upstream Activepieces repository. Never commit custom code directly to `main`.
* **Work on the Custom Branch:** All modifications must be committed to our dedicated custom branch (e.g., `custom-prod`).
* **Update via Rebase:** When pulling upstream updates into `main`, update our custom branch by rebasing it on top of `main`. This ensures our custom commits are always stacked cleanly at the top of the Git history.

### 2. Code-Level Discipline
* **Tag Core Modifications:** Anytime you alter an existing core file, wrap your code in searchable comment blocks so it is instantly identifiable during conflict resolution:
  `// --- MY_CUSTOM_START: [Brief description of change] ---`
  `// --- MY_CUSTOM_END ---`
* **Log It Here:** Every time you touch a core file, log the file path, date, and reason in the changelog section below. 

### 3. Architecture Best Practices
* **Avoid Core Changes When Possible:** If you are adding new apps or integrations, build them as isolated "Custom Pieces" in their own folders. Do not touch the core engine for this.
* **Localize Core Edits:** If you must modify the core engine or UI, keep changes as localized as possible. Try to inject logic at the very beginning or end of existing functions rather than rewriting the original code.

---

## Changelog Entries
*(Add new core modifications below this line following the format: Date | File Path | Author | Description)*

### Docs
* All the custom docs are written to [docs/custom](docs/custom)
* 2026-03-22 | [docs/custom/ngrok-webhook-dev-setup.md](docs/custom/ngrok-webhook-dev-setup.md) | Codex | Added troubleshooting notes for local webhook testing with ngrok, including the `4200` vs `3000` routing confusion, `AP_FRONTEND_URL` behavior, and Vite `allowedHosts` requirement.
* 2026-03-23 | [docs/custom/headless-activepieces-architecture.md](docs/custom/headless-activepieces-architecture.md) | Codex | Documented the headless Activepieces architecture: external workspace/org to Activepieces team project mapping, backend-owned users and permissions, Activepieces as connection/workflow control plane, and custom backend responsibility for direct actions and sync pipelines.
* 2026-04-03 | [docs/custom/headless-openapi.yaml](docs/custom/headless-openapi.yaml) | Cursor | OpenAPI 3.0 spec for the headless internal API (projects, flows, flow runs, webhooks, connections, pieces).
* 2026-04-03 | [docs/custom/headless-api-testing.md](docs/custom/headless-api-testing.md) | Cursor | Curl-based API testing guide covering the full flow lifecycle, webhook triggers, connections, and an end-to-end script.
* 2026-04-03 | [docs/custom/admin-ui-guide.md](docs/custom/admin-ui-guide.md) | Cursor | Documentation for the Admin UI frontend app (setup, features, OAuth2 flow, templates).

### Admin UI — Headless API Testing App
*Created 2026-04-03. Independent React frontend at `packages/custom/admin-ui/` for managing and testing headless AP APIs. No core file modifications — entirely new files.*

* 2026-04-03 | `packages/custom/admin-ui/` | Cursor | New independent React + Vite + Tailwind app with: projects CRUD, flows CRUD with operation builder, flow runs viewer with auto-refresh, connections management (Secret Text, Basic Auth, Custom Auth, OAuth2 popup flow), pieces browser, 7 built-in flow templates (webhook+code, schedule+http, webhook+router, google-sheets OAuth, slack OAuth), webhook tester, and settings page with health check.

### Headless Internal Auth Bypass (Superuser Principal)
*Implemented 2026-04-03. Allows backend-to-backend access via `x-internal-api-key` header, bypassing all auth/authz for trusted internal requests.*

* 2026-04-03 | `packages/server/api/src/app/helper/system/system-props.ts` | Cursor | Added `INTERNAL_API_KEY`, `INTERNAL_PLATFORM_ID` env vars (tagged `MY_CUSTOM_START: Headless internal auth env vars`)
* 2026-04-03 | `packages/server/api/src/app/core/security/v2/authn/authentication-middleware.ts` | Cursor | Added internal request detection (`isInternalRequest`), platform owner ID caching (`resolveOwnerIdOnce`), and USER principal injection for headless bypass (tagged `MY_CUSTOM_START: Headless internal auth bypass`)
* 2026-04-03 | `packages/server/api/src/app/core/security/v2/authz/authorization-middleware.ts` | Cursor | Skip `authorizeOrThrow` for internal requests while preserving `projectId` extraction (tagged `MY_CUSTOM_START: Headless authz bypass import` and `MY_CUSTOM_START: Skip authorization for headless internal requests`)
* 2026-04-03 | `packages/server/api/src/app/project/project-controller.ts` | Cursor | Replaced community project controller with headless multi-project controller: `POST /` (create TEAM projects with externalId), `GET /` (list all platform projects for internal), `DELETE /:id` (soft-delete) (tagged `MY_CUSTOM_START: Headless multi-project controller`)
* 2026-04-03 | `packages/server/api/src/app/helper/system-validator.ts` | Cursor | Added validators for `INTERNAL_API_KEY`, `INTERNAL_PLATFORM_ID`, `INTERNAL_URL` (tagged `MY_CUSTOM_START: Headless internal auth validators`)

### Startup Optimization (Skip Migrations)
*Implemented 2026-04-03. Allows skipping DB migrations on restart via `AP_SKIP_MIGRATIONS=true` for faster dev startup.*

* 2026-04-03 | `packages/server/api/src/app/helper/system/system-props.ts` | Cursor | Added `SKIP_MIGRATIONS` env var (tagged `MY_CUSTOM_START: Skip migrations for faster dev restart`)
* 2026-04-03 | `packages/server/api/src/main.ts` | Cursor | Conditionally skip migration distributed lock when `AP_SKIP_MIGRATIONS=true` (tagged `MY_CUSTOM_START: Skip migrations for faster dev restart`)
* 2026-04-03 | `packages/server/api/src/app/helper/system-validator.ts` | Cursor | Added `SKIP_MIGRATIONS` boolean validator (tagged `MY_CUSTOM_START: Skip migrations validator`)

### exclude enterprise editon that are licensed
* we must not use the below modules in self host due to licensing restriction. remove them during fork sync or merge.
```
➜ find . -type d -name "ee"
./dist/packages/ee
./packages/tests-e2e/scenarios/ee
./packages/ee
./packages/server/api/test/unit/app/ee
./packages/server/api/test/integration/ee
./packages/server/api/src/app/ee
./packages/shared/dist/src/lib/ee
./packages/shared/src/lib/ee
```

### dev setup
create pg database
```
➜ psql -h localhost -U postgres
Password for user postgres: 
psql (16.9 (Homebrew), server 16.6)
Type "help" for help.

postgres=# create database activepieces;
CREATE DATABASE
postgres=# exit
```

for public webhook testing in local dev
```bash
# .env.dev
AP_FRONTEND_URL="https://<your-ngrok-host>"

# expose the frontend dev server
ngrok http 4200
```

Vite must allow the public ngrok host or webhook requests can fail with `403 Forbidden` before they ever reach the API proxy.

Update `packages/web/vite.config.mts`:
```ts
server: {
  allowedHosts: ['<your-ngrok-host>'],
  proxy: {
    '/api': {
      target: 'http://127.0.0.1:3000',
      secure: false,
      changeOrigin: true,
      headers: {
        Host: '127.0.0.1:4200',
      },
      ws: true,
    },
  },
  port: 4200,
  host: '0.0.0.0',
},
```

Why this matters:
* In this repo, worker webhook URLs are derived from `AP_FRONTEND_URL`.
* The public webhook path resolves to `https://<public-host>/api/v1/webhooks/<flowId>`.
* That means ngrok should terminate at port `4200`, then Vite proxies `/api` to port `3000`.
