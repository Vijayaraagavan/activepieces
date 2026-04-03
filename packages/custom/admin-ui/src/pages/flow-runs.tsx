import { useQuery } from '@tanstack/react-query'
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { JsonViewer } from '../components/json-viewer'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Dialog, DialogHeader, DialogTitle } from '../components/ui/dialog'
import { Input } from '../components/ui/input'
import { Select } from '../components/ui/select'
import { api } from '../lib/api-client'
import type { FlowRun, FlowRunStatus } from '../lib/types'
import { timeAgo } from '../lib/utils'

const statusColors: Record<string, 'success' | 'destructive' | 'secondary' | 'default' | 'outline'> = {
  QUEUED: 'outline',
  RUNNING: 'default',
  SUCCEEDED: 'success',
  FAILED: 'destructive',
  PAUSED: 'outline',
  TIMEOUT: 'destructive',
  INTERNAL_ERROR: 'destructive',
  STOPPED: 'secondary',
  QUOTA_EXCEEDED: 'destructive',
  MEMORY_LIMIT_EXCEEDED: 'destructive',
  CANCELED: 'secondary',
  LOG_SIZE_EXCEEDED: 'destructive',
}

export function FlowRunsPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [flowFilter, setFlowFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['flow-runs', projectId, flowFilter, statusFilter],
    queryFn: () =>
      api.flowRuns.list({
        projectId: projectId!,
        flowId: flowFilter || undefined,
        status: statusFilter || undefined,
        limit: 50,
      }),
    enabled: !!projectId,
    refetchInterval: autoRefresh ? 3000 : false,
  })

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Flow Runs</h1>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto-refresh
          </label>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="mr-1 h-3 w-3" /> Refresh
          </Button>
        </div>
      </div>

      <div className="mb-4 flex gap-2">
        <Input
          placeholder="Filter by Flow ID..."
          value={flowFilter}
          onChange={(e) => setFlowFilter(e.target.value)}
          className="max-w-xs"
        />
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="max-w-[180px]"
        >
          <option value="">All Statuses</option>
          {['QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'PAUSED', 'TIMEOUT', 'INTERNAL_ERROR', 'STOPPED', 'CANCELED', 'QUOTA_EXCEEDED', 'MEMORY_LIMIT_EXCEEDED', 'LOG_SIZE_EXCEEDED'].map(
            (s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ),
          )}
        </Select>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
      {error && <p className="text-sm text-red-600">{(error as Error).message}</p>}

      {data && (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-2 text-left font-medium">Flow</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="px-4 py-2 text-left font-medium">Duration</th>
                <th className="px-4 py-2 text-left font-medium">Started</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((r) => (
                <tr
                  key={r.id}
                  className="cursor-pointer border-b transition-colors hover:bg-muted/30"
                  onClick={() => setSelectedRunId(r.id)}
                >
                  <td className="px-4 py-2 font-medium">{r.displayName ?? r.flowVersion?.displayName ?? r.flowId}</td>
                  <td className="px-4 py-2">
                    <Badge variant={statusColors[r.status] ?? 'secondary'}>
                      {r.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {r.duration ? `${(r.duration / 1000).toFixed(1)}s` : '—'}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{timeAgo(r.created)}</td>
                </tr>
              ))}
              {data.data.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    No runs found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Dialog
        open={!!selectedRunId}
        onClose={() => setSelectedRunId(null)}
        className="max-w-4xl"
      >
        <DialogHeader>
          <DialogTitle>
            Run Detail
          </DialogTitle>
        </DialogHeader>
        {selectedRunId && (
          <RunDetailPanel
            runId={selectedRunId}
            onClose={() => setSelectedRunId(null)}
          />
        )}
      </Dialog>
    </div>
  )
}

function RunDetailPanel({ runId }: { runId: string; onClose: () => void }) {
  const { data: run, isLoading, error } = useQuery({
    queryKey: ['flow-run-detail', runId],
    queryFn: () => api.flowRuns.get(runId),
    staleTime: 10_000,
  })

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-6">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm text-muted-foreground">Loading step outputs...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 text-sm text-red-600">{(error as Error).message}</div>
    )
  }

  if (!run) return null

  const steps = (run.steps ?? {}) as Record<string, StepOutputData>
  const stepOrder = deriveStepOrder(steps)

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-3">
        <Badge variant={statusColors[run.status] ?? 'secondary'} className="text-xs">
          {run.status}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {run.startTime ? new Date(run.startTime).toLocaleString() : 'Not started'}
          {run.finishTime && run.startTime && (
            <> &middot; {((new Date(run.finishTime).getTime() - new Date(run.startTime).getTime()) / 1000).toFixed(2)}s</>
          )}
        </span>
        <span className="text-xs font-mono text-muted-foreground">{run.id}</span>
      </div>

      {stepOrder.length === 0 ? (
        <div className="rounded-md border p-4">
          <p className="text-sm text-muted-foreground">
            No step execution data available. The run may still be queued or logs have been purged.
          </p>
          <JsonViewer data={run} title="Raw Run Data" maxHeight="300px" />
        </div>
      ) : (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground mb-2">
            Step Execution Timeline ({stepOrder.length} steps)
          </p>
          {stepOrder.map((stepName) => (
            <StepOutputCard
              key={stepName}
              stepName={stepName}
              stepData={steps[stepName]}
            />
          ))}
        </div>
      )}

      <details>
        <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
          Raw run JSON
        </summary>
        <div className="mt-2">
          <JsonViewer data={run} maxHeight="300px" />
        </div>
      </details>
    </div>
  )
}

