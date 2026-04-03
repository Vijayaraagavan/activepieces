export interface SeekPage<T> {
  data: T[]
  next: string | null
  previous: string | null
}

export interface Project {
  id: string
  created: string
  updated: string
  deleted: string | null
  ownerId: string
  displayName: string
  platformId: string
  maxConcurrentJobs: number | null
  type: 'PERSONAL' | 'TEAM'
  icon: { color: string } | null
  externalId: string | null
  releasesEnabled: boolean
  metadata: Record<string, unknown> | null
}

export interface FlowVersion {
  id: string
  created: string
  updated: string
  flowId: string
  displayName: string
  trigger: FlowTrigger
  updatedBy: string | null
  valid: boolean
  schemaVersion: string | null
  agentIds: string[]
  state: 'DRAFT' | 'LOCKED'
  connectionIds: string[]
  backupFiles: Record<string, string> | null
  notes: Note[]
}

export interface Note {
  id: string
  content: string
  position: { x: number; y: number }
}

export type FlowTrigger = PieceTrigger | EmptyTrigger

export interface PieceTrigger {
  name: string
  valid: boolean
  displayName: string
  type: 'PIECE_TRIGGER'
  settings: PieceTriggerSettings
  nextAction?: FlowAction
  lastUpdatedDate?: string
}

export interface EmptyTrigger {
  name: string
  valid: boolean
  displayName: string
  type: 'EMPTY'
  settings: Record<string, unknown>
  nextAction?: FlowAction
  lastUpdatedDate?: string
}

export interface PieceTriggerSettings {
  pieceName: string
  pieceVersion: string
  triggerName?: string
  input: Record<string, unknown>
  inputUiInfo?: Record<string, unknown>
  propertySettings?: Record<string, unknown>
  packageType: 'REGISTRY' | 'ARCHIVE'
  pieceType: 'OFFICIAL' | 'COMMUNITY' | 'CUSTOM'
}

export type FlowAction = CodeAction | PieceAction | RouterAction | LoopAction

export interface CodeAction {
  name: string
  displayName: string
  type: 'CODE'
  valid: boolean
  lastUpdatedDate?: string
  settings: {
    input: Record<string, unknown>
    sourceCode: { code: string; packageJson: string }
    errorHandlingOptions?: Record<string, unknown>
  }
  nextAction?: FlowAction
}

export interface PieceAction {
  name: string
  displayName: string
  type: 'PIECE'
  valid: boolean
  lastUpdatedDate?: string
  settings: {
    pieceName: string
    pieceVersion: string
    actionName?: string
    input: Record<string, unknown>
    inputUiInfo?: Record<string, unknown>
    propertySettings?: Record<string, unknown>
    packageType: 'REGISTRY' | 'ARCHIVE'
    pieceType: 'OFFICIAL' | 'COMMUNITY' | 'CUSTOM'
    errorHandlingOptions?: Record<string, unknown>
  }
  nextAction?: FlowAction
}

export interface RouterAction {
  name: string
  displayName: string
  type: 'ROUTER'
  valid: boolean
  lastUpdatedDate?: string
  settings: {
    branches: RouterBranch[]
    executionType: 'EXECUTE_ALL_MATCH' | 'EXECUTE_FIRST_MATCH'
  }
  children: (FlowAction | null)[]
  nextAction?: FlowAction
}

export interface RouterBranch {
  branchName: string
  branchType: 'CONDITION' | 'FALLBACK'
  conditions?: unknown[][]
}

export interface LoopAction {
  name: string
  displayName: string
  type: 'LOOP_ON_ITEMS'
  valid: boolean
  lastUpdatedDate?: string
  settings: {
    items: string
  }
  firstLoopAction?: FlowAction
  nextAction?: FlowAction
}

export interface Flow {
  id: string
  created: string
  updated: string
  projectId: string
  externalId: string
  ownerId: string
  folderId: string | null
  status: 'ENABLED' | 'DISABLED'
  publishedVersionId: string | null
  metadata: Record<string, unknown> | null
  operationStatus: string
  timeSavedPerRun: number | null
  templateId: string | null
  version: FlowVersion
}

export interface FlowRun {
  id: string
  created: string
  updated: string
  projectId: string
  flowId: string
  flowVersionId: string
  displayName?: string
  flowVersion?: { displayName?: string }
  status: FlowRunStatus
  startTime: string | null
  finishTime: string | null
  duration: number | null
  environment: string
  steps: Record<string, unknown> | null
  logsFileId: string | null
  tags: string[]
}

