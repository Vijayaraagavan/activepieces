import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Send } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { JsonViewer } from '../components/json-viewer'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Textarea } from '../components/ui/textarea'
import { api } from '../lib/api-client'

export function WebhookTesterPage() {
  const { projectId, flowId } = useParams<{ projectId: string; flowId: string }>()
  const [payload, setPayload] = useState('{\n  "event": "test",\n  "data": {}\n}')
  const [response, setResponse] = useState<{ status: number; body: string } | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [pollRuns, setPollRuns] = useState(false)

  const { data: runs } = useQuery({
    queryKey: ['webhook-runs', projectId, flowId],
    queryFn: () =>
      api.flowRuns.list({ projectId: projectId!, flowId: flowId!, limit: 5 }),
    enabled: pollRuns,
    refetchInterval: 2000,
  })

  async function send() {
    setError('')
    setResponse(null)
    setSending(true)
    try {
      const parsed = JSON.parse(payload)
      const res = await api.webhooks.trigger(flowId!, parsed)
      const body = await res.text()
      setResponse({ status: res.status, body })
      setPollRuns(true)
      setTimeout(() => setPollRuns(false), 15000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center gap-3">
        <Link
          to={`/projects/${projectId}/flows/${flowId}`}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold">Webhook Tester</h1>
      </div>

      <div className="mb-4 rounded-md border bg-muted/30 p-3 text-xs">
        <span className="font-medium">Endpoint: </span>
        <code>POST /api/v1/webhooks/{flowId}</code>
      </div>

      <div className="mb-4">
        <label className="mb-1 block text-sm font-medium">Payload (JSON)</label>
        <Textarea
          value={payload}
          onChange={(e) => setPayload(e.target.value)}
          rows={8}
          className="font-mono text-xs"
        />
      </div>

      <div className="mb-4 flex items-center gap-2">
        <Button onClick={send} disabled={sending}>
          <Send className="mr-1 h-4 w-4" />
          {sending ? 'Sending...' : 'Send Webhook'}
        </Button>
      </div>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      {response && (
        <div className="mb-4">
          <h3 className="mb-1 text-sm font-medium">
            Response{' '}
            <Badge variant={response.status < 400 ? 'success' : 'destructive'}>
              {response.status}
            </Badge>
          </h3>
          <pre className="max-h-48 overflow-auto rounded-md border bg-muted/50 p-3 text-xs">
            {response.body || '(empty)'}
          </pre>
        </div>
      )}

      {runs && runs.data.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium">Recent Runs</h3>
          {runs.data.map((r) => (
            <div key={r.id} className="mb-1 rounded-md border p-2">
              <div className="flex items-center gap-2 text-xs">
                <Badge
                  variant={
                    r.status === 'SUCCEEDED'
                      ? 'success'
                      : r.status === 'FAILED'
                        ? 'destructive'
                        : 'default'
                  }
                >
                  {r.status}
                </Badge>
                <span className="text-muted-foreground">
                  {r.duration ? `${(r.duration / 1000).toFixed(1)}s` : 'running...'}
                </span>
                <span className="text-muted-foreground">
                  {new Date(r.created).toLocaleTimeString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