interface StepOutputData {
  type: string
  status: string
  input?: unknown
  output?: unknown
  duration?: number
  errorMessage?: unknown
}

function deriveStepOrder(steps: Record<string, StepOutputData>): string[] {
  const names = Object.keys(steps)
  return names.sort((a, b) => {
    if (a === 'trigger') return -1
    if (b === 'trigger') return 1
    const numA = parseInt(a.replace('step_', ''), 10)
    const numB = parseInt(b.replace('step_', ''), 10)
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB
    return a.localeCompare(b)
  })
}

function StepOutputCard({
  stepName,
  stepData,
}: {
  stepName: string
  stepData: StepOutputData
}) {
  const [expanded, setExpanded] = useState(stepData.status === 'FAILED')
  const [showInput, setShowInput] = useState(false)
  const [copiedPath, setCopiedPath] = useState<string | null>(null)

  const isSuccess = stepData.status === 'SUCCEEDED'
  const isFailed = stepData.status === 'FAILED'

  const outputPaths = useMemo(
    () => (stepData.output != null ? flattenPaths(stepData.output, stepName) : []),
    [stepData.output, stepName],
  )

  const copyVariable = useCallback((path: string) => {
    const expr = `{{${path}}}`
    navigator.clipboard.writeText(expr)
    setCopiedPath(path)
    setTimeout(() => setCopiedPath(null), 1500)
  }, [])

  return (
    <div className={`rounded-md border ${isFailed ? 'border-red-300 bg-red-50/50' : ''}`}>
      <button
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted/30"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}

        {isSuccess ? (
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
        ) : isFailed ? (
          <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-500" />
        ) : (
          <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}

        <span className="flex-1 text-sm font-medium font-mono">{stepName}</span>

        <Badge variant="outline" className="text-[10px]">
          {stepData.type}
        </Badge>
        <Badge
          variant={isSuccess ? 'success' : isFailed ? 'destructive' : 'secondary'}
          className="text-[10px]"
        >
          {stepData.status}
        </Badge>
        {stepData.duration != null && (
          <span className="text-[10px] text-muted-foreground">
            {(stepData.duration / 1000).toFixed(2)}s
          </span>
        )}
      </button>

      {expanded && (
        <div className="border-t px-3 py-3 space-y-3">
          {isFailed && stepData.errorMessage != null && (
            <div className="rounded-md bg-red-100 p-2 text-xs text-red-800 font-mono whitespace-pre-wrap">
              {typeof stepData.errorMessage === 'string'
                ? stepData.errorMessage
                : JSON.stringify(stepData.errorMessage, null, 2)}
            </div>
          )}

          {stepData.input != null && (
            <div>
              <button
                className="text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1"
                onClick={() => setShowInput(!showInput)}
              >
                {showInput ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                Input
              </button>
              {showInput && (
                <div className="mt-1">
                  <JsonViewer data={stepData.input} maxHeight="200px" />
                </div>
              )}
            </div>
          )}

          {stepData.output != null && (
            <div>
              <p className="text-xs font-medium mb-1">Output</p>
              <div className="rounded-md border bg-muted/20 p-2">
                <div className="mb-2">
                  <JsonViewer data={stepData.output} maxHeight="250px" />
                </div>

                {outputPaths.length > 0 && (
                  <div className="border-t pt-2">
                    <p className="text-[10px] font-medium text-muted-foreground mb-1">
                      Variable References (click to copy)
                    </p>
                    <div className="max-h-48 overflow-auto space-y-0.5">
                      {outputPaths.map((p) => (
                        <div
                          key={p.path}
                          className="flex items-center gap-1 group"
                        >
                          <button
                            className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-mono transition-colors ${
                              copiedPath === p.path
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                            }`}
                            onClick={() => copyVariable(p.path)}
                            title={`Copy {{${p.path}}}`}
                          >
                            <Copy className="h-2.5 w-2.5" />
                            {`{{${p.path}}}`}
                          </button>
                          <span className="text-[10px] text-muted-foreground truncate max-w-[300px]">
                            = {p.preview}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {stepData.output == null && !isFailed && (
            <p className="text-xs text-muted-foreground">No output data.</p>
          )}
        </div>
      )}
    </div>
  )
}

interface PathEntry {
  path: string
  preview: string
}

function flattenPaths(
  value: unknown,
  prefix: string,
  maxDepth = 4,
  maxEntries = 50,
): PathEntry[] {
  const results: PathEntry[] = []

  function walk(val: unknown, path: string, depth: number) {
    if (results.length >= maxEntries) return
    if (depth > maxDepth) return

    if (val === null || val === undefined) {
      results.push({ path, preview: String(val) })
      return
    }

    if (Array.isArray(val)) {
      results.push({ path, preview: `Array(${val.length})` })
      val.slice(0, 5).forEach((item, i) => {
        walk(item, `${path}[${i}]`, depth + 1)
      })
      if (val.length > 5) {
        results.push({ path: `${path}[...]`, preview: `...${val.length - 5} more items` })
      }
      return
    }

    if (typeof val === 'object') {
      const keys = Object.keys(val as Record<string, unknown>)
      results.push({ path, preview: `Object(${keys.length} keys)` })
      for (const key of keys) {
        if (results.length >= maxEntries) break
        const childPath = /^[a-zA-Z_]\w*$/.test(key)
          ? `${path}.${key}`
          : `${path}["${key}"]`
        walk((val as Record<string, unknown>)[key], childPath, depth + 1)
      }
      return
    }

    const str = String(val)
    results.push({ path, preview: str.length > 80 ? str.slice(0, 80) + '...' : str })
  }

  walk(value, prefix, 0)
  return results
}