export type FlowRunStatus =
  | 'QUEUED'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'PAUSED'
  | 'TIMEOUT'
  | 'INTERNAL_ERROR'
  | 'STOPPED'
  | 'QUOTA_EXCEEDED'
  | 'MEMORY_LIMIT_EXCEEDED'
  | 'CANCELED'
  | 'LOG_SIZE_EXCEEDED'

export interface AppConnection {
  id: string
  created: string
  updated: string
  displayName: string
  externalId: string
  type: AppConnectionType
  status: 'ACTIVE' | 'ERROR' | 'MISSING_REQUIRED_FIELDS'
  pieceName: string
  projectIds: string[]
  scope: 'PROJECT' | 'PLATFORM'
  owner: { id: string; firstName: string; lastName: string } | null
  metadata: Record<string, unknown> | null
}

export type AppConnectionType =
  | 'OAUTH2'
  | 'PLATFORM_OAUTH2'
  | 'CLOUD_OAUTH2'
  | 'SECRET_TEXT'
  | 'BASIC_AUTH'
  | 'CUSTOM_AUTH'
  | 'NO_AUTH'

export interface PieceMetadataSummary {
  name: string
  displayName: string
  description: string
  logoUrl: string
  version: string
  auth: PieceAuth | PieceAuth[] | null
  actions: number
  triggers: number
  categories: string[]
  packageType: string
  pieceType: string
}

export interface PieceMetadata {
  name: string
  displayName: string
  description: string
  logoUrl: string
  version: string
  auth: PieceAuth | PieceAuth[] | null
  actions: Record<string, PieceActionMeta>
  triggers: Record<string, PieceTriggerMeta>
  categories: string[]
  packageType: string
  pieceType: string
}

export interface PieceAuth {
  type: string
  description?: string
  required?: boolean
  displayName?: string
  authUrl?: string
  tokenUrl?: string
  scope?: string[]
  pkce?: boolean
  authorizationMethod?: string
  grantType?: string
  extra?: Record<string, string>
  props?: Record<string, unknown>
}

export interface PiecePropDefinition {
  displayName: string
  description?: string
  required: boolean
  type: PiecePropType
  defaultValue?: unknown
  options?: {
    disabled?: boolean
    options?: { label: string; value: string }[]
  }
  refreshers?: string[]
  variant?: string
  auth?: unknown
  props?: Record<string, unknown>
}

export interface PieceActionMeta {
  name: string
  displayName: string
  description: string
  props: Record<string, PiecePropDefinition>
  requireAuth?: boolean
  errorHandlingOptions?: Record<string, unknown>
}

export interface PieceTriggerMeta {
  name: string
  displayName: string
  description: string
  props: Record<string, PiecePropDefinition>
  requireAuth?: boolean
  type?: string
}

export type PiecePropType =
  | 'SHORT_TEXT'
  | 'LONG_TEXT'
  | 'NUMBER'
  | 'CHECKBOX'
  | 'SECRET_TEXT'
  | 'STATIC_DROPDOWN'
  | 'DROPDOWN'
  | 'MULTI_SELECT_DROPDOWN'
  | 'STATIC_MULTI_SELECT_DROPDOWN'
  | 'DYNAMIC'
  | 'OBJECT'
  | 'ARRAY'
  | 'JSON'
  | 'MARKDOWN'
  | 'FILE'
  | 'DATE_TIME'
  | 'CUSTOM_AUTH'
  | 'OAUTH2'

export function getFirstAuth(auth: PieceAuth | PieceAuth[] | null | undefined): PieceAuth | null {
  if (!auth) return null
  if (Array.isArray(auth)) return auth[0] ?? null
  return auth
}

export interface ImportFlowRequest {
  displayName: string
  trigger: FlowTrigger
  schemaVersion: string | null
  notes: Note[] | null
}

export type FlowOperationType =
  | 'LOCK_AND_PUBLISH'
  | 'CHANGE_STATUS'
  | 'LOCK_FLOW'
  | 'CHANGE_FOLDER'
  | 'CHANGE_NAME'
  | 'MOVE_ACTION'
  | 'IMPORT_FLOW'
  | 'UPDATE_TRIGGER'
  | 'ADD_ACTION'
  | 'UPDATE_ACTION'
  | 'DELETE_ACTION'
  | 'DUPLICATE_ACTION'
  | 'USE_AS_DRAFT'
