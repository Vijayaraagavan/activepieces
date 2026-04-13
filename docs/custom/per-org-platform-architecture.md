## Per-Org Platform Architecture

### Overview

Originally all organizations in the Elixir backend shared a single Activepieces platform. This doc describes the migration to **one AP platform per organization**, why it was necessary, and exactly what was changed on both the AP fork side and the Elixir backend side.

---

### Why One Platform Per Org

In Activepieces, a **Platform** is the top-level multi-tenant boundary. OAuth apps, connection settings, and piece feature flags all live within a platform. With a shared platform:

* All orgs' PLATFORM_OAUTH2 connections had to trust the same OAuth client credentials.
* Platform-level settings (allowed pieces, branding, etc.) couldn't be scoped per org.
* The long-term target is that each customer org can configure their own integration settings independently.

The decision was to create **one child platform per org** under a single shared admin user (the `bootstrap_platform_id` owner), removing the need for one AP user per org.

---

### Architecture Diagram

```
Bootstrap Platform (T2E917m7bpDvlEOLoeeMK)
│   owner: admin AP user
│   └── used only to provision child platforms
│
├── Org A Platform (gza2W7vVNUrI0MIHeDRxZ)  ← organizations.ap_platform_id
│   └── Project (wrk_abc...)
│       └── Flows, Connections
│
├── Org B Platform (...)
│   └── Project (wrk_xyz...)
│
OAuth App Credentials Platform (T2E917m7bpDvlEOLoeeMK)
│   ← same as bootstrap, shared for all orgs
│   └── oauth_app[piece-notion], oauth_app[piece-google-sheets], …
```

OAuth app credentials are **not** per-platform. They live on a single shared platform and all org platforms look them up there via `AP_INTERNAL_OAUTH_PLATFORM_ID`.

---

### AP Fork Changes

#### 1. Allow Multiple Platforms Per Owner (entity + migration)

By default AP enforces `@OneToOne` between `platform` and `user` (unique constraint `REL_94d6fd6494f0322c6f0e099141` on `platform.ownerId`). This was changed to `@ManyToOne`.

**`packages/server/api/src/app/platform/platform.entity.ts`**
```ts
// --- MY_CUSTOM_START: Allow multiple platforms per owner ---
@ManyToOne(() => UserEntity, { nullable: false, eager: false })
@JoinColumn({ name: 'ownerId' })
owner!: UserEntity
// --- MY_CUSTOM_END ---
```

**`packages/server/api/src/app/ee/database/migrations/postgres/20260412195500-remove-platform-owner-unique.ts`**
```ts
export class RemovePlatformOwnerUniqueConstraint1776023700000 implements MigrationInterface {
    name = 'RemovePlatformOwnerUniqueConstraint1776023700000'
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "platform" DROP CONSTRAINT "REL_94d6fd6494f0322c6f0e099141"
        `)
    }
    ...
}
```

> **TypeORM naming rule:** The migration class name and `name` property must end with a 13-digit JavaScript millisecond timestamp (e.g. `1776023700000`). A date string like `20260412` is rejected at startup.

Registered in **`packages/server/api/src/app/database/postgres-connection.ts`**.

---

#### 2. Platform Provisioning Endpoint

The Elixir backend needs to provision a new AP platform when an org is created. A `POST /v1/platforms` endpoint was added.

**`packages/server/api/src/app/platform/platform.controller.ts`**
```ts
// --- MY_CUSTOM_START: Headless platform provisioning endpoint ---
app.post('/', CreatePlatformRequest, async (req, reply) => {
    const created = await platformService(req.log).create({
        ownerId: req.principal.id,
        name: req.body.name,
    })
    const platform = await platformService(req.log).getOneWithPlanOrThrow(created.id)
    return reply.status(StatusCodes.CREATED).send(platform)
})
// --- MY_CUSTOM_END ---
```

The route requires a `platformAdminOnly` principal. Internal requests satisfy this by injecting the platform owner as the principal (see section 3 below).

---

#### 3. Dynamic Platform Routing via `x-internal-platform-id`

Previously all internal requests were routed to a single static `AP_INTERNAL_PLATFORM_ID`. With per-org platforms, every internal request must carry the org's own platform ID so AP enforces the correct platform boundary.

**`packages/server/api/src/app/core/security/v2/authn/authentication-middleware.ts`**

Key changes:
- Replaced single `cachedOwnerId` with a `Map<platformId, ownerId>` cache.
- `x-internal-platform-id` header is now **required** on every internal request.
- The principal injected is `{ id: ownerId, platform: { id: platformId } }` where both are resolved dynamically per request.

```ts
// --- MY_CUSTOM_START: Headless internal multi-platform auth ---
const platformOwnerCache = new Map<string, string>()

