import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Check, Loader2, Plus, Search, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Dialog, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog'
import { Input } from '../components/ui/input'
import { Textarea } from '../components/ui/textarea'
import { api } from '../lib/api-client'
import type { PieceAuth, PieceMetadataSummary } from '../lib/types'
import { getFirstAuth } from '../lib/types'
import { timeAgo } from '../lib/utils'

type Step = 'pick-piece' | 'configure'

export function ConnectionsPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ['connections', projectId],
    queryFn: () => api.connections.list({ projectId: projectId!, limit: 50 }),
    enabled: !!projectId,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.connections.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['connections', projectId] }),
  })

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Connections</h1>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="mr-1 h-4 w-4" /> New Connection
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
                <th className="px-4 py-2 text-left font-medium">Piece</th>
                <th className="px-4 py-2 text-left font-medium">Type</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="px-4 py-2 text-left font-medium">Created</th>
                <th className="w-10 px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {(data.data ?? []).map((c) => (
                <tr key={c.id} className="border-b">
                  <td className="px-4 py-2 font-medium">{c.displayName}</td>
                  <td className="px-4 py-2 text-muted-foreground">{c.pieceName}</td>
                  <td className="px-4 py-2">
                    <Badge variant="outline">{c.type}</Badge>
                  </td>
                  <td className="px-4 py-2">
                    <Badge variant={c.status === 'ACTIVE' ? 'success' : 'destructive'}>
                      {c.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{timeAgo(c.created)}</td>
                  <td className="px-4 py-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm(`Delete "${c.displayName}"?`)) deleteMutation.mutate(c.id)
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </td>
                </tr>
              ))}
              {(data.data ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No connections yet. Click "New Connection" to connect an app.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <CreateConnectionWizard
          projectId={projectId!}
          onClose={() => setShowCreate(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['connections', projectId] })
            setShowCreate(false)
          }}
        />
      )}
    </div>
  )
}

interface SelectedPiece {
  name: string
  displayName: string
  logoUrl: string
  auth: PieceAuth
}

