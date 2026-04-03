import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pause, Play, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Dialog, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog'
import { Input } from '../components/ui/input'
import { api } from '../lib/api-client'
import { timeAgo } from '../lib/utils'

export function FlowsPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')

  const { data, isLoading, error } = useQuery({
    queryKey: ['flows', projectId],
    queryFn: () => api.flows.list({ projectId: projectId!, limit: 50 }),
    enabled: !!projectId,
  })

  const createMutation = useMutation({
    mutationFn: () => api.flows.create({ projectId: projectId!, displayName: name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flows', projectId] })
      setShowCreate(false)
      setName('')
    },
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'ENABLED' | 'DISABLED' }) =>
      api.flows.update(id, { type: 'CHANGE_STATUS', request: { status } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['flows', projectId] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.flows.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['flows', projectId] }),
  })

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Flows</h1>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="mr-1 h-4 w-4" /> New Flow
        </Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
      {error && <p className="text-sm text-red-600">{(error as Error).message}</p>}

      {data && (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-2 text-left font-medium">Name</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="px-4 py-2 text-left font-medium">Trigger</th>
                <th className="px-4 py-2 text-left font-medium">Version</th>
                <th className="px-4 py-2 text-left font-medium">Updated</th>
                <th className="w-24 px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {data.data.map((f) => (
                <tr
                  key={f.id}
                  className="cursor-pointer border-b transition-colors hover:bg-muted/30"
                  onClick={() => navigate(`/projects/${projectId}/flows/${f.id}`)}
                >
                  <td className="px-4 py-2 font-medium">{f.version.displayName}</td>
                  <td className="px-4 py-2">
                    <Badge variant={f.status === 'ENABLED' ? 'success' : 'secondary'}>
                      {f.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {f.version.trigger.type === 'PIECE_TRIGGER'
                      ? (f.version.trigger as { settings: { pieceName?: string } }).settings
                          .pieceName || 'Piece'
                      : f.version.trigger.type}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {f.version.state}
                    {f.publishedVersionId ? ' (published)' : ''}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{timeAgo(f.updated)}</td>
                  <td className="flex gap-1 px-4 py-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      title={f.status === 'ENABLED' ? 'Disable' : 'Enable'}
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleMutation.mutate({
                          id: f.id,
                          status: f.status === 'ENABLED' ? 'DISABLED' : 'ENABLED',
                        })
                      }}
                    >
                      {f.status === 'ENABLED' ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (confirm(`Delete "${f.version.displayName}"?`))
                          deleteMutation.mutate(f.id)
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </td>
                </tr>
              ))}
              {data.data.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No flows yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={showCreate} onClose={() => setShowCreate(false)}>
        <DialogHeader>
          <DialogTitle>Create Flow</DialogTitle>
        </DialogHeader>
        <div>
          <label className="mb-1 block text-sm font-medium">Display Name</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Automation"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowCreate(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!name || createMutation.isPending}
          >
            {createMutation.isPending ? 'Creating...' : 'Create'}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}
