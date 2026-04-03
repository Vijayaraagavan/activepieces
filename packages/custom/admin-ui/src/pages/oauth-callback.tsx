import { useEffect } from 'react'

export function OAuthCallbackPage() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    if (code && window.opener) {
      window.opener.postMessage({ code }, '*')
      window.close()
    }
  }, [])

  return (
    <div className="flex h-screen items-center justify-center">
      <p className="text-sm text-muted-foreground">
        OAuth callback received. This window should close automatically.
      </p>
    </div>
  )
}