function getInternalPlatformId(request: FastifyRequest): string {
    const raw = request.headers['x-internal-platform-id']
    // must be a single string value
    return raw
}

async function resolveOwnerId(log, platformId: string): Promise<string> {
    const cached = platformOwnerCache.get(platformId)
    if (cached) return cached
    const platform = await platformService(log).getOneOrThrow(platformId)
    platformOwnerCache.set(platformId, platform.ownerId)
    return platform.ownerId
}
// --- MY_CUSTOM_END ---
```

**`packages/server/api/src/app/core/security/v2/authz/authorization-middleware.ts`**

The previous version skipped authorization entirely for internal requests. This was tightened so that internal requests pass through `authorizeOrThrow` with their resolved principal (platform-scoped). Internal requests are therefore subject to normal authz — they just bypass token authentication.

---

#### 4. Shared OAuth App Credentials via `AP_INTERNAL_OAUTH_PLATFORM_ID`

OAuth app credentials (client_id + client_secret) are registered once on the shared platform and reused across all org platforms. AP's `oauth-app` table is keyed by `{platformId, pieceName, clientId}`, so without this, each org platform would need its own copy.

The fix: when claiming or refreshing a PLATFORM_OAUTH2 connection, always look up credentials from the shared platform ID.

**`packages/server/api/src/app/ee/app-connections/platform-oauth2-service.ts`**
```ts
// --- MY_CUSTOM_START: Shared OAuth platform lookup ---
import { system } from '../../helper/system/system'
import { AppSystemProp } from '../../helper/system/system-props'

const INTERNAL_OAUTH_PLATFORM_ID = system.get(AppSystemProp.INTERNAL_OAUTH_PLATFORM_ID)

function oauthLookupPlatformId(platformId: string): string {
    return INTERNAL_OAUTH_PLATFORM_ID ?? platformId
}
// --- MY_CUSTOM_END ---
```

This value is a module-level constant read **once at startup**.

**`packages/server/api/src/app/helper/system/system-props.ts`**
```ts
INTERNAL_OAUTH_PLATFORM_ID = 'INTERNAL_OAUTH_PLATFORM_ID',
```

**`.env.dev`**
```
AP_INTERNAL_OAUTH_PLATFORM_ID=T2E917m7bpDvlEOLoeeMK
```

> All env vars are prefixed with `AP_` at runtime — `system.get(AppSystemProp.INTERNAL_OAUTH_PLATFORM_ID)` reads `process.env.AP_INTERNAL_OAUTH_PLATFORM_ID`.

---

### Elixir Backend Changes

#### `organizations` table — `ap_platform_id` column

```elixir
# migration: 20260412190000_add_ap_platform_id_to_organizations.exs
add :ap_platform_id, :string
create unique_index(:organizations, [:ap_platform_id])
```

Stored on `Organization` schema as `field :ap_platform_id, :string`.

#### `Activepieces.ensure_platform_for_org/1`

Idempotent: if `org.ap_platform_id` is already set, returns `{:ok, org}`. Otherwise calls `POST /api/v1/platforms` (via the new AP endpoint above) and persists the returned platform ID.

```elixir
def ensure_platform_for_org(%Organization{ap_platform_id: pid} = org)
    when is_binary(pid) and pid != "", do: {:ok, org}

def ensure_platform_for_org(%Organization{} = org) do
  with {:ok, platform} <- Client.create_platform(org.display_name, platform_id: bootstrap_platform_id()),
       ap_platform_id <- platform["id"],
       {:ok, updated_org} <- org |> change(%{ap_platform_id: ap_platform_id}) |> Repo.update() do
    {:ok, updated_org}
  else
    _ -> {:error, :platform_provision_failed}
  end
