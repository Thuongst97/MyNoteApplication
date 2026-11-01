import { useEffect, useMemo, useState } from 'react'
import type { NodeViewProps } from '@tiptap/react'
import { Loader2, Network } from 'lucide-react'
import { api } from '@/lib/api'
import { sanitizeSvg } from '@/lib/sanitize'
import { DEFAULT_PLANTUML_SERVER } from '@/lib/plantuml'
import { setPlantUmlServer, usePlantUmlServer } from '@/lib/plantumlSettings'
import { SourceBlockView, type SourceKind } from '../markdown/SourceBlockView'

export const PLANTUML_TEMPLATE = `@startuml
actor User
participant "PremiumNote" as App
database Pages

User -> App: Write a note
App -> Pages: Save
Pages --> App: OK
App --> User: Saved ✓
@enduml
`

/** The diagram, drawn by the PlantUML server (sanitized SVG). */
export function PlantUmlRender({ source, className }: { source: string; className?: string }) {
  const server = usePlantUmlServer()
  const [state, setState] = useState<{ svg?: string; error?: string; loading: boolean }>({ loading: true })
  useEffect(() => {
    let cancelled = false
    setState((s) => ({ ...s, loading: true }))
    void api.renderPlantUml(server, source).then(
      (r) => !cancelled && setState('svg' in r ? { svg: r.svg, loading: false } : { error: r.error, loading: false }),
      (err) => !cancelled && setState({ error: String(err?.message ?? err), loading: false }),
    )
    return () => {
      cancelled = true
    }
  }, [server, source])
  const svg = useMemo(() => (state.svg ? sanitizeSvg(state.svg) : ''), [state.svg])
  return (
    <div className={`plantuml-render relative ${className ?? ''}`}>
      {svg ? (
        <div className="plantuml-svg flex justify-center overflow-x-auto" dangerouslySetInnerHTML={{ __html: svg }} />
      ) : state.error ? (
        <div className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">{state.error}</div>
      ) : null}
      {state.loading && (
        <div className="flex items-center justify-center gap-2 py-3 text-xs opacity-50">
          <Loader2 size={14} className="animate-spin" /> Rendering diagram…
        </div>
      )}
    </div>
  )
}

/** Where diagrams are rendered; editable (e.g. a private, self-hosted server). */
function ServerSetting() {
  const server = usePlantUmlServer()
  const [draft, setDraft] = useState(server)
  const [bad, setBad] = useState(false)
  useEffect(() => setDraft(server), [server])
  const apply = () => {
    if (draft.trim() === '') return setPlantUmlServer(null)
    const before = draft
    const used = setPlantUmlServer(draft)
    setBad(used !== before.trim().replace(/\/+$/, '') && before.trim() !== '')
  }
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
      <span className="opacity-60">Rendered by</span>
      <input
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value)
          setBad(false)
        }}
        onBlur={apply}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === 'Enter') {
            e.preventDefault()
            apply()
          }
        }}
        aria-label="PlantUML server"
        spellCheck={false}
        className="min-w-0 flex-1 rounded border border-black/10 bg-white px-2 py-0.5 font-mono outline-none focus:border-blue-400 dark:border-white/10 dark:bg-[#191919]"
      />
      {server !== DEFAULT_PLANTUML_SERVER && (
        <button type="button" className="underline opacity-60 hover:opacity-100" onClick={() => setPlantUmlServer(null)}>
          Use plantuml.com
        </button>
      )}
      <span className={bad ? 'text-red-500' : 'opacity-45'}>
        {bad ? 'Not a valid http(s) address' : 'The diagram text is sent to this server to draw it. Use your own server to keep diagrams private.'}
      </span>
    </div>
  )
}

export const PLANTUML_KIND: SourceKind = {
  name: 'PlantUML',
  icon: Network,
  hint: 'PlantUML — sequence, class, activity, state, component, Gantt, mind map…',
  help: { url: 'https://plantuml.com/', label: 'PlantUML guide' },
  template: PLANTUML_TEMPLATE,
  Render: PlantUmlRender,
  EditorFooter: ServerSetting,
  expandable: true,
  borderToggle: true,
}

export function PlantUmlView(props: NodeViewProps) {
  return <SourceBlockView {...props} kind={PLANTUML_KIND} />
}
