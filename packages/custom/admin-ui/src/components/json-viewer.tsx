import { useState } from 'react'
import { Button } from './ui/button'

interface JsonViewerProps {
  data: unknown
  title?: string
  maxHeight?: string
  collapsible?: boolean
}

export function JsonViewer({
  data,
  title,
  maxHeight = '500px',
  collapsible = true,
}: JsonViewerProps) {
  const [collapsed, setCollapsed] = useState(false)
  const json = JSON.stringify(data, null, 2)

  return (
    <div className="rounded-md border">
      {title && (
        <div className="flex items-center justify-between border-b bg-muted/50 px-3 py-1.5">
          <span className="text-xs font-medium text-muted-foreground">{title}</span>
          <div className="flex gap-1">
            {collapsible && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCollapsed(!collapsed)}
              >
                {collapsed ? 'Expand' : 'Collapse'}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigator.clipboard.writeText(json)}
            >
              Copy
            </Button>
          </div>
        </div>
      )}
      {!collapsed && (
        <pre
          className="overflow-auto p-3 text-xs leading-relaxed"
          style={{ maxHeight }}
        >
          <code>{json}</code>
        </pre>
      )}
    </div>
  )
}
