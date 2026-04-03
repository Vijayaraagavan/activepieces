import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/layout'
import { ConnectionsPage } from './pages/connections'
import { FlowDetailPage } from './pages/flow-detail'
import { FlowRunsPage } from './pages/flow-runs'
import { FlowsPage } from './pages/flows'
import { OAuthCallbackPage } from './pages/oauth-callback'
import { PiecesPage } from './pages/pieces'
import { ProjectsPage } from './pages/projects'
import { SettingsPage } from './pages/settings'
import { TemplatesPage } from './pages/templates-page'
import { WebhookTesterPage } from './pages/webhook-tester'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/oauth/callback" element={<OAuthCallbackPage />} />
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/projects" replace />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:projectId/flows" element={<FlowsPage />} />
          <Route path="/projects/:projectId/flows/:flowId" element={<FlowDetailPage />} />
          <Route path="/projects/:projectId/flows/:flowId/webhook" element={<WebhookTesterPage />} />
          <Route path="/projects/:projectId/runs" element={<FlowRunsPage />} />
          <Route path="/projects/:projectId/connections" element={<ConnectionsPage />} />
          <Route path="/projects/:projectId/templates" element={<TemplatesPage />} />
          <Route path="/pieces" element={<PiecesPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
