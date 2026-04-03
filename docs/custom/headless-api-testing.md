# Headless API Testing Guide

This guide provides ready-to-use `curl` commands for testing every headless API endpoint. All requests use the `x-internal-api-key` header for authentication.

## Prerequisites

- Activepieces running locally (`http://localhost:4200` via Vite proxy or `http://localhost:3000` direct)
- `AP_INTERNAL_API_KEY` and `AP_INTERNAL_PLATFORM_ID` configured in `.env.dev`
- Platform bootstrapped via initial sign-up

Set these shell variables to avoid repetition:

```bash
BASE_URL="http://localhost:4200/api/v1"
API_KEY="your-secret-key-here"
```

---

## 1. Projects

### Create a project

```bash
curl -X POST "$BASE_URL/projects" \
  -H "Content-Type: application/json" \
  -H "x-internal-api-key: $API_KEY" \
  -d '{
    "displayName": "Org ABC",
    "externalId": "org-abc-123"
  }'
```

Save the returned `id` — you'll use it as `PROJECT_ID` in subsequent calls.

```bash
PROJECT_ID="<id from response>"
```

### List all projects

```bash
curl -X GET "$BASE_URL/projects" \
  -H "x-internal-api-key: $API_KEY"
```

### Get a project by ID

```bash
curl -X GET "$BASE_URL/projects/$PROJECT_ID" \
  -H "x-internal-api-key: $API_KEY"
```

### Update a project

```bash
curl -X POST "$BASE_URL/projects/$PROJECT_ID" \
  -H "Content-Type: application/json" \
  -H "x-internal-api-key: $API_KEY" \
  -d '{
    "displayName": "Org ABC (renamed)"
  }'
```

### Delete a project (soft-delete)

```bash
curl -X DELETE "$BASE_URL/projects/$PROJECT_ID" \
  -H "x-internal-api-key: $API_KEY"
```

---

## 2. Flows

### Create a flow

```bash
curl -X POST "$BASE_URL/flows" \
  -H "Content-Type: application/json" \
  -H "x-internal-api-key: $API_KEY" \
  -d '{
    "projectId": "'$PROJECT_ID'",
    "displayName": "My Automation Flow"
  }'
```

Save the returned `id`:

```bash
FLOW_ID="<id from response>"
```

### List flows in a project

```bash
curl -X GET "$BASE_URL/flows?projectId=$PROJECT_ID" \
  -H "x-internal-api-key: $API_KEY"
```

### Get a flow by ID

```bash
curl -X GET "$BASE_URL/flows/$FLOW_ID" \
  -H "x-internal-api-key: $API_KEY"
```

### Set a schedule trigger (every 5 minutes)

```bash
curl -X POST "$BASE_URL/flows/$FLOW_ID" \
  -H "Content-Type: application/json" \
  -H "x-internal-api-key: $API_KEY" \
  -d '{
    "type": "UPDATE_TRIGGER",
    "request": {
      "name": "trigger",
      "displayName": "Every 5 Minutes",
      "type": "PIECE_TRIGGER",
      "valid": true,
      "settings": {
        "pieceName": "@activepieces/piece-schedule",
        "pieceVersion": "~0.2.0",
        "triggerName": "every_x_minutes",
        "input": { "minutes": 5 },
        "inputUiInfo": {},
        "propertySettings": {},
        "packageType": "REGISTRY",
        "pieceType": "OFFICIAL"
      }
    }
  }'
```

### Set a webhook trigger

```bash
curl -X POST "$BASE_URL/flows/$FLOW_ID" \
  -H "Content-Type: application/json" \
  -H "x-internal-api-key: $API_KEY" \
  -d '{
    "type": "UPDATE_TRIGGER",
    "request": {
      "name": "trigger",
      "displayName": "Catch Webhook",
      "type": "PIECE_TRIGGER",
      "valid": true,
      "settings": {
        "pieceName": "@activepieces/piece-webhook",
        "pieceVersion": "~0.1.0",
        "triggerName": "catch_webhook",
        "input": {},
        "inputUiInfo": {},
        "propertySettings": {},
        "packageType": "REGISTRY",
        "pieceType": "OFFICIAL"
      }
    }
  }'
```

### Add a code action

```bash
curl -X POST "$BASE_URL/flows/$FLOW_ID" \
  -H "Content-Type: application/json" \
  -H "x-internal-api-key: $API_KEY" \
  -d '{
    "type": "ADD_ACTION",
    "request": {
      "parentStep": "trigger",
      "stepLocationRelativeToParent": "AFTER",
      "action": {
        "name": "step_1",
        "displayName": "Run Code",
        "type": "CODE",
        "valid": true,
        "settings": {
          "input": {},
          "sourceCode": {
            "code": "export const code = async (inputs) => { return { message: \"Hello from headless AP!\", timestamp: new Date().toISOString() }; }",
            "packageJson": "{}"
          }
        }
      }
    }
  }'
```

