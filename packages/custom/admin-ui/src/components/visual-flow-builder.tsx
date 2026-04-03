import { useQuery } from '@tanstack/react-query'
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Code2,
  Copy,
  Info,
  Link2,
  Plus,
  Save,
  Trash2,
  Zap,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api-client'
import type {
  FlowAction,
  FlowTrigger,
  FlowVersion,
  ImportFlowRequest,
  PieceActionMeta,
  PieceMetadataSummary,
  PiecePropDefinition,
  PieceTriggerMeta,
} from '../lib/types'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Select } from './ui/select'
import { Textarea } from './ui/textarea'

type StepKind = 'trigger' | 'action'
type StepType = 'EMPTY' | 'PIECE_TRIGGER' | 'CODE' | 'PIECE'

const CONNECTION_PATTERN = /^\{\{connections\['([^']*)'\]\}\}$/
const SKIPPED_PROP_TYPES = new Set(['MARKDOWN', 'OAUTH2', 'CUSTOM_AUTH', 'DYNAMIC'])

interface BuilderStep {
  id: string
  kind: StepKind
  stepType: StepType
  displayName: string
  pieceName: string
  pieceVersion: string
  actionOrTriggerName: string
  connectionExternalId: string
  input: Record<string, string>
  code: string
  expanded: boolean
}

function extractConnectionId(input: Record<string, unknown>): string {
  const auth = input?.auth
  if (typeof auth !== 'string') return ''
  const match = auth.match(CONNECTION_PATTERN)
  return match?.[1] ?? ''
}

function inputWithoutAuth(obj: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'auth') continue
    out[k] = typeof v === 'string' ? v : JSON.stringify(v)
  }
  return out
}

function flattenTrigger(trigger: FlowTrigger): BuilderStep[] {
  const steps: BuilderStep[] = []

  const triggerInput = trigger.type === 'PIECE_TRIGGER' ? trigger.settings.input : {}

  steps.push({
    id: trigger.name,
    kind: 'trigger',
    stepType: trigger.type === 'PIECE_TRIGGER' ? 'PIECE_TRIGGER' : 'EMPTY',
    displayName: trigger.displayName,
    pieceName: trigger.type === 'PIECE_TRIGGER' ? trigger.settings.pieceName : '',
    pieceVersion: trigger.type === 'PIECE_TRIGGER' ? trigger.settings.pieceVersion : '',
    actionOrTriggerName:
      trigger.type === 'PIECE_TRIGGER' ? (trigger.settings.triggerName ?? '') : '',
    connectionExternalId: extractConnectionId(triggerInput),
    input: trigger.type === 'PIECE_TRIGGER' ? inputWithoutAuth(trigger.settings.input) : {},
    code: '',
    expanded: false,
  })

  let action: FlowAction | undefined = trigger.nextAction
  let idx = 1
  while (action) {
    const step: BuilderStep = {
      id: action.name || `step_${idx}`,
      kind: 'action',
      stepType: action.type === 'CODE' ? 'CODE' : 'PIECE',
      displayName: action.displayName,
      pieceName: '',
      pieceVersion: '',
      actionOrTriggerName: '',
      connectionExternalId: '',
      input: {},
      code: '',
      expanded: false,
    }

    if (action.type === 'CODE') {
      step.code = action.settings.sourceCode.code
      step.input = toStringRecord(action.settings.input)
    } else if (action.type === 'PIECE') {
      step.pieceName = action.settings.pieceName
      step.pieceVersion = action.settings.pieceVersion
      step.actionOrTriggerName = action.settings.actionName ?? ''
      step.connectionExternalId = extractConnectionId(action.settings.input)
      step.input = inputWithoutAuth(action.settings.input)
    }

    steps.push(step)
    action = action.nextAction
    idx++
  }

  return steps
}

function toStringRecord(obj: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(obj)) {
    out[k] = typeof v === 'string' ? v : JSON.stringify(v)
  }
  return out
}

