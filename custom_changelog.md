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
