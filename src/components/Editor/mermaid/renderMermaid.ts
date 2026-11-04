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

/** Tags that never belong in a diagram label (they load things or run code). */
const DANGEROUS_TAGS = /^(script|style|iframe|frame|object|embed|img|image|svg|math|video|audio|source|picture|link|meta|base|form|input|textarea|select|button|details|dialog|template|foreignobject|a|marquee)$/i

/**
 * Removes HTML that could run code from diagram text *before* mermaid sees it. Mermaid puts
 * label HTML into the page for a moment to measure it before cleaning it, so event handlers
 * in labels would reach the live page (the app's CSP blocks them; this removes them first).
 * Normal diagram syntax (-->, <|--, <<interface>>, <br>, <b>…) is unchanged.
 */
export function defangMermaid(code: string): string {
  return code
    .replace(/<\/?([a-zA-Z][\w:-]*)(\s[^<>]*)?\/?>/g, (tag, name: string, attrs: string | undefined) => {
      if (DANGEROUS_TAGS.test(name)) return ''
      // Keep simple formatting tags, but never their attributes (onclick, style, href…).
      if (!attrs) return tag
      return tag.startsWith('</') ? `</${name}>` : `<${name}>`
    })
    .replace(/\b(javascript|vbscript|data)\s*:/gi, '$1-blocked:')
}

/** Vivid categorical colors (same family as charts), readable on the dark page. */
const DARK_SERIES = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#3f9f3f', '#9085e9', '#e66767', '#22a6b8', '#b07a4a', '#7b8794', '#c05bd6']

/**
 * Dark diagrams: mermaid's own "dark" theme draws nodes almost the color of the page, pies and
 * mind maps in near-black, and labels on muddy gray. This palette (on mermaid's customizable
 * "base" theme) gives raised, blue-tinted nodes with clear borders, light text and lines,
 * readable label chips, amber notes, and vivid slices / branches.
 */