function stepsToImportRequest(
  steps: BuilderStep[],
  displayName: string,
): ImportFlowRequest {
  const trigger = steps[0]
  const actions = steps.slice(1)
  const now = new Date().toISOString()

  let lastAction: FlowAction | undefined
  for (let i = actions.length - 1; i >= 0; i--) {
    const s = actions[i]
    const actionInput = parseInputValues(s.input)
    if (s.connectionExternalId) {
      actionInput.auth = `{{connections['${s.connectionExternalId}']}}`
    }
    const action: FlowAction =
      s.stepType === 'CODE'
        ? {
            name: s.id,
            displayName: s.displayName || `Step ${i + 1}`,
            type: 'CODE',
            valid: true,
            lastUpdatedDate: now,
            settings: {
              input: parseInputValues(s.input),
              sourceCode: {
                code:
                  s.code ||
                  'export const code = async (inputs) => { return {}; };',
                packageJson: '{}',
              },
              errorHandlingOptions: {},
            },
            nextAction: lastAction,
          }
        : {
            name: s.id,
            displayName: s.displayName || `Step ${i + 1}`,
            type: 'PIECE',
            valid: !!s.pieceName && !!s.actionOrTriggerName,
            lastUpdatedDate: now,
            settings: {
              pieceName: s.pieceName,
              pieceVersion: s.pieceVersion || '~0.1.0',
              actionName: s.actionOrTriggerName,
              input: actionInput,
              inputUiInfo: {},
              propertySettings: {},
              packageType: 'REGISTRY' as const,
              pieceType: 'OFFICIAL' as const,
              errorHandlingOptions: {},
            },
            nextAction: lastAction,
          }
    lastAction = action
  }

  const triggerInput = parseInputValues(trigger.input)
  if (trigger.connectionExternalId) {
    triggerInput.auth = `{{connections['${trigger.connectionExternalId}']}}`
  }

  const flowTrigger: FlowTrigger =
    trigger.stepType === 'PIECE_TRIGGER'
      ? {
          name: 'trigger',
          displayName: trigger.displayName || 'Trigger',
          type: 'PIECE_TRIGGER',
          valid: !!trigger.pieceName && !!trigger.actionOrTriggerName,
          lastUpdatedDate: now,
          settings: {
            pieceName: trigger.pieceName,
            pieceVersion: trigger.pieceVersion || '~0.1.0',
            triggerName: trigger.actionOrTriggerName,
            input: triggerInput,
            inputUiInfo: {},
            propertySettings: {},
            packageType: 'REGISTRY',
            pieceType: 'OFFICIAL',
          },
          nextAction: lastAction,
        }
      : {
          name: 'trigger',
          displayName: trigger.displayName || 'Select Trigger',
          type: 'EMPTY',
          valid: false,
          lastUpdatedDate: now,
          settings: {},
          nextAction: lastAction,
        }

  return {
    displayName,
    trigger: flowTrigger,
    schemaVersion: '18',
    notes: null,
  }
}

function parseInputValues(input: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(input)) {
    if (!v) continue
    try {
      out[k] = JSON.parse(v)
    } catch {
      out[k] = v
    }
  }
  return out
}