end
```

#### `client_opts/1` — Per-request platform header

Every AP API call now sends `x-internal-platform-id` matching the org's platform:

```elixir
defp client_opts(%Workspace{} = ws) do
  org = get_org_for_workspace!(ws)
  [platform_id: org.ap_platform_id]
end
```

The `Client` module includes this header as `x-internal-platform-id` on every request.

#### `OAuthAppSync`

Syncs OAuth client credentials to the **shared** platform only (`oauth_platform_id` from config, same value as `AP_INTERNAL_OAUTH_PLATFORM_ID`). No per-org sync needed since AP always redirects credential lookup to this shared platform.

#### Backfill Task

Run once after deploying to provision existing orgs:

```bash
mix activepieces.backfill_org_platforms
```

This calls `ensure_platform_for_org` for every org, then resets `ap_project_id` on all workspaces so they re-provision under the new org-scoped platform on next use.

---

### Deployment Checklist

1. **AP fork**: deploy with the migration and updated code.
2. **Elixir**: run `mix ecto.migrate` then `mix activepieces.backfill_org_platforms`.
3. **Env vars**: ensure `AP_INTERNAL_OAUTH_PLATFORM_ID` is set in AP's environment.
4. **OAuth sync**: run `ElixirSandbox.Automations.OAuthAppSync.sync_all()` in iex to populate the shared platform's credentials.
5. **Restart AP** after setting the env var (it's a module-level constant read at startup).

---

### Config Reference

| Location | Key | Value |
|---|---|---|
| AP `.env.dev` | `AP_INTERNAL_OAUTH_PLATFORM_ID` | `T2E917m7bpDvlEOLoeeMK` (shared platform) |
| AP `.env.dev` | `AP_INTERNAL_PLATFORM_ID` | `T2E917m7bpDvlEOLoeeMK` (bootstrap, kept for compat) |
| Elixir `dev.secret.exs` | `bootstrap_platform_id` | `T2E917m7bpDvlEOLoeeMK` |
| Elixir `dev.secret.exs` | `oauth_platform_id` | `T2E917m7bpDvlEOLoeeMK` |
| `organizations` DB column | `ap_platform_id` | per-org AP platform ID |

---

### Files Changed Summary

**AP fork (`custom-prod` branch):**

| File | Change |
|---|---|
| `platform/platform.entity.ts` | `@OneToOne` → `@ManyToOne` for `owner` relation |
| `ee/database/migrations/postgres/20260412195500-remove-platform-owner-unique.ts` | New migration: drops unique constraint on `platform.ownerId` |
| `database/postgres-connection.ts` | Registers new migration |
| `platform/platform.controller.ts` | Adds `POST /v1/platforms` provisioning endpoint |
| `core/security/v2/authn/authentication-middleware.ts` | Dynamic per-platform principal injection from `x-internal-platform-id` |
| `core/security/v2/authz/authorization-middleware.ts` | Internal requests now pass through authz (not skipped) |
| `helper/system/system-props.ts` | Added `INTERNAL_OAUTH_PLATFORM_ID` prop |
| `helper/system-validator.ts` | Added validator for `INTERNAL_OAUTH_PLATFORM_ID` |
| `ee/app-connections/platform-oauth2-service.ts` | Shared OAuth platform lookup via `AP_INTERNAL_OAUTH_PLATFORM_ID` |
| `.env.dev` | Added `AP_INTERNAL_OAUTH_PLATFORM_ID` |

**Elixir backend (`main` branch):**

| File | Change |
|---|---|
| `priv/repo/migrations/20260412190000_add_ap_platform_id_to_organizations.exs` | New column `ap_platform_id` on `organizations` |
| `organizations/organization.ex` | Added `ap_platform_id` field |
| `activepieces.ex` | `ensure_platform_for_org/1`, `client_opts/1` per-platform routing |
| `activepieces/client.ex` | Sends `x-internal-platform-id` header on every request |
| `automations/oauth_app_sync.ex` | Syncs to shared platform only |
| `workers/run_status_sync_worker.ex` | Platform-aware workspace context |
| `mix/tasks/activepieces.backfill_org_platforms.ex` | One-time backfill task |
| `config/config.exs`, `config/runtime.exs` | Added `bootstrap_platform_id`, `oauth_platform_id` config keys |
