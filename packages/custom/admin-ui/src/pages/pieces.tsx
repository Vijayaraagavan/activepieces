import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { useState } from 'react'
import { JsonViewer } from '../components/json-viewer'
import { Badge } from '../components/ui/badge'
import { Dialog, DialogHeader, DialogTitle } from '../components/ui/dialog'
import { Input } from '../components/ui/input'
import { api } from '../lib/api-client'
import type { PieceMetadataSummary } from '../lib/types'
import { getFirstAuth } from '../lib/types'

export function PiecesPage() {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<PieceMetadataSummary | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['pieces', search],
    queryFn: () => api.pieces.list({ limit: 100, searchQuery: search || undefined }),
    placeholderData: (prev) => prev,
  })

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Pieces</h1>
      </div>

      <div className="relative mb-4 max-w-md">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search pieces..."
          className="pl-9"
        />
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
      {error && <p className="text-sm text-red-600">{(error as Error).message}</p>}

      {data && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((p) => {
            const auth = getFirstAuth(p.auth)
            return (
              <div
                key={p.name}
                className="cursor-pointer rounded-md border p-3 transition-colors hover:bg-muted/30"
                onClick={() => setSelected(p)}
              >
                <div className="flex items-center gap-2">
                  {p.logoUrl && (
                    <img src={p.logoUrl} alt="" className="h-8 w-8 rounded" />
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-medium">{p.displayName}</h3>
                    <p className="truncate text-xs text-muted-foreground">{p.name}</p>
                  </div>
                </div>
                <div className="mt-2 flex gap-1">
                  <Badge variant="secondary">{p.actions} actions</Badge>
                  <Badge variant="secondary">{p.triggers} triggers</Badge>
                  {auth && <Badge variant="outline">{auth.type}</Badge>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {selected && <PieceDetailDialog piece={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

function PieceDetailDialog({ piece, onClose }: { piece: PieceMetadataSummary; onClose: () => void }) {
  const { data: detail, isLoading } = useQuery({
    queryKey: ['piece-detail', piece.name],
    queryFn: () => api.pieces.get({ name: piece.name }),
  })

  const auth = detail ? getFirstAuth(detail.auth) : getFirstAuth(piece.auth)

  return (
    <Dialog open onClose={onClose} className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>{piece.displayName}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{piece.description}</p>

        {auth && (
          <div>
            <h4 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Auth</h4>
            <Badge variant="outline">{auth.type}</Badge>
          </div>
        )}

        {isLoading && <p className="text-sm text-muted-foreground">Loading details...</p>}

        {detail && Object.keys(detail.actions).length > 0 && (
          <div>
            <h4 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
              Actions
            </h4>
            <div className="space-y-1">
              {Object.values(detail.actions).map((a) => (
                <div key={a.name} className="rounded bg-muted/50 px-2 py-1">
                  <span className="text-xs font-medium">{a.displayName}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{a.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {detail && Object.keys(detail.triggers).length > 0 && (
          <div>
            <h4 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
              Triggers
            </h4>
            <div className="space-y-1">
              {Object.values(detail.triggers).map((t) => (
                <div key={t.name} className="rounded bg-muted/50 px-2 py-1">
                  <span className="text-xs font-medium">{t.displayName}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{t.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {detail && <JsonViewer data={detail} title="Raw Piece Metadata" maxHeight="300px" />}
      </div>
    </Dialog>
  )
}
