import type { FlowAction, FlowTrigger, ImportFlowRequest } from '../types'

export interface FlowTemplate {
  name: string
  description: string
  template: ImportFlowRequest
}

function stampAction(action: FlowAction | undefined): FlowAction | undefined {
  if (!action) return undefined
  const now = new Date().toISOString()
  const stamped = { ...action, lastUpdatedDate: action.lastUpdatedDate ?? now }
  if (stamped.type === 'CODE' || stamped.type === 'PIECE') {
    stamped.settings = { ...stamped.settings, errorHandlingOptions: stamped.settings.errorHandlingOptions ?? {} } as typeof stamped.settings
  }
  if ('nextAction' in stamped) {
    stamped.nextAction = stampAction(stamped.nextAction)
  }
  return stamped
}

function stampTrigger(trigger: FlowTrigger): FlowTrigger {
  const now = new Date().toISOString()
  return {
    ...trigger,
    lastUpdatedDate: trigger.lastUpdatedDate ?? now,
    nextAction: stampAction(trigger.nextAction),
  }
}

export function prepareTemplate(template: ImportFlowRequest): ImportFlowRequest {
  return {
    ...template,
    trigger: stampTrigger(template.trigger),
  }
}

export const templates: FlowTemplate[] = [
  {
    name: 'Webhook + Code',
    description: 'Catch a webhook and process the payload with custom code. Great for testing.',
    template: {
      displayName: 'Webhook + Code',
      schemaVersion: '18',
      notes: null,
      trigger: {
        name: 'trigger',
        displayName: 'Catch Webhook',
        type: 'PIECE_TRIGGER',
        valid: true,
        settings: {
          pieceName: '@activepieces/piece-webhook',
          pieceVersion: '~0.1.0',
          triggerName: 'catch_webhook',
          input: {},
          inputUiInfo: {},
          propertySettings: {},
          packageType: 'REGISTRY',
          pieceType: 'OFFICIAL',
        },
        nextAction: {
          name: 'step_1',
          displayName: 'Process Payload',
          type: 'CODE',
          valid: true,
          settings: {
            input: {},
            sourceCode: {
              code: `export const code = async (inputs) => {
  return {
    received: true,
    timestamp: new Date().toISOString(),
    message: "Webhook processed successfully"
  };
};`,
              packageJson: '{}',
            },
          },
        },
      },
    },
  },
  {
    name: 'Schedule + HTTP Request',
    description: 'Run an HTTP GET request every 5 minutes on a schedule.',
    template: {
      displayName: 'Schedule + HTTP Request',
      schemaVersion: '18',
      notes: null,
      trigger: {
        name: 'trigger',
        displayName: 'Every 5 Minutes',
        type: 'PIECE_TRIGGER',
        valid: true,
        settings: {
          pieceName: '@activepieces/piece-schedule',
          pieceVersion: '~0.2.0',
          triggerName: 'every_x_minutes',
          input: { minutes: 5 },
          inputUiInfo: {},
          propertySettings: {},
          packageType: 'REGISTRY',
          pieceType: 'OFFICIAL',
        },
        nextAction: {
          name: 'step_1',
          displayName: 'HTTP GET',
          type: 'PIECE',
          valid: true,
          settings: {
            pieceName: '@activepieces/piece-http',
            pieceVersion: '~0.4.0',
            actionName: 'send_request',
            input: {
              method: 'GET',
              url: 'https://httpbin.org/get',
              headers: {},
              body_type: 'none',
              body: {},
            },
            inputUiInfo: {},
            propertySettings: {},
            packageType: 'REGISTRY',
            pieceType: 'OFFICIAL',
          },
        },
      },
    },
  },
  {
    name: 'Webhook + HTTP + Code',
    description: 'Catch a webhook, call an external API, then transform the result with code.',
    template: {
      displayName: 'Webhook + HTTP + Code',
      schemaVersion: '18',
      notes: null,
      trigger: {
        name: 'trigger',
        displayName: 'Catch Webhook',
        type: 'PIECE_TRIGGER',
        valid: true,
        settings: {
          pieceName: '@activepieces/piece-webhook',
          pieceVersion: '~0.1.0',
          triggerName: 'catch_webhook',
          input: {},
          inputUiInfo: {},
          propertySettings: {},
          packageType: 'REGISTRY',
          pieceType: 'OFFICIAL',
        },
        nextAction: {
          name: 'step_1',
          displayName: 'Call External API',
          type: 'PIECE',
          valid: true,
          settings: {
            pieceName: '@activepieces/piece-http',
            pieceVersion: '~0.4.0',
            actionName: 'send_request',
            input: {
              method: 'GET',
              url: 'https://httpbin.org/get',
              headers: {},
              body_type: 'none',
              body: {},
            },
            inputUiInfo: {},
            propertySettings: {},
            packageType: 'REGISTRY',
            pieceType: 'OFFICIAL',
          },
          nextAction: {
            name: 'step_2',
            displayName: 'Transform Result',
            type: 'CODE',
            valid: true,
            settings: {
              input: {},
              sourceCode: {
                code: `export const code = async (inputs) => {
  return {
    transformed: true,
    timestamp: new Date().toISOString()
  };
};`,
                packageJson: '{}',
              },
            },
          },
        },
      },
    },
  },
  {
    name: 'Schedule + Code Logger',
    description: 'Run custom code every 10 minutes. Useful for periodic health checks or data sync.',
    template: {
      displayName: 'Schedule + Code Logger',
      schemaVersion: '18',
      notes: null,
      trigger: {
        name: 'trigger',
        displayName: 'Every 10 Minutes',
        type: 'PIECE_TRIGGER',
        valid: true,
        settings: {
          pieceName: '@activepieces/piece-schedule',
          pieceVersion: '~0.2.0',
          triggerName: 'every_x_minutes',
          input: { minutes: 10 },
          inputUiInfo: {},
          propertySettings: {},
          packageType: 'REGISTRY',
          pieceType: 'OFFICIAL',
        },
        nextAction: {
          name: 'step_1',
          displayName: 'Log Check',
          type: 'CODE',
          valid: true,
          settings: {
            input: {},
            sourceCode: {
              code: `export const code = async (inputs) => {
  console.log("Health check at", new Date().toISOString());
  return { status: "ok", checked_at: new Date().toISOString() };
};`,
              packageJson: '{}',
            },
          },
        },
      },
    },
  },
  {
    name: 'Webhook + Router (Branching)',
    description: 'Catch a webhook and route to different code actions based on conditions.',
    template: {
      displayName: 'Webhook + Router',
      schemaVersion: '18',
      notes: null,
      trigger: {
        name: 'trigger',
        displayName: 'Catch Webhook',
        type: 'PIECE_TRIGGER',
        valid: true,
        settings: {
          pieceName: '@activepieces/piece-webhook',
          pieceVersion: '~0.1.0',
          triggerName: 'catch_webhook',
          input: {},
          inputUiInfo: {},
          propertySettings: {},
          packageType: 'REGISTRY',
          pieceType: 'OFFICIAL',
        },
        nextAction: {
          name: 'step_1',
          displayName: 'Router',
          type: 'ROUTER' as 'CODE',
          valid: true,
          settings: {
            branches: [
              {
                branchName: 'Branch A',
                branchType: 'CONDITION',
                conditions: [[{ operator: 'TEXT_CONTAINS', firstValue: '{{trigger.body.type}}', secondValue: 'typeA', caseSensitive: false }]],
              },
              {
                branchName: 'Fallback',
                branchType: 'FALLBACK',
              },
            ],
            executionType: 'EXECUTE_FIRST_MATCH',
          } as unknown as { input: Record<string, unknown>; sourceCode: { code: string; packageJson: string } },
          children: [
            {
              name: 'step_2',
              displayName: 'Handle Type A',
              type: 'CODE',
              valid: true,
              settings: {
                input: {},
                sourceCode: {
                  code: 'export const code = async (inputs) => { return { branch: "A" }; };',
                  packageJson: '{}',
                },
              },
            },
            {
              name: 'step_3',
              displayName: 'Handle Fallback',
              type: 'CODE',
              valid: true,
              settings: {
                input: {},
                sourceCode: {
                  code: 'export const code = async (inputs) => { return { branch: "fallback" }; };',
                  packageJson: '{}',
                },
              },
            },
          ],
        } as unknown as import('../types').CodeAction,
      },
    },
  },
  {
    name: 'Google Sheets (OAuth2)',
    description: 'Webhook trigger that appends a row to Google Sheets. Requires OAuth2 connection for @activepieces/piece-google-sheets.',
    template: {
      displayName: 'Webhook to Google Sheets',
      schemaVersion: '18',
      notes: null,
      trigger: {
        name: 'trigger',
        displayName: 'Catch Webhook',
        type: 'PIECE_TRIGGER',
        valid: true,
        settings: {
          pieceName: '@activepieces/piece-webhook',
          pieceVersion: '~0.1.0',
          triggerName: 'catch_webhook',
          input: {},
          inputUiInfo: {},
          propertySettings: {},
          packageType: 'REGISTRY',
          pieceType: 'OFFICIAL',
        },
        nextAction: {
          name: 'step_1',
          displayName: 'Append Row to Sheet',
          type: 'PIECE',
          valid: false,
          settings: {
            pieceName: '@activepieces/piece-google-sheets',
            pieceVersion: '~0.4.0',
            actionName: 'insert_row',
            input: {
              spreadsheet_id: '{{SPREADSHEET_ID}}',
              sheet_id: '{{SHEET_ID}}',
              values: { col_a: '{{trigger.body.name}}', col_b: '{{trigger.body.email}}' },
            },
            inputUiInfo: {},
            propertySettings: {},
            packageType: 'REGISTRY',
            pieceType: 'OFFICIAL',
          },
        },
      },
    },
  },
  {
    name: 'Slack Message (OAuth2)',
    description: 'Schedule trigger that sends a Slack message every hour. Requires OAuth2 connection for @activepieces/piece-slack.',
    template: {
      displayName: 'Hourly Slack Message',
      schemaVersion: '18',
      notes: null,
      trigger: {
        name: 'trigger',
        displayName: 'Every Hour',
        type: 'PIECE_TRIGGER',
        valid: true,
        settings: {
          pieceName: '@activepieces/piece-schedule',
          pieceVersion: '~0.2.0',
          triggerName: 'every_x_minutes',
          input: { minutes: 60 },
          inputUiInfo: {},
          propertySettings: {},
          packageType: 'REGISTRY',
          pieceType: 'OFFICIAL',
        },
        nextAction: {
          name: 'step_1',
          displayName: 'Send Slack Message',
          type: 'PIECE',
          valid: false,
          settings: {
            pieceName: '@activepieces/piece-slack',
            pieceVersion: '~0.5.0',
            actionName: 'send_channel_message',
            input: {
              channel: '{{CHANNEL_ID}}',
              text: 'Hourly check-in from Activepieces at ' + new Date().toISOString(),
            },
            inputUiInfo: {},
            propertySettings: {},
            packageType: 'REGISTRY',
            pieceType: 'OFFICIAL',
          },
        },
      },
    },
  },
  {
    name: 'Notion Database Item (OAuth2)',
    description: 'Webhook trigger → code transform → create Notion DB item. The code step always succeeds so test runs produce visible output even without a Notion connection.',
    template: {
      displayName: 'Webhook to Notion Database',
      schemaVersion: '18',
      notes: null,
      trigger: {
        name: 'trigger',
        displayName: 'Catch Webhook',
        type: 'PIECE_TRIGGER',
        valid: true,
        settings: {
          pieceName: '@activepieces/piece-webhook',
          pieceVersion: '~0.1.0',
          triggerName: 'catch_webhook',
          input: {},
          inputUiInfo: {},
          propertySettings: {},
          packageType: 'REGISTRY',
          pieceType: 'OFFICIAL',
        },
        nextAction: {
          name: 'step_1',
          displayName: 'Prepare Notion Payload',
          type: 'CODE',
          valid: true,
          settings: {
            input: {},
            sourceCode: {
              code: `export const code = async (inputs) => {
  const body = inputs?.trigger?.body ?? {};
  return {
    title: body.title ?? "Untitled",
    properties: {
      Name: body.name ?? "Unknown",
      Status: body.status ?? "New",
    },
    prepared_at: new Date().toISOString(),
    message: "Payload ready for Notion — flow executed successfully",
  };
};`,
              packageJson: '{}',
            },
          },
          nextAction: {
            name: 'step_2',
            displayName: 'Create Notion Database Item',
            type: 'PIECE',
            valid: false,
            settings: {
              pieceName: '@activepieces/piece-notion',
              pieceVersion: '~0.6.0',
              actionName: 'create_database_item',
              input: {
                database_id: '{{NOTION_DATABASE_ID}}',
                title: '{{step_1.title}}',
                properties: {
                  Name: '{{step_1.properties.Name}}',
                  Status: '{{step_1.properties.Status}}',
                },
              },
              inputUiInfo: {},
              propertySettings: {},
              packageType: 'REGISTRY',
              pieceType: 'OFFICIAL',
            },
          },
        },
      },
    },
  },
]