### Add a piece action (e.g. HTTP request)

```bash
curl -X POST "$BASE_URL/flows/$FLOW_ID" \
  -H "Content-Type: application/json" \
  -H "x-internal-api-key: $API_KEY" \
  -d '{
    "type": "ADD_ACTION",
    "request": {
      "parentStep": "step_1",
      "stepLocationRelativeToParent": "AFTER",
      "action": {
        "name": "step_2",
        "displayName": "HTTP GET",
        "type": "PIECE",
        "valid": true,
        "settings": {
          "pieceName": "@activepieces/piece-http",
          "pieceVersion": "~0.4.0",
          "actionName": "send_request",
          "input": {
            "method": "GET",
            "url": "https://httpbin.org/get",
            "headers": {},
            "body_type": "none",
            "body": {}
          },
          "inputUiInfo": {},
          "packageType": "REGISTRY",
          "pieceType": "OFFICIAL"
        }
      }
    }
  }'
```

### Lock and publish the flow

```bash
curl -X POST "$BASE_URL/flows/$FLOW_ID" \
  -H "Content-Type: application/json" \
  -H "x-internal-api-key: $API_KEY" \
  -d '{
    "type": "LOCK_AND_PUBLISH",
    "request": {}
  }'
```

### Enable the flow

```bash
curl -X POST "$BASE_URL/flows/$FLOW_ID" \
  -H "Content-Type: application/json" \
  -H "x-internal-api-key: $API_KEY" \
  -d '{
    "type": "CHANGE_STATUS",
    "request": { "status": "ENABLED" }
  }'
```

### Disable the flow

```bash
curl -X POST "$BASE_URL/flows/$FLOW_ID" \
  -H "Content-Type: application/json" \
  -H "x-internal-api-key: $API_KEY" \
  -d '{
    "type": "CHANGE_STATUS",
    "request": { "status": "DISABLED" }
  }'
```

### Rename a flow

```bash
curl -X POST "$BASE_URL/flows/$FLOW_ID" \
  -H "Content-Type: application/json" \
  -H "x-internal-api-key: $API_KEY" \
  -d '{
    "type": "CHANGE_NAME",
    "request": { "displayName": "Renamed Flow" }
  }'
```

### Delete a flow

```bash
curl -X DELETE "$BASE_URL/flows/$FLOW_ID" \
  -H "x-internal-api-key: $API_KEY"
```

---

## 3. Flow Versions

### List versions for a flow

```bash
curl -X GET "$BASE_URL/flows/$FLOW_ID/versions?limit=10" \
  -H "x-internal-api-key: $API_KEY"
```

---

## 4. Flow Runs

### List runs for a project

```bash
curl -X GET "$BASE_URL/flow-runs?projectId=$PROJECT_ID" \
  -H "x-internal-api-key: $API_KEY"
```

### List runs filtered by flow

```bash
curl -X GET "$BASE_URL/flow-runs?projectId=$PROJECT_ID&flowId=$FLOW_ID" \
  -H "x-internal-api-key: $API_KEY"
```

### List runs filtered by status

```bash
curl -X GET "$BASE_URL/flow-runs?projectId=$PROJECT_ID&status=SUCCEEDED" \
  -H "x-internal-api-key: $API_KEY"
```

### Get a specific run

```bash
RUN_ID="<id from list response>"
curl -X GET "$BASE_URL/flow-runs/$RUN_ID" \
  -H "x-internal-api-key: $API_KEY"
```

---

## 5. Webhooks (trigger a flow)

Webhook endpoints are public — no `x-internal-api-key` needed. The `flowId` in the URL acts as the identifier.

### Trigger a webhook flow

```bash
curl -X POST "$BASE_URL/webhooks/$FLOW_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "order.created",
    "orderId": "12345",
    "customer": { "name": "Alice", "email": "alice@example.com" }
  }'
```

After triggering, poll for the run result:

```bash
curl -X GET "$BASE_URL/flow-runs?projectId=$PROJECT_ID&flowId=$FLOW_ID" \
  -H "x-internal-api-key: $API_KEY"
```

---

## 6. App Connections

### List connections

```bash
curl -X GET "$BASE_URL/app-connections?projectId=$PROJECT_ID" \
  -H "x-internal-api-key: $API_KEY"
```

### Create a SECRET_TEXT connection

```bash
curl -X POST "$BASE_URL/app-connections" \
  -H "Content-Type: application/json" \
  -H "x-internal-api-key: $API_KEY" \
  -d '{
    "projectId": "'$PROJECT_ID'",
    "pieceName": "@activepieces/piece-openai",
    "displayName": "My OpenAI Key",
    "type": "SECRET_TEXT",
    "value": {
      "type": "SECRET_TEXT",
      "secret_text": "sk-your-openai-key"
    }
  }'
```

---

## 7. Pieces

### List available pieces

```bash
curl -X GET "$BASE_URL/pieces?limit=20" \
  -H "x-internal-api-key: $API_KEY"
```

