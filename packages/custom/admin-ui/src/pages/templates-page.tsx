import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { JsonViewer } from '../components/json-viewer'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Textarea } from '../components/ui/textarea'
import { api } from '../lib/api-client'
import { templates } from '../lib/templates'

export function TemplatesPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showCustom, setShowCustom] = useState(false)
  const [customJson, setCustomJson] = useState('')
  const [flowName, setFlowName] = useState('')
  const [error, setError] = useState('')

  const createAndImport = useMutation({
    mutationFn: async (template: Record<string, unknown>) => {
      const flow = await api.flows.create({
        projectId: projectId!,
        displayName: (template as { displayName?: string }).displayName || 'Imported Flow',
      })
      await api.flows.update(flow.id, { type: 'IMPORT_FLOW', request: template })
      return flow
    },
    onSuccess: (flow) => {
      queryClient.invalidateQueries({ queryKey: ['flows', projectId] })
      navigate(`/projects/${projectId}/flows/${flow.id}`)
    },
    onError: (e) => setError((e as Error).message),
  })

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Flow Templates</h1>
        <Button variant="outline" onClick={() => setShowCustom(!showCustom)}>
          {showCustom ? 'Hide Custom Import' : 'Import Custom JSON'}
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-2 text-sm text-red-700">{error}</div>
      )}

      {showCustom && (
        <div className="mb-6 rounded-md border p-4">
          <h3 className="mb-2 text-sm font-semibold">Import Custom Flow JSON</h3>
          <div className="mb-2">
            <label className="mb-1 block text-xs font-medium">Flow Name</label>
            <Input
              value={flowName}
              onChange={(e) => setFlowName(e.target.value)}
              placeholder="My Custom Flow"
            />
          </div>
          <Textarea
            value={customJson}
            onChange={(e) => setCustomJson(e.target.value)}
            rows={12}
            className="mb-2 font-mono text-xs"
            placeholder='{ "displayName": "...", "trigger": { ... }, "schemaVersion": "18", "notes": null }'
          />
          <Button
            disabled={createAndImport.isPending}
            onClick={() => {
              setError('')
              try {
                const parsed = JSON.parse(customJson)
                if (flowName) parsed.displayName = flowName
                createAndImport.mutate(parsed)
              } catch {
                setError('Invalid JSON')
              }
            }}
          >
            {createAndImport.isPending ? 'Importing...' : 'Create & Import'}
          </Button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {templates.map((t) => (
          <div key={t.name} className="rounded-md border p-4">
            <div className="mb-2 flex items-start justify-between">
              <div>
                <h3 className="text-sm font-semibold">{t.name}</h3>
                <p className="text-xs text-muted-foreground">{t.description}</p>
              </div>
              {t.name.includes('OAuth') && (
                <Badge variant="outline">OAuth2</Badge>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={createAndImport.isPending}
                onClick={() => createAndImport.mutate(t.template as unknown as Record<string, unknown>)}
              >
                Deploy
              </Button>
              <JsonViewer
                data={t.template}
                title={`${t.name} JSON`}
                maxHeight="300px"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
