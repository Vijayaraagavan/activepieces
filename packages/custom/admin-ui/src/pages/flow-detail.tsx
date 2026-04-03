import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Globe, Play, Rocket, Send } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { JsonViewer } from '../components/json-viewer'
import { VisualFlowBuilder } from '../components/visual-flow-builder'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Select } from '../components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Textarea } from '../components/ui/textarea'
import { api } from '../lib/api-client'
import { prepareTemplate, templates } from '../lib/templates'

export function FlowDetailPage() {
  const { projectId, flowId } = useParams<{ projectId: string; flowId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: flow, isLoading } = useQuery({
    queryKey: ['flow', flowId],
    queryFn: () => api.flows.get(flowId!),
    enabled: !!flowId,
  })

  const { data: versions } = useQuery({
    queryKey: ['flow-versions', flowId],
    queryFn: () => api.flows.listVersions(flowId!, { limit: 20 }),
    enabled: !!flowId,
  })

  const updateMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.flows.update(flowId!, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flow', flowId] })
      queryClient.invalidateQueries({ queryKey: ['flow-versions', flowId] })
    },
  })

  const testRunMutation = useMutation({
    mutationFn: () =>
      api.flowRuns.test({ projectId: projectId!, flowVersionId: flow!.version.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flow-runs'] })
    },
  })

  if (isLoading) return <p className="p-6 text-sm text-muted-foreground">Loading...</p>
  if (!flow) return <p className="p-6 text-sm text-red-600">Flow not found</p>

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center gap-3">
        <Link
          to={`/projects/${projectId}/flows`}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{flow.version.displayName}</h1>
          <p className="text-xs text-muted-foreground">
            {flow.id} &middot; {flow.version.state}
          </p>
        </div>
        <Badge variant={flow.status === 'ENABLED' ? 'success' : 'secondary'}>
          {flow.status}
        </Badge>
        <Button
          variant="outline"
          size="sm"
          disabled={testRunMutation.isPending}
          onClick={() => testRunMutation.mutate()}
        >
          <Play className="mr-1 h-3 w-3" />
          {testRunMutation.isPending ? 'Running...' : 'Run Now'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(`/projects/${projectId}/flows/${flowId}/webhook`)}
        >
          <Globe className="mr-1 h-3 w-3" /> Webhook Test
        </Button>
      </div>

      {testRunMutation.isSuccess && (
        <div className="mb-3 rounded-md bg-blue-50 p-2 text-xs text-blue-700">
          Test run started: {testRunMutation.data.id}{' '}
          <Link
            to={`/projects/${projectId}/runs`}
            className="underline"
          >
            View Runs
          </Link>
        </div>
      )}
      {testRunMutation.isError && (
        <div className="mb-3 rounded-md bg-red-50 p-2 text-xs text-red-700">
          Run failed: {(testRunMutation.error as Error).message}
        </div>
      )}

      {updateMutation.isError && (
        <div className="mb-3 rounded-md bg-red-50 p-2 text-xs text-red-700">
          {(updateMutation.error as Error).message}
        </div>
      )}
      {updateMutation.isSuccess && (
        <div className="mb-3 rounded-md bg-emerald-50 p-2 text-xs text-emerald-700">
          Operation applied successfully
        </div>
      )}

      <Tabs defaultValue="builder">
        <TabsList>
          <TabsTrigger value="builder">Visual Builder</TabsTrigger>
          <TabsTrigger value="version">JSON View</TabsTrigger>
          <TabsTrigger value="operations">Operations</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="history">
            Versions ({versions?.data.length ?? 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="builder">
          <VisualFlowBuilder
            flowVersion={flow.version}
            flowDisplayName={flow.version.displayName}
            projectId={projectId!}
            onApply={(body) => updateMutation.mutate(body)}
            isPending={updateMutation.isPending}
          />
        </TabsContent>

        <TabsContent value="version">
          <JsonViewer data={flow.version} title="Flow Version JSON" maxHeight="600px" />
        </TabsContent>

        <TabsContent value="operations">
          <OperationsPanel
            flowId={flowId!}
            onApply={(body) => updateMutation.mutate(body)}
            isPending={updateMutation.isPending}
          />
        </TabsContent>

        <TabsContent value="templates">
          <TemplatesList
            onApply={(body) => updateMutation.mutate(body)}
            isPending={updateMutation.isPending}
          />
        </TabsContent>

        <TabsContent value="history">
          {versions?.data.map((v) => (
            <div key={v.id} className="mb-2 rounded-md border p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{v.displayName}</span>
                <Badge variant={v.state === 'LOCKED' ? 'default' : 'outline'}>
                  {v.state}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {v.id} &middot; {new Date(v.created).toLocaleString()}
              </p>
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function OperationsPanel({
  flowId,
  onApply,
  isPending,
}: {
  flowId: string
  onApply: (body: Record<string, unknown>) => void
  isPending: boolean
}) {
  const [opType, setOpType] = useState('CHANGE_STATUS')
  const [rawJson, setRawJson] = useState('{}')

  const presets: Record<string, { label: string; body: Record<string, unknown> }> = {
    CHANGE_STATUS_ENABLE: {
      label: 'Enable Flow',
      body: { type: 'CHANGE_STATUS', request: { status: 'ENABLED' } },
    },
    CHANGE_STATUS_DISABLE: {
      label: 'Disable Flow',
      body: { type: 'CHANGE_STATUS', request: { status: 'DISABLED' } },
    },
    LOCK_AND_PUBLISH: {
      label: 'Lock & Publish',
      body: { type: 'LOCK_AND_PUBLISH', request: {} },
    },
    WEBHOOK_TRIGGER: {
      label: 'Set Webhook Trigger',
      body: {
        type: 'UPDATE_TRIGGER',
        request: {
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
        },
      },
    },
    SCHEDULE_TRIGGER: {
      label: 'Set Schedule Trigger (5 min)',
      body: {
        type: 'UPDATE_TRIGGER',
        request: {
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
        },
      },
    },
    ADD_CODE_ACTION: {
      label: 'Add Code Action',
      body: {
        type: 'ADD_ACTION',
        request: {
          parentStep: 'trigger',
          stepLocationRelativeToParent: 'AFTER',
          action: {
            name: 'step_1',
            displayName: 'Run Code',
            type: 'CODE',
            valid: true,
            settings: {
              input: {},
              sourceCode: {
                code: 'export const code = async (inputs) => {\n  return { message: "Hello!", ts: new Date().toISOString() };\n};',
                packageJson: '{}',
              },
            },
          },
        },
      },
    },
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {Object.entries(presets).map(([key, p]) => (
          <Button
            key={key}
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => onApply(p.body)}
            className="justify-start"
          >
            {key.includes('PUBLISH') && <Rocket className="mr-1 h-3 w-3" />}
            {key.includes('TRIGGER') && <Send className="mr-1 h-3 w-3" />}
            {p.label}
          </Button>
        ))}
      </div>

      <div className="border-t pt-4">
        <h3 className="mb-2 text-sm font-medium">Custom Operation</h3>
        <Select
          value={opType}
          onChange={(e) => {
            setOpType(e.target.value)
            setRawJson('{}')
          }}
          className="mb-2"
        >
          {[
            'UPDATE_TRIGGER',
            'ADD_ACTION',
            'UPDATE_ACTION',
            'DELETE_ACTION',
            'LOCK_AND_PUBLISH',
            'CHANGE_STATUS',
            'CHANGE_NAME',
            'IMPORT_FLOW',
            'CHANGE_FOLDER',
            'MOVE_ACTION',
            'DUPLICATE_ACTION',
          ].map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
        <Textarea
          value={rawJson}
          onChange={(e) => setRawJson(e.target.value)}
          rows={10}
          className="font-mono text-xs"
          placeholder='{"request": { ... }}'
        />
        <Button
          className="mt-2"
          disabled={isPending}
          onClick={() => {
            try {
              const parsed = JSON.parse(rawJson)
              onApply({ type: opType, ...parsed })
            } catch {
              alert('Invalid JSON')
            }
          }}
        >
          Apply Operation
        </Button>
      </div>
    </div>
  )
}

function TemplatesList({
  onApply,
  isPending,
}: {
  onApply: (body: Record<string, unknown>) => void
  isPending: boolean
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {templates.map((t) => (
        <div key={t.name} className="rounded-md border p-4">
          <h3 className="text-sm font-semibold">{t.name}</h3>
          <p className="mb-3 text-xs text-muted-foreground">{t.description}</p>
          <Button
            size="sm"
            disabled={isPending}
            onClick={() =>
              onApply({
                type: 'IMPORT_FLOW',
                request: prepareTemplate(t.template),
              })
            }
          >
            Apply Template
          </Button>
        </div>
      ))}
    </div>
  )
}
