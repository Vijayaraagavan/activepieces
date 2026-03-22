## Ngrok Webhook Setup For Local Development

### The Problem
While testing webhook-style triggers locally, the webhook URL looked correct in the UI, but no run history appeared after the external service sent a request.

In our case, Google Sheets change notifications were reaching ngrok, but the request failed before Activepieces created a flow run:

```text
POST /api/v1/webhooks/<flowId> 403 Forbidden
```

This was confusing because:

1. The worker logs showed a public URL based on ngrok.
2. The local API runs on port `3000`.
3. The local web dev server runs on port `4200`.
4. `.env.dev` also contains `AP_WEBHOOK_URL`, which suggests webhook routing might depend on it.

### Root Cause
In this repo, webhook URLs used by the worker are derived from `AP_FRONTEND_URL`, not `AP_WEBHOOK_URL`.

The flow is:

1. `AP_FRONTEND_URL` becomes the worker `PUBLIC_URL`.
2. The worker converts that into `https://<public-host>/api/`.
3. Trigger webhooks are built as `https://<public-host>/api/v1/webhooks/<flowId>`.

That means when running the normal dev stack:

1. External traffic must enter through the frontend dev server on port `4200`.
2. Vite then proxies `/api` to the API server on port `3000`.

If ngrok points to `4200` but Vite rejects the public host, the request never reaches the API. The symptom is a `403 Forbidden` from the dev server, and no trigger event or flow run is created.

### The Fix
Use the ngrok URL as `AP_FRONTEND_URL`, tunnel ngrok to port `4200`, and explicitly allow the ngrok hostname in Vite.

Example:

```env
AP_FRONTEND_URL="https://deedee-nonpredicative-ester.ngrok-free.dev"
```

In `packages/web/vite.config.mts`:

```ts
server: {
  allowedHosts: ['deedee-nonpredicative-ester.ngrok-free.dev'],
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

Start ngrok against the web dev server:

```bash
ngrok http 4200
```

### Important Notes
* `AP_WEBHOOK_URL` did not control the webhook URL used by the worker in this setup.
* If ngrok points directly to `3000`, it will not match the normal dev flow used by the frontend public URL.
* A successful incoming webhook should no longer return `403` at ngrok.
* If the request reaches the API but there is still no run history, check whether:
  * the flow is published and enabled
  * the request is hitting the production webhook path versus a draft or test path
  * the trigger itself is rejecting the payload or handshake

### Practical Verification
After the fix:

1. ngrok should show `POST /api/v1/webhooks/<flowId>` with a non-`403` response.
2. The API server should log the webhook handling path.
3. Activepieces should create trigger activity and, for executable production webhooks, a real flow run.