export const DARK_THEME_VARIABLES: Record<string, string | boolean> = {
  darkMode: true,
  background: '#191919',
  fontSize: '15px',
  // General / flowchart
  primaryColor: '#233650',
  primaryTextColor: '#eef2f7',
  primaryBorderColor: '#6f95d3',
  secondaryColor: '#3b2f52',
  secondaryTextColor: '#eef2f7',
  secondaryBorderColor: '#a08ad8',
  tertiaryColor: '#262b33',
  tertiaryTextColor: '#e6e8eb',
  tertiaryBorderColor: '#5d6673',
  mainBkg: '#233650',
  nodeBorder: '#6f95d3',
  nodeTextColor: '#eef2f7',
  textColor: '#e6e8eb',
  titleColor: '#eef2f7',
  lineColor: '#a9b4c6',
  arrowheadColor: '#a9b4c6',
  edgeLabelBackground: '#2c323c',
  clusterBkg: '#20252c',
  clusterBorder: '#56606e',
  // Notes
  noteBkgColor: '#4a3e17',
  noteTextColor: '#f6e7b5',
  noteBorderColor: '#b8963c',
  // Sequence
  actorBkg: '#233650',
  actorBorder: '#6f95d3',
  actorTextColor: '#eef2f7',
  actorLineColor: '#7d8899',
  signalColor: '#d6dbe3',
  signalTextColor: '#e6e8eb',
  labelBoxBkgColor: '#2c323c',
  labelBoxBorderColor: '#6b7482',
  labelTextColor: '#e6e8eb',
  loopTextColor: '#e6e8eb',
  activationBkgColor: '#2f4766',
  activationBorderColor: '#6f95d3',
  sequenceNumberColor: '#111418',
  // Class / state / ER
  classText: '#eef2f7',
  labelColor: '#e6e8eb',
  altBackground: '#20252c',
  compositeBackground: '#20252c',
  compositeTitleBackground: '#2c323c',
  compositeBorder: '#56606e',
  stateBkg: '#233650',
  stateLabelColor: '#eef2f7',
  stateBorder: '#6f95d3',
  transitionColor: '#a9b4c6',
  transitionLabelColor: '#e6e8eb',
  innerEndBackground: '#a9b4c6',
  specialStateColor: '#a9b4c6',
  attributeBackgroundColorOdd: '#262b33',
  attributeBackgroundColorEven: '#20252c',
  relationColor: '#a9b4c6',
  relationLabelColor: '#e6e8eb',
  relationLabelBackground: '#2c323c',
  // Gantt
  sectionBkgColor: '#232831',
  altSectionBkgColor: '#1d2127',
  sectionBkgColor2: '#232831',
  taskBkgColor: '#3c71b8',
  taskBorderColor: '#7da4e0',
  taskTextColor: '#ffffff',
  taskTextLightColor: '#eef2f7',
  taskTextDarkColor: '#ffffff',
  taskTextOutsideColor: '#e6e8eb',
  taskTextClickableColor: '#9cc2ff',
  activeTaskBkgColor: '#5a8fdb',
  activeTaskBorderColor: '#a9c8f2',
  doneTaskBkgColor: '#4b5563',
  doneTaskBorderColor: '#7b8794',
  critBkgColor: '#b8423e',
  critBorderColor: '#e66767',
  gridColor: '#3b414a',
  todayLineColor: '#e66767',
  // Pie
  pieTitleTextColor: '#eef2f7',
  pieSectionTextColor: '#ffffff',
  pieLegendTextColor: '#e6e8eb',
  pieStrokeColor: '#191919',
  pieOuterStrokeColor: '#191919',
  pieStrokeWidth: '2px',
  pieOpacity: '1',
  // Git graph
  git0: DARK_SERIES[0],
  git1: DARK_SERIES[1],
  git2: DARK_SERIES[2],
  git3: DARK_SERIES[3],
  git4: DARK_SERIES[4],
  git5: DARK_SERIES[5],
  git6: DARK_SERIES[6],
  git7: DARK_SERIES[7],
  gitBranchLabel0: '#ffffff',
  commitLabelColor: '#e6e8eb',
  commitLabelBackground: '#2c323c',
  tagLabelColor: '#111418',
  tagLabelBackground: '#c98500',
  // Quadrant chart
  quadrant1Fill: '#233650',
  quadrant2Fill: '#2a2440',
  quadrant3Fill: '#20252c',
  quadrant4Fill: '#1f3329',
  quadrant1TextFill: '#eef2f7',
  quadrant2TextFill: '#eef2f7',
  quadrant3TextFill: '#eef2f7',
  quadrant4TextFill: '#eef2f7',
  quadrantPointFill: '#e66767',
  quadrantTitleFill: '#eef2f7',
  quadrantXAxisTextFill: '#e6e8eb',
  quadrantYAxisTextFill: '#e6e8eb',
  ...Object.fromEntries(DARK_SERIES.map((c, i) => [`pie${i + 1}`, c])),
  // Mind map / timeline / journey sections
  ...Object.fromEntries(DARK_SERIES.map((c, i) => [`cScale${i}`, c])),
  ...Object.fromEntries(DARK_SERIES.map((_, i) => [`cScaleLabel${i}`, '#ffffff'])),
  ...Object.fromEntries(DARK_SERIES.map((c, i) => [`cScalePeer${i}`, c])),
}

/** Mermaid settings for the app's theme. */
export function mermaidThemeConfig(theme: Theme) {
  return theme === 'dark' ? { theme: 'base' as const, themeVariables: DARK_THEME_VARIABLES } : { theme: 'default' as const }
}

export interface MermaidResult {
  svg?: string
  error?: string
}

/**
 * Where mermaid measures labels before drawing boxes around them. Diagrams are shown inside the
 * page (`.notion-editor`, Markdown blocks), whose styles for bold text, inline `code` pills and
 * line height differ from the bare page body; measuring with those same styles keeps labels from
 * being cut off.
 */
let measureHost: HTMLElement | null = null
function measuringHost(): HTMLElement {
  if (measureHost?.isConnected) return measureHost
  measureHost = document.createElement('div')
  measureHost.className = 'notion-editor markdown-body mermaid-measure'
  measureHost.setAttribute('aria-hidden', 'true')
  Object.assign(measureHost.style, { position: 'fixed', left: '-100000px', top: '0', width: '4000px', visibility: 'hidden', pointerEvents: 'none' })
  document.body.appendChild(measureHost)
  return measureHost
}

/**
 * Renders mermaid code to an SVG string. Renders are run one at a time,
 * because mermaid keeps global state while rendering.
 */
export function renderMermaid(code: string, theme: Theme): Promise<MermaidResult> {
  const job = queue.then(async (): Promise<MermaidResult> => {
    const trimmed = defangMermaid(code.trim())
    if (!trimmed) return { error: 'Empty diagram' }
    const mermaid = await loadMermaid()
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      ...mermaidThemeConfig(theme),
      fontFamily: 'ui-sans-serif, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif',
    })
    const id = `mermaid-${Date.now().toString(36)}-${counter++}`
    try {
      await mermaid.parse(trimmed)
      const host = measuringHost()
      const { svg } = await mermaid.render(id, trimmed, host)
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