export function VisualFlowBuilder({
  flowVersion,
  flowDisplayName,
  projectId,
  onApply,
  isPending,
}: {
  flowVersion: FlowVersion
  flowDisplayName: string
  projectId: string
  onApply: (body: Record<string, unknown>) => void
  isPending: boolean
}) {
  const [steps, setSteps] = useState<BuilderStep[]>(() =>
    flattenTrigger(flowVersion.trigger),
  )
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    setSteps(flattenTrigger(flowVersion.trigger))
    setDirty(false)
  }, [flowVersion])

  const { data: pieces } = useQuery({
    queryKey: ['pieces-for-builder'],
    queryFn: () => api.pieces.list({ limit: 200 }),
    staleTime: 5 * 60 * 1000,
  })

  const update = useCallback(
    (idx: number, patch: Partial<BuilderStep>) => {
      setSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)))
      setDirty(true)
    },
    [],
  )

  function addStep(afterIdx: number) {
    const newId = `step_${Date.now()}`
    const newStep: BuilderStep = {
      id: newId,
      kind: 'action',
      stepType: 'CODE',
      displayName: 'New Step',
      pieceName: '',
      pieceVersion: '',
      actionOrTriggerName: '',
      connectionExternalId: '',
      input: {},
      code: 'export const code = async (inputs) => {\n  return {};\n};',
      expanded: true,
    }
    setSteps((prev) => {
      const copy = [...prev]
      copy.splice(afterIdx + 1, 0, newStep)
      return renumberSteps(copy)
    })
    setDirty(true)
  }

  function removeStep(idx: number) {
    if (idx === 0) return
    setSteps((prev) => renumberSteps(prev.filter((_, i) => i !== idx)))
    setDirty(true)
  }

  function moveStep(idx: number, dir: -1 | 1) {
    const target = idx + dir
    if (target < 1 || target >= steps.length) return
    setSteps((prev) => {
      const copy = [...prev]
      ;[copy[idx], copy[target]] = [copy[target], copy[idx]]
      return renumberSteps(copy)
    })
    setDirty(true)
  }

  function handleApply() {
    const req = stepsToImportRequest(steps, flowDisplayName)
    onApply({ type: 'IMPORT_FLOW', request: req })
    setDirty(false)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {steps.length} step{steps.length !== 1 && 's'} &middot;{' '}
          {dirty ? 'Unsaved changes' : 'Up to date'}
        </p>
        <Button size="sm" disabled={!dirty || isPending} onClick={handleApply}>
          <Save className="mr-1 h-3 w-3" />
          {isPending ? 'Saving...' : 'Apply Changes'}
        </Button>
      </div>

      {steps.map((step, idx) => (
        <StepCard
          key={step.id}
          step={step}
          idx={idx}
          totalSteps={steps.length}
          allSteps={steps}
          pieces={pieces ?? []}
          projectId={projectId}
          onChange={(patch) => update(idx, patch)}
          onDelete={() => removeStep(idx)}
          onMove={(dir) => moveStep(idx, dir)}
          onAddAfter={() => addStep(idx)}
        />
      ))}
    </div>
  )
}

