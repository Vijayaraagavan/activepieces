import type {
  AppConnection,
  Flow,
  FlowRun,
  FlowVersion,
  PieceMetadata,
  PieceMetadataSummary,
  Project,
  SeekPage,
} from './types'

function getConfig() {
  const apiUrl =
    localStorage.getItem('ap_api_url') ||
    import.meta.env.VITE_AP_API_URL ||
    '/api/v1'
  const apiKey =
    localStorage.getItem('ap_api_key') ||
    import.meta.env.VITE_AP_INTERNAL_API_KEY ||
    ''
  return { apiUrl: apiUrl.replace(/\/+$/, ''), apiKey }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const { apiUrl, apiKey } = getConfig()
  const url = `${apiUrl}${path}`
  const headers: Record<string, string> = {
    'x-internal-api-key': apiKey,
    ...(options.headers as Record<string, string> | undefined),
  }
  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }
  const res = await fetch(url, { ...options, headers })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`${res.status} ${text}`)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== '',
  )
  if (entries.length === 0) return ''
  return '?' + new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString()
}

export const api = {
  healthCheck: () => request<PieceMetadataSummary[]>('/pieces?limit=1'),

  projects: {
    list: () => request<SeekPage<Project>>('/projects'),
    get: (id: string) => request<Project>(`/projects/${id}`),
    create: (body: { displayName: string; externalId?: string; metadata?: Record<string, unknown> }) =>
      request<Project>('/projects', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: { displayName?: string }) =>
      request<Project>(`/projects/${id}`, { method: 'POST', body: JSON.stringify(body) }),
    delete: (id: string) =>
      request<void>(`/projects/${id}`, { method: 'DELETE' }),
  },

  flows: {
    list: (params: { projectId: string; limit?: number; cursor?: string; status?: string }) =>
      request<SeekPage<Flow>>(`/flows${qs(params)}`),
    get: (id: string) => request<Flow>(`/flows/${id}`),
    create: (body: { projectId: string; displayName: string }) =>
      request<Flow>('/flows', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: Record<string, unknown>) =>
      request<Flow>(`/flows/${id}`, { method: 'POST', body: JSON.stringify(body) }),
    delete: (id: string) =>
      request<void>(`/flows/${id}`, { method: 'DELETE' }),
    listVersions: (flowId: string, params?: { limit?: number; cursor?: string }) =>
      request<SeekPage<FlowVersion>>(`/flows/${flowId}/versions${qs(params || {})}`),
  },

  flowRuns: {
    list: (params: {
      projectId: string
      flowId?: string
      status?: string
      limit?: number
      cursor?: string
      createdAfter?: string
      createdBefore?: string
    }) => request<SeekPage<FlowRun>>(`/flow-runs${qs(params)}`),
    get: (id: string) => request<FlowRun>(`/flow-runs/${id}`),
    test: (body: { projectId: string; flowVersionId: string }) =>
      request<FlowRun>('/flow-runs/test', { method: 'POST', body: JSON.stringify(body) }),
  },

  connections: {
    list: (params: { projectId: string; pieceName?: string; limit?: number; cursor?: string }) =>
      request<SeekPage<AppConnection>>(`/app-connections${qs(params)}`),
    upsert: (body: Record<string, unknown>) =>
      request<AppConnection>('/app-connections', { method: 'POST', body: JSON.stringify(body) }),
    delete: (id: string) =>
      request<void>(`/app-connections/${id}`, { method: 'DELETE' }),
    getOAuth2Url: (body: {
      pieceName: string
      pieceVersion?: string
      clientId: string
      redirectUrl: string
      props?: Record<string, string>
    }) =>
      request<{ authorizationUrl: string; codeVerifier?: string }>(
        '/app-connections/oauth2/authorization-url',
        { method: 'POST', body: JSON.stringify(body) },
      ),
  },

  pieces: {
    list: (params?: { limit?: number; cursor?: string; searchQuery?: string }) =>
      request<PieceMetadataSummary[]>(`/pieces${qs(params || {})}`),
    get: (params: { name: string; version?: string }) =>
      request<PieceMetadata>(`/pieces/${encodeURIComponent(params.name)}${qs({ version: params.version })}`),
  },

  webhooks: {
    trigger: (flowId: string, payload: unknown) => {
      const { apiUrl } = getConfig()
      return fetch(`${apiUrl}/webhooks/${flowId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    },
  },
}