function CreateConnectionWizard({
  projectId,
  onClose,
  onSuccess,
}: {
  projectId: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [step, setStep] = useState<Step>('pick-piece')
  const [selectedPiece, setSelectedPiece] = useState<SelectedPiece | null>(null)

  return (
    <Dialog open onClose={onClose} className="max-w-xl">
      {step === 'pick-piece' && (
        <PiecePicker
          onSelect={(piece) => {
            setSelectedPiece(piece)
            setStep('configure')
          }}
          onClose={onClose}
        />
      )}
      {step === 'configure' && selectedPiece && (
        <ConfigureConnection
          piece={selectedPiece}
          projectId={projectId}
          onBack={() => {
            setStep('pick-piece')
            setSelectedPiece(null)
          }}
          onSuccess={onSuccess}
          onClose={onClose}
        />
      )}
    </Dialog>
  )
}

function PiecePicker({
  onSelect,
  onClose,
}: {
  onSelect: (piece: SelectedPiece) => void
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const { data, isLoading } = useQuery({
    queryKey: ['pieces-for-connect', search],
    queryFn: () => api.pieces.list({ limit: 100, searchQuery: search || undefined }),
    placeholderData: (prev) => prev,
  })

  const piecesWithAuth = (data ?? []).filter((p) => {
    const auth = getFirstAuth(p.auth)
    return auth && auth.type !== 'NO_AUTH'
  })

  async function handleSelect(p: PieceMetadataSummary) {
    const summaryAuth = getFirstAuth(p.auth)
    if (!summaryAuth) return

    setLoading(p.name)
    try {
      const detail = await api.pieces.get({ name: p.name })
      const detailAuth = getFirstAuth(detail.auth) ?? summaryAuth
      onSelect({
        name: p.name,
        displayName: p.displayName,
        logoUrl: p.logoUrl,
        auth: detailAuth,
      })
    } catch {
      onSelect({
        name: p.name,
        displayName: p.displayName,
        logoUrl: p.logoUrl,
        auth: summaryAuth,
      })
    } finally {
      setLoading(null)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Connect an App</DialogTitle>
      </DialogHeader>
      <div className="relative mb-3">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search apps..."
          className="pl-9"
        />
      </div>
      <div className="max-h-80 overflow-y-auto">
        {isLoading && <p className="py-4 text-center text-sm text-muted-foreground">Loading...</p>}
        {piecesWithAuth.length === 0 && !isLoading && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No pieces with authentication found.
          </p>
        )}
        <div className="space-y-1">
          {piecesWithAuth.map((p) => {
            const auth = getFirstAuth(p.auth)
            return (
              <button
                key={p.name}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-muted/50 disabled:opacity-50"
                onClick={() => handleSelect(p)}
                disabled={!!loading}
              >
                {p.logoUrl ? (
                  <img src={p.logoUrl} alt="" className="h-8 w-8 rounded" />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded bg-muted text-xs font-bold">
                    {p.displayName[0]}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{p.displayName}</div>
                  <div className="truncate text-xs text-muted-foreground">{p.name}</div>
                </div>
                {loading === p.name ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : (
                  <Badge variant="outline" className="shrink-0 text-[10px]">
                    {auth?.type === 'OAUTH2' ? 'OAuth2' : auth?.type ?? 'Auth'}
                  </Badge>
                )}
              </button>
            )
          })}
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
      </DialogFooter>
    </>
  )
}

function ConfigureConnection({
  piece,
  projectId,
  onBack,
  onSuccess,
  onClose,
}: {
  piece: SelectedPiece
  projectId: string
  onBack: () => void
  onSuccess: () => void
  onClose: () => void
}) {
  const auth = piece.auth
  const authType = auth.type
  const isOAuth2 = authType === 'OAUTH2'

  const [displayName, setDisplayName] = useState(`${piece.displayName} Connection`)
  const [secretText, setSecretText] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [customProps, setCustomProps] = useState('{}')

  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [oauthCode, setOauthCode] = useState('')
  const [codeVerifier, setCodeVerifier] = useState('')
  const [oauthStatus, setOauthStatus] = useState<'idle' | 'waiting' | 'got-code'>('idle')
  const redirectUrl = `${window.location.origin}/oauth/callback`

  const [errorMsg, setErrorMsg] = useState('')

  const upsertMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.connections.upsert(body),
    onSuccess,
    onError: (e) => setErrorMsg((e as Error).message),
  })

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.code) {
        setOauthCode(decodeURIComponent(event.data.code))
        setOauthStatus('got-code')
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  async function startOAuth() {
    setErrorMsg('')
    setOauthStatus('waiting')
    try {
      const res = await api.connections.getOAuth2Url({
        pieceName: piece.name,
        clientId,
        redirectUrl,
      })
      setCodeVerifier(res.codeVerifier ?? '')
      window.open(res.authorizationUrl, 'oauth_popup', 'width=600,height=700')
    } catch (e) {
      setErrorMsg((e as Error).message)
      setOauthStatus('idle')
    }
  }

  function submit() {
    setErrorMsg('')
    const externalId = displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    const base = { projectId, pieceName: piece.name, displayName, externalId }

    let body: Record<string, unknown>
    switch (authType) {
      case 'SECRET_TEXT':
        body = { ...base, type: 'SECRET_TEXT', value: { type: 'SECRET_TEXT', secret_text: secretText } }
        break
      case 'BASIC_AUTH':
        body = { ...base, type: 'BASIC_AUTH', value: { type: 'BASIC_AUTH', username, password } }
        break
      case 'CUSTOM_AUTH':
        try {
          body = { ...base, type: 'CUSTOM_AUTH', value: { type: 'CUSTOM_AUTH', props: JSON.parse(customProps) } }
        } catch {
          setErrorMsg('Invalid JSON for custom auth props')
          return
        }
        break
      case 'OAUTH2':
        body = {
          ...base,
          type: 'OAUTH2',
          value: {
            type: 'OAUTH2',
            client_id: clientId,
            client_secret: clientSecret,
            code: oauthCode,
            code_challenge: codeVerifier || undefined,
            scope: auth.scope?.join(' ') ?? '',
            redirect_url: redirectUrl,
            authorization_method: auth.authorizationMethod ?? 'BODY',
          },
        }
        break
      default:
        setErrorMsg(`Unsupported auth type: ${authType}`)
        return
    }
    upsertMutation.mutate(body)
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          <div className="flex items-center gap-2">
            <button onClick={onBack} className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
            </button>
            {piece.logoUrl && <img src={piece.logoUrl} alt="" className="h-6 w-6 rounded" />}
            Connect {piece.displayName}
          </div>
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-3">
        {auth.description && (
          <p className="text-xs text-muted-foreground">{auth.description}</p>
        )}

        <div>
          <label className="mb-1 block text-xs font-medium">Connection Name</label>
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>

        {authType === 'SECRET_TEXT' && (
          <div>
            <label className="mb-1 block text-xs font-medium">
              {auth.displayName ?? 'API Key / Secret'}
            </label>
            <Input
              type="password"
              value={secretText}
              onChange={(e) => setSecretText(e.target.value)}
              placeholder="Enter your API key or secret..."
            />
          </div>
        )}

        {authType === 'BASIC_AUTH' && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium">Username</label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Password</label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          </div>
        )}

        {authType === 'CUSTOM_AUTH' && (
          <div>
            <label className="mb-1 block text-xs font-medium">Auth Properties (JSON)</label>
            <Textarea
              value={customProps}
              onChange={(e) => setCustomProps(e.target.value)}
              rows={5}
              className="font-mono text-xs"
              placeholder='{ "api_key": "..." }'
            />
          </div>
        )}

        {isOAuth2 && (
          <div className="space-y-3">
            <div className="rounded-md border border-dashed border-muted-foreground/30 bg-muted/30 p-3">
              <p className="mb-2 text-xs font-medium">OAuth2 Setup</p>
              <p className="text-[11px] text-muted-foreground">
                Register an OAuth app with {piece.displayName} and enter your credentials below.
                {auth.scope && auth.scope.length > 0 && (
                  <> Scopes: <code className="text-[10px]">{auth.scope.join(', ')}</code></>
                )}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Redirect URL: <code className="select-all text-[10px]">{redirectUrl}</code>
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs font-medium">Client ID</label>
                <Input value={clientId} onChange={(e) => setClientId(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Client Secret</label>
                <Input type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} />
              </div>
            </div>

            {oauthStatus === 'idle' && (
              <Button
                onClick={startOAuth}
                disabled={!clientId || !clientSecret}
                className="w-full"
              >
                Sign in with {piece.displayName}
              </Button>
            )}

            {oauthStatus === 'waiting' && (
              <div className="rounded-md bg-amber-50 p-3 text-center text-xs text-amber-700">
                Waiting for authorization... Complete the sign-in in the popup window.
              </div>
            )}

            {oauthStatus === 'got-code' && (
              <div className="flex items-center gap-2 rounded-md bg-emerald-50 p-3 text-xs text-emerald-700">
                <Check className="h-4 w-4" />
                Authorization code received. Click "Connect" to finish.
              </div>
            )}
          </div>
        )}

        {errorMsg && (
          <div className="rounded-md bg-red-50 p-2 text-xs text-red-700">{errorMsg}</div>
        )}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button
          onClick={submit}
          disabled={
            upsertMutation.isPending ||
            !displayName ||
            (authType === 'SECRET_TEXT' && !secretText) ||
            (isOAuth2 && oauthStatus !== 'got-code')
          }
        >
          {upsertMutation.isPending ? 'Connecting...' : 'Connect'}
        </Button>
      </DialogFooter>
    </>
  )
}
