## OAuth App Configuration & Management

### 1. Default Behavior (Zero Setup)
Out of the box, our self-hosted Activepieces instance uses the official Activepieces Cloud Proxy. This means **all 400+ integration pieces work instantly**. You do not need to manually register OAuth apps or obtain Client IDs/Secrets to start building flows. Authentication is routed safely through Activepieces' shared global developer credentials.

### 2. Production Best Practices (Custom OAuth)
While the default proxy is perfect for quick development and lightly used tools, we must configure **Custom OAuth Apps** for our critical, heavily used, or highly sensitive integrations (e.g., Slack, Notion). 

Overriding the default proxy with our own credentials provides three mandatory production benefits:
* **Dedicated Rate Limits:** We avoid sharing API limits with the broader open-source community, preventing random throttling from breaking our production flows.
* **Security & Compliance:** The OAuth handshake happens strictly between our server and the third-party app, completely bypassing the Activepieces cloud infrastructure.
* **White-Label Branding:** The user authorization screen will display our company name rather than "Activepieces."

### 3. Selective Implementation Workflow
**Do not register custom apps for every piece.** We only override the integrations that matter.
1. Identify the core pieces that require dedicated limits, branding, or strict compliance.
2. Register an OAuth app directly in that vendor's developer portal (e.g., the Slack API Dashboard).
3. Input the resulting `Client ID` and `Client Secret` into the Activepieces UI under **Platform Admin → Setup → Pieces**.
4. Allow all other non-critical pieces to continue using the default plug-and-play cloud proxy.