### Search pieces

```bash
curl -X GET "$BASE_URL/pieces?searchQuery=schedule" \
  -H "x-internal-api-key: $API_KEY"
```

---

## Complete End-to-End Script

Run this to create a project, build a webhook flow, publish it, enable it, trigger it, and check the run:

```bash
#!/bin/bash
set -e

BASE_URL="http://localhost:4200/api/v1"
API_KEY="your-secret-key-here"

echo "=== 1. Create project ==="
PROJECT=$(curl -s -X POST "$BASE_URL/projects" \
  -H "Content-Type: application/json" \
  -H "x-internal-api-key: $API_KEY" \
  -d '{"displayName":"E2E Test","externalId":"e2e-test-001"}')
PROJECT_ID=$(echo "$PROJECT" | jq -r '.id')
echo "Project ID: $PROJECT_ID"

echo "=== 2. Create flow ==="
FLOW=$(curl -s -X POST "$BASE_URL/flows" \
  -H "Content-Type: application/json" \
  -H "x-internal-api-key: $API_KEY" \
  -d "{\"projectId\":\"$PROJECT_ID\",\"displayName\":\"Webhook E2E\"}")
FLOW_ID=$(echo "$FLOW" | jq -r '.id')
echo "Flow ID: $FLOW_ID"

echo "=== 3. Set webhook trigger ==="
curl -s -X POST "$BASE_URL/flows/$FLOW_ID" \
  -H "Content-Type: application/json" \
  -H "x-internal-api-key: $API_KEY" \
  -d '{
    "type":"UPDATE_TRIGGER",
    "request":{
      "name":"trigger","displayName":"Catch Webhook","type":"PIECE_TRIGGER","valid":true,
      "settings":{"pieceName":"@activepieces/piece-webhook","pieceVersion":"~0.1.0",
        "triggerName":"catch_webhook","input":{},"inputUiInfo":{},"propertySettings":{},
        "packageType":"REGISTRY","pieceType":"OFFICIAL"}
    }
  }' | jq .

echo "=== 4. Add code action ==="
curl -s -X POST "$BASE_URL/flows/$FLOW_ID" \
  -H "Content-Type: application/json" \
  -H "x-internal-api-key: $API_KEY" \
  -d '{
    "type":"ADD_ACTION",
    "request":{
      "parentStep":"trigger","stepLocationRelativeToParent":"AFTER",
      "action":{"name":"step_1","displayName":"Echo","type":"CODE","valid":true,
        "settings":{"input":{},"sourceCode":{
          "code":"export const code = async (inputs) => { return { received: true, ts: new Date().toISOString() }; }",
          "packageJson":"{}"}}}
    }
  }' | jq .

echo "=== 5. Publish ==="
curl -s -X POST "$BASE_URL/flows/$FLOW_ID" \
  -H "Content-Type: application/json" \
  -H "x-internal-api-key: $API_KEY" \
  -d '{"type":"LOCK_AND_PUBLISH","request":{}}' | jq .

echo "=== 6. Enable ==="
curl -s -X POST "$BASE_URL/flows/$FLOW_ID" \
  -H "Content-Type: application/json" \
  -H "x-internal-api-key: $API_KEY" \
  -d '{"type":"CHANGE_STATUS","request":{"status":"ENABLED"}}' | jq .

echo "=== 7. Trigger webhook ==="
curl -s -X POST "$BASE_URL/webhooks/$FLOW_ID" \
  -H "Content-Type: application/json" \
  -d '{"test":"hello from e2e"}' | jq .

echo "=== 8. Wait and check runs ==="
sleep 5
curl -s -X GET "$BASE_URL/flow-runs?projectId=$PROJECT_ID&flowId=$FLOW_ID" \
  -H "x-internal-api-key: $API_KEY" | jq '.data[0].status'
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `401 Unauthorized` | Missing or wrong `x-internal-api-key` header | Check `AP_INTERNAL_API_KEY` env var matches |
| `400 body/ Invalid input` on `UPDATE_TRIGGER` | Missing `propertySettings: {}` in settings | Add `"propertySettings": {}` to the settings object |
| `400 body/ Invalid input` on `LOCK_AND_PUBLISH` | Missing `request` wrapper | Send `{"type":"LOCK_AND_PUBLISH","request":{}}` |
| `404` on flow operations | Wrong `flowId` or flow was deleted | Verify the flow ID from the create response |
| Flow runs not appearing | Flow not published or not enabled | Run `LOCK_AND_PUBLISH` then `CHANGE_STATUS` with `ENABLED` |
| Webhook returns empty | Flow trigger is not webhook type | Set trigger to `@activepieces/piece-webhook` first |

---

## OpenAPI Spec

A full OpenAPI 3.0 spec is available at [docs/custom/headless-openapi.yaml](headless-openapi.yaml). Import it into Postman, Insomnia, or any OpenAPI-compatible tool for interactive testing.