function StepCard({
  step,
  idx,
  totalSteps,
  allSteps,
  pieces,
  projectId,
  onChange,
  onDelete,
  onMove,
  onAddAfter,
}: {
  step: BuilderStep
  idx: number
  totalSteps: number
  allSteps: BuilderStep[]
  pieces: PieceMetadataSummary[]
  projectId: string
  onChange: (patch: Partial<BuilderStep>) => void
  onDelete: () => void
  onMove: (dir: -1 | 1) => void
  onAddAfter: () => void
}) {
  const isTrigger = step.kind === 'trigger'
  const isPiece = step.stepType === 'PIECE' || step.stepType === 'PIECE_TRIGGER'

  const selectedPiece = useMemo(
    () => pieces.find((p) => p.name === step.pieceName),
    [pieces, step.pieceName],
  )

  return (
    <div className="rounded-md border">
      <button
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted/30"
        onClick={() => onChange({ expanded: !step.expanded })}
      >
        {step.expanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        {isTrigger ? (
          <Zap className="h-4 w-4 shrink-0 text-amber-500" />
        ) : step.stepType === 'CODE' ? (
          <Code2 className="h-4 w-4 shrink-0 text-blue-500" />
        ) : (
          selectedPiece?.logoUrl ? (
            <img src={selectedPiece.logoUrl} alt="" className="h-4 w-4 shrink-0 rounded" />
          ) : (
            <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-muted text-[8px] font-bold">
              P
            </div>
          )
        )}
        <span className="flex-1 truncate text-sm font-medium">{step.displayName}</span>
        <Badge variant="outline" className="text-[10px]">
          {isTrigger ? 'Trigger' : step.stepType}
        </Badge>
      </button>

      {step.expanded && (
        <div className="border-t px-3 py-3 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium">Display Name</label>
            <Input
              value={step.displayName}
              onChange={(e) => onChange({ displayName: e.target.value })}
            />
          </div>

          {isTrigger && (
            <div>
              <label className="mb-1 block text-xs font-medium">Trigger Type</label>
              <Select
                value={step.stepType}
                onChange={(e) => {
                  const newType = e.target.value as StepType
                  onChange({
                    stepType: newType,
                    pieceName: '',
                    pieceVersion: '',
                    actionOrTriggerName: '',
                    input: {},
                  })
                }}
              >
                <option value="EMPTY">Empty (unconfigured)</option>
                <option value="PIECE_TRIGGER">Piece Trigger</option>
              </Select>
            </div>
          )}

          {!isTrigger && (
            <div>
              <label className="mb-1 block text-xs font-medium">Step Type</label>
              <Select
                value={step.stepType}
                onChange={(e) => {
                  const newType = e.target.value as StepType
                  onChange({
                    stepType: newType,
                    pieceName: '',
                    pieceVersion: '',
                    actionOrTriggerName: '',
                    input: newType === 'CODE' ? {} : {},
                    code:
                      newType === 'CODE'
                        ? 'export const code = async (inputs) => {\n  return {};\n};'
                        : '',
                  })
                }}
              >
                <option value="CODE">Code</option>
                <option value="PIECE">Piece Action</option>
              </Select>
            </div>
          )}

          {isPiece && (
            <PieceSelector
              pieces={pieces}
              step={step}
              isTrigger={isTrigger}
              onChange={onChange}
            />
          )}

          {isPiece && step.pieceName && (
            <ConnectionPicker
              projectId={projectId}
              pieceName={step.pieceName}
              connectionExternalId={step.connectionExternalId}
              onChange={(id) => onChange({ connectionExternalId: id })}
            />
          )}

          {step.stepType === 'CODE' && (
            <div>
              <label className="mb-1 block text-xs font-medium">Code</label>
              <Textarea
                value={step.code}
                onChange={(e) => onChange({ code: e.target.value })}
                rows={8}
                className="font-mono text-xs"
              />
            </div>
          )}

          {isPiece && step.pieceName && step.actionOrTriggerName ? (
            <PiecePropsEditor
              pieceName={step.pieceName}
              actionOrTriggerName={step.actionOrTriggerName}
              isTrigger={isTrigger}
              input={step.input}
              onChange={(input) => onChange({ input })}
              previousSteps={allSteps.slice(0, idx)}
            />
          ) : (
            <InputEditor
              input={step.input}
              onChange={(input) => onChange({ input })}
            />
          )}

          <div className="flex items-center gap-1 border-t pt-2">
            {!isTrigger && idx > 1 && (
              <Button variant="ghost" size="icon" onClick={() => onMove(-1)} title="Move up">
                <ArrowUp className="h-3 w-3" />
              </Button>
            )}
            {!isTrigger && idx < totalSteps - 1 && (
              <Button variant="ghost" size="icon" onClick={() => onMove(1)} title="Move down">
                <ArrowDown className="h-3 w-3" />
              </Button>
            )}
            <div className="flex-1" />
            <Button
              variant="outline"
              size="sm"
              onClick={onAddAfter}
              className="text-xs"
            >
              <Plus className="mr-1 h-3 w-3" /> Add Step After
            </Button>
            {!isTrigger && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onDelete}
                className="text-xs text-red-600 hover:text-red-700"
              >
                <Trash2 className="mr-1 h-3 w-3" /> Remove
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ConnectionPicker({
  projectId,
  pieceName,
  connectionExternalId,
  onChange,
}: {
  projectId: string
  pieceName: string
  connectionExternalId: string
  onChange: (externalId: string) => void
}) {
  const { data: connections } = useQuery({
    queryKey: ['connections-for-builder', projectId, pieceName],
    queryFn: () => api.connections.list({ projectId, pieceName, limit: 50 }),
    enabled: !!projectId && !!pieceName,
    staleTime: 30 * 1000,
  })

  const items = connections?.data ?? []

  return (
    <div>
      <label className="mb-1 flex items-center gap-1 text-xs font-medium">
        <Link2 className="h-3 w-3" /> Connection
      </label>
      <Select
        value={connectionExternalId}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">No connection</option>
        {items.map((c) => (
          <option key={c.externalId} value={c.externalId}>
            {c.displayName} ({c.externalId})
          </option>
        ))}
      </Select>
      {items.length === 0 && (
        <p className="mt-1 text-[10px] text-muted-foreground">
          No connections found for this piece. Create one in the Connections page first.
        </p>
      )}
      {connectionExternalId && (
        <p className="mt-1 text-[10px] text-emerald-600">
          Will set input.auth = {"{{connections['" + connectionExternalId + "']}}"}
        </p>
      )}
    </div>
  )
}

function deriveTildeVersion(exactVersion: string): string {
  const parts = exactVersion.split('.')
  if (parts.length < 2) return `~${exactVersion}`
  return `~${parts[0]}.${parts[1]}.0`
}

function PieceSelector({
  pieces,
  step,
  isTrigger,
  onChange,
}: {
  pieces: PieceMetadataSummary[]
  step: BuilderStep
  isTrigger: boolean
  onChange: (patch: Partial<BuilderStep>) => void
}) {
  const { data: pieceDetail } = useQuery({
    queryKey: ['piece-detail-builder', step.pieceName],
    queryFn: () => api.pieces.get({ name: step.pieceName }),
    enabled: !!step.pieceName,
    staleTime: 5 * 60 * 1000,
  })

  const items = useMemo(() => {
    if (!pieceDetail) return []
    const source = isTrigger ? pieceDetail.triggers : pieceDetail.actions
    return Object.values(source)
  }, [pieceDetail, isTrigger])

  const filteredPieces = useMemo(() => {
    if (isTrigger) return pieces.filter((p) => p.triggers > 0)
    return pieces.filter((p) => p.actions > 0)
  }, [pieces, isTrigger])

  const selectedSummary = useMemo(
    () => pieces.find((p) => p.name === step.pieceName),
    [pieces, step.pieceName],
  )

  const versionOptions = useMemo(() => {
    if (!selectedSummary) return []
    const exact = selectedSummary.version
    const tilde = deriveTildeVersion(exact)
    const opts = [
      { value: exact, label: `${exact} (exact)` },
      { value: tilde, label: `${tilde} (compatible minor)` },
    ]
    if (step.pieceVersion && !opts.some((o) => o.value === step.pieceVersion)) {
      opts.unshift({ value: step.pieceVersion, label: `${step.pieceVersion} (current)` })
    }
    return opts
  }, [selectedSummary, step.pieceVersion])

  return (
    <>
      <div>
        <label className="mb-1 block text-xs font-medium">Piece</label>
        <Select
          value={step.pieceName}
          onChange={(e) => {
            const name = e.target.value
            const p = pieces.find((pp) => pp.name === name)
            onChange({
              pieceName: name,
              pieceVersion: p ? deriveTildeVersion(p.version) : '',
              actionOrTriggerName: '',
              connectionExternalId: '',
              input: {},
            })
          }}
        >
          <option value="">Select a piece...</option>
          {filteredPieces.map((p) => (
            <option key={p.name} value={p.name}>
              {p.displayName}
            </option>
          ))}
        </Select>
      </div>

      {step.pieceName && (
        <div>
          <label className="mb-1 block text-xs font-medium">Version</label>
          <div className="flex items-center gap-2">
            <Select
              value={step.pieceVersion}
              onChange={(e) => onChange({ pieceVersion: e.target.value })}
              className="flex-1"
            >
              {versionOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
            <Input
              value={step.pieceVersion}
              onChange={(e) => onChange({ pieceVersion: e.target.value })}
              className="w-32 font-mono text-xs"
              placeholder="~0.6.0"
              title="Type a custom semver range"
            />
          </div>
          {selectedSummary && (
            <p className="mt-1 text-[10px] text-muted-foreground">
              Installed: v{selectedSummary.version}
            </p>
          )}
        </div>
      )}

      {step.pieceName && (
        <div>
          <label className="mb-1 block text-xs font-medium">
            {isTrigger ? 'Trigger' : 'Action'}
          </label>
          {items.length === 0 && pieceDetail ? (
            <p className="text-xs text-muted-foreground">
              No {isTrigger ? 'triggers' : 'actions'} available
            </p>
          ) : (
            <Select
              value={step.actionOrTriggerName}
              onChange={(e) => {
                const name = e.target.value
                const meta = name ? items.find((i) => i.name === name) : null
                const propsInput: Record<string, string> = {}
                if (meta?.props) {
                  for (const [key, def] of Object.entries(meta.props) as [string, PiecePropDefinition][]) {
                    if (SKIPPED_PROP_TYPES.has(def.type)) continue
                    propsInput[key] = def.defaultValue != null ? String(def.defaultValue) : ''
                  }
                }
                onChange({ actionOrTriggerName: name, input: propsInput })
              }}
            >
              <option value="">Select...</option>
              {items.map((item) => (
                <option key={item.name} value={item.name}>
                  {item.displayName}
                </option>
              ))}
            </Select>
          )}
        </div>
      )}
    </>
  )
}

function PiecePropsEditor({
  pieceName,
  actionOrTriggerName,
  isTrigger,
  input,
  onChange,
  previousSteps,
}: {
  pieceName: string
  actionOrTriggerName: string
  isTrigger: boolean
  input: Record<string, string>
  onChange: (input: Record<string, string>) => void
  previousSteps: BuilderStep[]
}) {
  const { data: pieceDetail } = useQuery({
    queryKey: ['piece-detail-builder', pieceName],
    queryFn: () => api.pieces.get({ name: pieceName }),
    enabled: !!pieceName,
    staleTime: 5 * 60 * 1000,
  })

  const selectedMeta: PieceActionMeta | PieceTriggerMeta | null = useMemo(() => {
    if (!pieceDetail || !actionOrTriggerName) return null
    const source = isTrigger ? pieceDetail.triggers : pieceDetail.actions
    return source[actionOrTriggerName] ?? null
  }, [pieceDetail, actionOrTriggerName, isTrigger])

  const editableProps = useMemo(() => {
    if (!selectedMeta?.props) return []
    return Object.entries(selectedMeta.props).filter(
      ([, def]) => !SKIPPED_PROP_TYPES.has(def.type),
    )
  }, [selectedMeta])

  const [showVariables, setShowVariables] = useState(false)

  if (!selectedMeta) {
    return (
      <div className="rounded-md bg-muted/30 p-3">
        <p className="text-xs text-muted-foreground">Loading piece metadata...</p>
      </div>
    )
  }

  if (editableProps.length === 0) {
    return (
      <div className="rounded-md bg-muted/30 p-3">
        <p className="text-xs text-muted-foreground">
          This {isTrigger ? 'trigger' : 'action'} has no configurable parameters.
        </p>
        <InputEditor input={input} onChange={onChange} />
      </div>
    )
  }

  function updateProp(key: string, value: string) {
    onChange({ ...input, [key]: value })
  }

  function insertVariable(key: string, variable: string) {
    const current = input[key] ?? ''
    onChange({ ...input, [key]: current + variable })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium">
          Parameters ({editableProps.length})
        </label>
        <button
          type="button"
          onClick={() => setShowVariables(!showVariables)}
          className="flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-800"
        >
          <Info className="h-3 w-3" />
          {showVariables ? 'Hide' : 'Show'} flow variables
        </button>
      </div>

      {showVariables && (
        <FlowVariablesPanel
          previousSteps={previousSteps}
          onInsert={(variable) => {
            navigator.clipboard.writeText(variable)
          }}
        />
      )}

      {editableProps.map(([key, def]) => (
        <PropField
          key={key}
          propKey={key}
          definition={def}
          value={input[key] ?? (def.defaultValue != null ? String(def.defaultValue) : '')}
          onChange={(val) => updateProp(key, val)}
          onInsertVariable={(variable) => insertVariable(key, variable)}
          previousSteps={previousSteps}
        />
      ))}

      <details className="mt-2">
        <summary className="cursor-pointer text-[10px] text-muted-foreground hover:text-foreground">
          Advanced: custom input parameters
        </summary>
        <div className="mt-2">
          <InputEditor input={input} onChange={onChange} />
        </div>
      </details>
    </div>
  )
}

function PropField({
  propKey,
  definition,
  value,
  onChange,
  onInsertVariable,
  previousSteps,
}: {
  propKey: string
  definition: PiecePropDefinition
  value: string
  onChange: (value: string) => void
  onInsertVariable: (variable: string) => void
  previousSteps: BuilderStep[]
}) {
  const [showVarPicker, setShowVarPicker] = useState(false)

  return (
    <div className="rounded-md border p-2">
      <div className="mb-1 flex items-center gap-2">
        <label className="text-xs font-medium">
          {definition.displayName}
          {definition.required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
        <Badge variant="outline" className="text-[9px] px-1 py-0">
          {definition.type}
        </Badge>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setShowVarPicker(!showVarPicker)}
          className="text-[10px] text-blue-600 hover:text-blue-800"
          title="Insert flow variable reference"
        >
          {'{{}}'}
        </button>
      </div>

      {definition.description && (
        <p className="mb-1.5 text-[10px] text-muted-foreground leading-tight">
          {definition.description}
        </p>
      )}

      {showVarPicker && (
        <div className="mb-2">
          <FlowVariablesPanel
            previousSteps={previousSteps}
            onInsert={(variable) => {
              onInsertVariable(variable)
              setShowVarPicker(false)
            }}
          />
        </div>
      )}

      <PropInput definition={definition} value={value} onChange={onChange} propKey={propKey} />
    </div>
  )
}

function PropInput({
  definition,
  value,
  onChange,
}: {
  definition: PiecePropDefinition
  value: string
  onChange: (value: string) => void
  propKey: string
}) {
  switch (definition.type) {
    case 'STATIC_DROPDOWN':
    case 'STATIC_MULTI_SELECT_DROPDOWN': {
      const options = definition.options?.options ?? []
      return (
        <div className="space-y-1">
          <Select value={value} onChange={(e) => onChange(e.target.value)}>
            <option value="">Select...</option>
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="text-xs font-mono"
            placeholder="Or type a value / {{variable}}"
          />
        </div>
      )
    }

    case 'CHECKBOX':
      return (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={value === 'true'}
            onChange={(e) => onChange(String(e.target.checked))}
            className="h-4 w-4 rounded border"
          />
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="flex-1 text-xs font-mono"
            placeholder="true / false / {{variable}}"
          />
        </div>
      )

    case 'LONG_TEXT':
      return (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="text-xs font-mono"
          placeholder={`Enter ${definition.displayName.toLowerCase()}... or use {{step_1.field}}`}
        />
      )

    case 'NUMBER':
      return (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="text-xs font-mono"
          placeholder="Number or {{variable}}"
        />
      )

    case 'OBJECT':
    case 'JSON':
      return (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          className="text-xs font-mono"
          placeholder={'{\n  "key": "value"\n}'}
        />
      )

    case 'ARRAY':
      return (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="text-xs font-mono"
          placeholder={'["item1", "item2"]'}
        />
      )

    case 'DROPDOWN':
    case 'MULTI_SELECT_DROPDOWN':
      return (
        <div>
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="text-xs font-mono"
            placeholder="Type a value or {{variable}} (options load at runtime)"
          />
          <p className="mt-0.5 text-[9px] text-muted-foreground">
            Dynamic dropdown — options are loaded at runtime from the API
          </p>
        </div>
      )

    case 'SECRET_TEXT':
      return (
        <Input
          type="password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="text-xs font-mono"
          placeholder="Secret value or {{variable}}"
        />
      )

    case 'FILE':
      return (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="text-xs font-mono"
          placeholder="File URL or {{variable}}"
        />
      )

    case 'DATE_TIME':
      return (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="text-xs font-mono"
          placeholder="2026-01-01T00:00:00Z or {{variable}}"
        />
      )

    default:
      return (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="text-xs font-mono"
          placeholder={`Enter value or {{variable}}`}
        />
      )
  }
}

function FlowVariablesPanel({
  previousSteps,
  onInsert,
}: {
  previousSteps: BuilderStep[]
  onInsert: (variable: string) => void
}) {
  if (previousSteps.length === 0) {
    return (
      <div className="rounded bg-blue-50 p-2 text-[10px] text-blue-700">
        No previous steps available. This is the first step.
      </div>
    )
  }

  return (
    <div className="rounded border bg-muted/20 p-2">
      <p className="mb-1.5 text-[10px] font-medium text-muted-foreground">
        Click a variable to insert / copy it:
      </p>
      <div className="space-y-1.5">
        {previousSteps.map((s) => {
          const variables = getStepVariables(s)
          return (
            <div key={s.id}>
              <p className="text-[10px] font-medium">{s.displayName} ({s.id})</p>
              <div className="mt-0.5 flex flex-wrap gap-1">
                {variables.map((v) => (
                  <button
                    key={v.expression}
                    type="button"
                    onClick={() => onInsert(v.expression)}
                    className="inline-flex items-center gap-0.5 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-mono text-blue-800 hover:bg-blue-200 transition-colors"
                    title={v.description}
                  >
                    <Copy className="h-2.5 w-2.5" />
                    {v.expression}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function getStepVariables(step: BuilderStep): { expression: string; description: string }[] {
  const vars: { expression: string; description: string }[] = []
  const ref = step.id === 'trigger' ? 'trigger' : step.id

  if (step.kind === 'trigger') {
    vars.push(
      { expression: `{{${ref}}}`, description: 'Full trigger output' },
      { expression: `{{${ref}.body}}`, description: 'Webhook request body' },
      { expression: `{{${ref}.body.field}}`, description: 'Specific body field' },
      { expression: `{{${ref}.headers}}`, description: 'Request headers' },
      { expression: `{{${ref}.queryParams}}`, description: 'Query parameters' },
    )
  } else if (step.stepType === 'CODE') {
    vars.push(
      { expression: `{{${ref}}}`, description: 'Full code output' },
      { expression: `{{${ref}.property}}`, description: 'Specific output property' },
    )
  } else {
    vars.push(
      { expression: `{{${ref}}}`, description: 'Full action output' },
      { expression: `{{${ref}.property}}`, description: 'Specific output property' },
    )
  }

  return vars
}

function InputEditor({
  input,
  onChange,
}: {
  input: Record<string, string>
  onChange: (input: Record<string, string>) => void
}) {
  const [newKey, setNewKey] = useState('')
  const entries = Object.entries(input)

  function updateValue(key: string, value: string) {
    onChange({ ...input, [key]: value })
  }

  function removeKey(key: string) {
    const copy = { ...input }
    delete copy[key]
    onChange(copy)
  }

  function addKey() {
    const k = newKey.trim()
    if (!k || k in input) return
    onChange({ ...input, [k]: '' })
    setNewKey('')
  }

  return (
    <div>
      <label className="mb-1 block text-xs font-medium">
        Input Parameters ({entries.length})
      </label>
      {entries.length > 0 && (
        <div className="space-y-1">
          {entries.map(([k, v]) => (
            <div key={k} className="flex items-center gap-1">
              <span className="w-28 shrink-0 truncate text-xs font-medium text-muted-foreground" title={k}>
                {k}
              </span>
              <Input
                value={v}
                onChange={(e) => updateValue(k, e.target.value)}
                className="flex-1 text-xs"
                placeholder="value or {{trigger.body.field}}"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => removeKey(k)}
              >
                <Trash2 className="h-3 w-3 text-muted-foreground" />
              </Button>
            </div>
          ))}
        </div>
      )}
      <div className="mt-1 flex items-center gap-1">
        <Input
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          placeholder="New parameter name"
          className="flex-1 text-xs"
          onKeyDown={(e) => e.key === 'Enter' && addKey()}
        />
        <Button variant="outline" size="sm" onClick={addKey} className="text-xs">
          <Plus className="mr-1 h-3 w-3" /> Add
        </Button>
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Use {'{{trigger.body.field}}'} to reference webhook data or {'{{step_1.result}}'} for previous steps.
      </p>
    </div>
  )
}

function renumberSteps(steps: BuilderStep[]): BuilderStep[] {
  return steps.map((s, i) => {
    if (i === 0) return { ...s, id: 'trigger' }
    return { ...s, id: `step_${i}` }
  })
}
