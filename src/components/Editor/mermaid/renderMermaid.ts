import type { Theme } from '@/stores/useAppStore'

type MermaidApi = typeof import('mermaid').default

let mermaidPromise: Promise<MermaidApi> | null = null
let queue: Promise<unknown> = Promise.resolve()
let counter = 0

/** Loads mermaid on first use (it's large, so it isn't part of the startup bundle). */
function loadMermaid() {
  if (!mermaidPromise) mermaidPromise = import('mermaid').then((m) => m.default)
  return mermaidPromise
}

export interface MermaidResult {
  svg?: string
  error?: string
}

/**
 * Renders mermaid code to an SVG string. Renders are run one at a time,
 * because mermaid keeps global state while rendering.
 */
export function renderMermaid(code: string, theme: Theme): Promise<MermaidResult> {
  const job = queue.then(async (): Promise<MermaidResult> => {
    const trimmed = code.trim()
    if (!trimmed) return { error: 'Empty diagram' }
    const mermaid = await loadMermaid()
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: theme === 'dark' ? 'dark' : 'default',
      fontFamily: 'ui-sans-serif, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif',
    })
    const id = `mermaid-${Date.now().toString(36)}-${counter++}`
    try {
      await mermaid.parse(trimmed)
      const { svg } = await mermaid.render(id, trimmed)
      return { svg }
    } catch (err) {
      // mermaid may leave a temporary element behind on errors.
      document.getElementById(id)?.remove()
      document.getElementById(`d${id}`)?.remove()
      const message = (err as Error)?.message ?? String(err)
      return { error: message.replace(/^Error:\s*/, '') }
    }
  })
  queue = job.catch(() => undefined)
  return job
}

/** Quick check used to recognise pasted mermaid code. */
export const MERMAID_START =
  /^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram(-v2)?|erDiagram|journey|gantt|pie|quadrantChart|requirementDiagram|gitGraph|mindmap|timeline|sankey(-beta)?|xychart(-beta)?|block(-beta)?|packet(-beta)?|kanban|architecture(-beta)?|C4Context|C4Container|C4Component|C4Dynamic|C4Deployment|radar(-beta)?|treemap(-beta)?)\b/

export const MERMAID_TEMPLATE = `flowchart LR
  A[Idea] --> B{Worth it?}
  B -- Yes --> C[Build it]
  B -- No --> D[Skip]`
