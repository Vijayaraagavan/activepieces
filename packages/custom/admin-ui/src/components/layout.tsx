import {
  Blocks,
  FolderOpen,
  LayoutDashboard,
  Link2,
  Play,
  Puzzle,
  Settings,
} from 'lucide-react'
import { NavLink, Outlet, useParams } from 'react-router-dom'
import { cn } from '../lib/utils'

const globalNav = [
  { to: '/projects', label: 'Projects', icon: LayoutDashboard },
  { to: '/pieces', label: 'Pieces', icon: Puzzle },
  { to: '/settings', label: 'Settings', icon: Settings },
]

function ProjectNav({ projectId }: { projectId: string }) {
  const base = `/projects/${projectId}`
  const items = [
    { to: `${base}/flows`, label: 'Flows', icon: Blocks },
    { to: `${base}/runs`, label: 'Runs', icon: Play },
    { to: `${base}/connections`, label: 'Connections', icon: Link2 },
    { to: `${base}/templates`, label: 'Templates', icon: FolderOpen },
  ]
  return (
    <>
      <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        Project
      </div>
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors',
              isActive
                ? 'bg-accent text-accent-foreground font-medium'
                : 'text-muted-foreground hover:bg-accent/50',
            )
          }
        >
          <item.icon className="h-4 w-4" />
          {item.label}
        </NavLink>
      ))}
    </>
  )
}

export function Layout() {
  const { projectId } = useParams<{ projectId: string }>()

  return (
    <div className="flex h-screen">
      <aside className="flex w-56 flex-col border-r bg-card">
        <div className="border-b px-4 py-3">
          <h1 className="text-sm font-bold tracking-tight">AP Admin</h1>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
          {globalNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors',
                  isActive
                    ? 'bg-accent text-accent-foreground font-medium'
                    : 'text-muted-foreground hover:bg-accent/50',
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
          {projectId && (
            <>
              <div className="my-2 border-t" />
              <ProjectNav projectId={projectId} />
            </>
          )}
        </nav>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
