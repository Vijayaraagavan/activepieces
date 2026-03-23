## Headless Activepieces Architecture

### Goal
Use Activepieces as a headless integration and automation subsystem behind our main product, not as the primary user-facing application.

Our main backend remains the source of truth for:

* users
* organizations
* workspaces
* roles and permissions
* product UI and business logic

Activepieces is used for:

* connection storage and OAuth handling
* workflow automation
* trigger/webhook execution
* integration control-plane data tied to a project

Our own backend will additionally provide:

* synchronous request/response integration actions
* bulk and incremental sync pipelines
* business-facing analytics and operational views

### Core Decision
We are **not** treating Activepieces as a full multi-user workspace for end customers.

Instead:

1. Our backend maps each external `workspace` or `organization` to a dedicated Activepieces project.
2. Our backend talks to Activepieces through service credentials.
3. End users do not need to exist as Activepieces users unless we later expose Activepieces UI or Activepieces-native RBAC to them.

### Project Mapping
Recommended mapping:

* external org/workspace -> one Activepieces `TEAM` project
* store the external identifier in `project.externalId`

Why `TEAM` and not `PERSONAL`:

* `PERSONAL` projects are tied to Activepieces `ownerId`
* our model does not require mirroring every product user into Activepieces
* `TEAM` projects fit backend-managed shared workspaces better

### What We Do Not Sync
By default, we do **not** sync these concepts into Activepieces:

* end users
* workspace members
* org members
* role assignments from our product

Reason:

* our app already owns these concepts
* Activepieces membership only adds value when humans log into Activepieces directly
* project-member sync would add lifecycle and authorization drift without helping the current headless model

### When User Sync Would Be Needed
We should only sync users and project members into Activepieces if one of these becomes true:

* customers log into Activepieces directly
* operators manage flows inside Activepieces UI
* we need Activepieces-native collaboration, invitations, or RBAC
* we want ownership and auditability to be attached to real Activepieces user accounts

Until then, user/member sync is unnecessary complexity.

### Responsibilities Split

#### Activepieces
Use Activepieces for:

* app connections and OAuth
* workflow definitions
* event-driven automation
* trigger execution
* webhook endpoints
* project-scoped automation data

#### Main Backend
Use our backend for:

* tenant, workspace, and user management
* authentication and authorization for our product
* project provisioning in Activepieces
* direct synchronous API actions
* long-running sync jobs
* analytics, dashboards, and operator workflows

### Request/Response Actions
We do not want to force all SaaS operations through flow runs.

Examples:

* create a Google spreadsheet
* send a Slack message
* create or update a HubSpot record

These should be served by our own backend through provider adapters or an internal action runtime.

Activepieces remains useful here because it already stores the connection credentials we need.

### Sync Pipelines
Large-scale sync is a separate execution model from workflows.

Examples:

* import `800k` HubSpot contacts
* backfill CRM data
* run recurring incremental syncs with checkpoints

This should live in our backend sync workers, not in normal Activepieces flow execution.

Why:

* sync needs pagination, checkpoints, retries, and rate-limit handling
* workflow execution is not the best primitive for large data movement
* bulk sync requires its own observability and replay model

### Connection Strategy
Activepieces is the single source of truth for integration connections.

We should avoid splitting connection ownership across multiple systems unless there is a strong reason to do so.

Recommended rule:

* Activepieces stores the connection
* our backend resolves and uses that connection
* workflows, request/response actions, and sync jobs all point back to the same connection source

This avoids:

* duplicated OAuth state
* token refresh ownership conflicts
* reconnect drift between systems
* harder debugging

### Operating Model
The practical operating model is:

1. User connects an integration in our product.
2. Our backend provisions or looks up the mapped Activepieces project.
3. The connection is stored in Activepieces for that project.
4. Activepieces handles workflow automation for that project.
5. Our backend uses the same project and connection context for direct actions and sync pipelines.

### Why This Architecture
This architecture gives us:

* one integration connection store
* one workflow engine
* our own fast execution path for synchronous actions
* our own scalable execution path for sync
* clear separation between product concerns and automation concerns

It also avoids turning Activepieces into something it does not need to be for our product:

* primary user directory
* source of truth for tenants
* source of truth for product roles
* bulk sync engine

### Summary
Our approach is:

* **Main backend** = user/workspace/org system of record
* **Activepieces** = headless workflow and connection control plane
* **Custom backend services** = request/response actions and sync pipelines

This keeps Activepieces focused on what it already does well, while letting our product own the user experience and higher-scale integration workloads.
