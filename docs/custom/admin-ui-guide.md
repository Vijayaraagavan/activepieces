# Admin UI — Headless API Testing App

An independent React frontend for managing and testing the headless Activepieces API. Located at `packages/custom/admin-ui/`.

## Quick Start

```bash
cd packages/custom/admin-ui

# Copy env and configure
cp .env.example .env
# Edit .env with your API URL and key

npm install
npm run dev
# Open http://localhost:5173
```

The dev server proxies `/api` requests to `http://127.0.0.1:3000` (the AP backend).

## Configuration

The app reads from environment variables or localStorage (Settings page overrides take priority):

| Variable | Description |
|----------|-------------|
| `VITE_AP_API_URL` | Activepieces API base URL (include `/api/v1`) |
| `VITE_AP_INTERNAL_API_KEY` | Must match `AP_INTERNAL_API_KEY` on the server |

You can also configure these at runtime on the **Settings** page (`/settings`), which stores values in localStorage.

## Features

### Projects (`/projects`)
- List all projects in the platform
- Create new TEAM projects with `externalId` for mapping to your external orgs/workspaces
- Soft-delete projects
- Click any project to navigate to its flows

### Flows (`/projects/:id/flows`)
- List all flows in a project
- Create new flows
- Quick enable/disable toggle
- Delete flows
- Click to open flow detail

### Flow Detail (`/projects/:id/flows/:flowId`)
- **Current Version** tab — view the full flow version JSON with copy-to-clipboard
- **Operations** tab — quick-action buttons for common operations:
  - Set Webhook Trigger
  - Set Schedule Trigger (5 min)
  - Add Code Action
  - Lock & Publish
  - Enable/Disable Flow
  - Custom operation builder with JSON editor for any `FlowOperationType`
- **Templates** tab — one-click apply built-in flow templates
- **Versions** tab — list all flow versions with state (DRAFT/LOCKED)

### Flow Runs (`/projects/:id/runs`)
- List all runs with filters (by flow ID, by status)
- Auto-refresh toggle (polls every 3 seconds)
- Click any run to view full JSON details in a dialog

### Connections (`/projects/:id/connections`)
- List all connections in a project
- Create connections of any type:
  - **Secret Text** — API keys, tokens
  - **Basic Auth** — username/password
  - **Custom Auth** — arbitrary key-value JSON
  - **OAuth2** — full popup-based OAuth flow:
    1. Enter client ID, secret, redirect URL
    2. Click "Get Auth URL" to generate and open the authorization popup
    3. Authorize in the popup, code is captured automatically
    4. Submit to exchange code for tokens
- Delete connections

### Templates (`/projects/:id/templates`)
- Browse 7 built-in flow templates:
  - Webhook + Code
  - Schedule + HTTP Request
  - Webhook + HTTP + Code
  - Schedule + Code Logger
  - Webhook + Router (Branching)
  - Google Sheets (OAuth2)
  - Slack Message (OAuth2)
- One-click deploy: creates a new flow and imports the template
- Import custom flow JSON (paste `ImportFlowRequest` format)

### Pieces Browser (`/pieces`)
- Search and browse all available pieces
- View piece details: actions, triggers, auth type
- Useful for discovering `pieceName`, `actionName`, `triggerName` values when building flows

### Webhook Tester (`/projects/:id/flows/:flowId/webhook`)
- Send arbitrary JSON payloads to `POST /api/v1/webhooks/:flowId`
- View the HTTP response
- Auto-polls for the resulting flow run

### Settings (`/settings`)
- Configure API URL and internal API key
- Test connection health check

## Tech Stack

- React 19 + TypeScript
- Vite 6 (dev server + build)
- Tailwind CSS 3.4 (utility-first styling)
- TanStack Query 5 (data fetching, caching, mutations)
- React Router 7 (client-side routing)
- Lucide React (icons)
- No dependency on `@activepieces/shared` — fully independent

## OAuth2 Flow

The OAuth2 connection flow works as follows:

1. User enters piece name, client ID, client secret, and redirect URL
2. App calls `POST /api/v1/app-connections/oauth2/authorization-url` to get the auth URL
3. A popup opens to the OAuth provider
4. User authorizes, provider redirects to `/oauth/callback` with `?code=xxx`
5. The callback page sends the code back to the opener via `postMessage`
6. The code is used in `POST /api/v1/app-connections` to exchange for tokens

The redirect URL defaults to `http://localhost:5173/oauth/callback`. Register this in your OAuth app settings.

## Building for Production

```bash
npm run build
# Output in dist/
```

Serve the `dist/` folder with any static file server.
