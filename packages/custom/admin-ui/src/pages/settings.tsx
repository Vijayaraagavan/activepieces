import { useState } from 'react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { api } from '../lib/api-client'

export function SettingsPage() {
  const [apiUrl, setApiUrl] = useState(
    () => localStorage.getItem('ap_api_url') || import.meta.env.VITE_AP_API_URL || '/api/v1',
  )
  const [apiKey, setApiKey] = useState(
    () => localStorage.getItem('ap_api_key') || import.meta.env.VITE_AP_INTERNAL_API_KEY || '',
  )
  const [status, setStatus] = useState<'idle' | 'checking' | 'ok' | 'error'>('idle')
  const [error, setError] = useState('')

  function save() {
    localStorage.setItem('ap_api_url', apiUrl)
    localStorage.setItem('ap_api_key', apiKey)
    setStatus('idle')
  }

  async function check() {
    save()
    setStatus('checking')
    setError('')
    try {
      await api.healthCheck()
      setStatus('ok')
    } catch (e) {
      setStatus('error')
      setError(e instanceof Error ? e.message : 'Unknown error')
    }
  }

  return (
    <div className="mx-auto max-w-xl p-8">
      <h1 className="mb-6 text-2xl font-bold">Settings</h1>

      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">API Base URL</label>
          <Input
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            placeholder="http://localhost:4200/api/v1"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            The Activepieces API base URL (include /api/v1)
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Internal API Key</label>
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="your-secret-key-here"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Must match AP_INTERNAL_API_KEY on the server
          </p>
        </div>

        <div className="flex gap-2">
          <Button onClick={save}>Save</Button>
          <Button variant="outline" onClick={check} disabled={status === 'checking'}>
            {status === 'checking' ? 'Checking...' : 'Test Connection'}
          </Button>
        </div>

        {status === 'ok' && (
          <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">
            Connection successful — API is reachable.
          </div>
        )}
        {status === 'error' && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
            Connection failed: {error}
          </div>
        )}
      </div>
    </div>
  )
}
