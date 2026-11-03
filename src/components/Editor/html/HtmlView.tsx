import { useState } from 'react'
import type { NodeViewProps } from '@tiptap/react'
import { CodeXml, Globe, Play, Zap } from 'lucide-react'
import { SourceBlockView, type SourceKind, type SourceRenderProps } from '../markdown/SourceBlockView'
import { HtmlRender } from './HtmlRender'
import { HtmlSandbox } from './HtmlSandbox'
import { useStaticBlocks } from '../staticBlocks'
import { sanitizeHtml } from '@/lib/html'

export const INTERACTIVE_TEMPLATE = `<style>
  .counter { display: flex; align-items: center; gap: 12px; padding: 16px 20px; border-radius: 12px; background: #e7f3f8; color: #1f2937; }
  .counter button { font: inherit; padding: 6px 14px; border-radius: 8px; border: 0; background: #2383e2; color: #fff; cursor: pointer; }
  .counter output { font-size: 24px; font-weight: 600; min-width: 2ch; text-align: center; }
</style>
<div class="counter">
  <button id="minus">−</button>
  <output id="value">0</output>
  <button id="plus">+</button>
  <span>Click the buttons — this block runs JavaScript.</span>
</div>
<script>
  let n = 0
  const show = () => (document.getElementById('value').textContent = n)
  document.getElementById('plus').onclick = () => { n++; show() }
  document.getElementById('minus').onclick = () => { n--; show() }
</script>
`

export const HTML_TEMPLATE = `<style>
  .card { padding: 16px 20px; border-radius: 12px; background: #f4ece6; }
  .card h2 { margin: 0 0 6px; }
</style>
<div class="card">
  <h2>Hello!</h2>
  <p>Write <b>HTML</b> and <i>CSS</i> here. Styles only apply inside this block.</p>
</div>
`

export const HTML_KIND: SourceKind = {
  name: 'HTML',
  icon: CodeXml,
  hint: 'HTML & CSS (styles stay inside this block). Turn on JavaScript below for buttons and interactive content.',
  help: { url: 'https://developer.mozilla.org/en-US/docs/Web/HTML', label: 'HTML reference' },
  template: HTML_TEMPLATE,
  Render: HtmlBlockRender,
  EditorFooter: ScriptSettings,
  draftAttrs: ['interactive', 'allowNetwork', 'trusted'],
  // Saving scripts you've just written/reviewed counts as running them.
  onSaveAttrs: (d) => ({ ...d, trusted: d.interactive ? true : d.trusted }),
  // Styles can't carry over into normal blocks; drop them.
  toBlocksHtml: (source) => sanitizeHtml(source).replace(/<style[\s\S]*?<\/style>/gi, ''),
}

/** HTML block: sanitized HTML rendered in its own style scope; Edit to change the source. */
export function HtmlView(props: NodeViewProps) {
  return <SourceBlockView {...props} kind={HTML_KIND} />
}

/**
 * Plain HTML is sanitized and shown in a style scope. With JavaScript on, the block runs in a
 * sandboxed frame — but scripts that came from elsewhere (imported or pasted) wait for Run.
 */
export function HtmlBlockRender({ source, className, attrs, setAttrs }: SourceRenderProps) {
  const still = useStaticBlocks()
  const [ranHere, setRanHere] = useState(false)
  if (!attrs?.interactive) return <HtmlRender source={source} className={className} />
  if (still) {
    return (
      <div className="relative">
        <HtmlRender source={source} className={className} />
        <span className="absolute right-1 top-1 flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[11px] text-white">
          <Zap size={11} /> Interactive
        </span>
      </div>
    )
  }
  if (!attrs.trusted && !ranHere) {
    return (
      <div className="rounded-md border border-dashed border-amber-500/50 bg-amber-500/[0.06]">
        <div className="flex items-center gap-2 px-3 py-2 text-xs">
          <Zap size={13} className="shrink-0 text-amber-600" />
          <span className="opacity-80">This block runs JavaScript from an imported or pasted page. It runs sandboxed{attrs.allowNetwork ? ', with internet access' : ', without internet access'}.</span>
          <button
            type="button"
            onClick={() => {
              setRanHere(true)
              setAttrs?.({ trusted: true })
            }}
            className="ml-auto flex shrink-0 items-center gap-1 rounded-md bg-amber-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-700"
          >
            <Play size={12} fill="currentColor" /> Run
          </button>
        </div>
        <div className="border-t border-amber-500/20 px-1 py-1">
          <HtmlRender source={source} className={className} />
        </div>
      </div>
    )
  }
  return <HtmlSandbox source={source} allowNetwork={!!attrs.allowNetwork} />
}

/** "Run JavaScript" and "Allow internet access" switches under the HTML editor. */
function ScriptSettings({ attrs, setAttrs }: { attrs: Record<string, unknown>; setAttrs: (p: Record<string, unknown>) => void }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
      <label className="flex cursor-pointer items-center gap-1.5">
        <input type="checkbox" checked={!!attrs.interactive} onChange={(e) => setAttrs(e.target.checked ? { interactive: true, trusted: true } : { interactive: false })} className="accent-blue-500" />
        <Zap size={13} className="opacity-70" /> Run JavaScript <span className="opacity-50">(sandboxed: no access to your notes or the app)</span>
      </label>
      {!!attrs.interactive && (
        <label className="flex cursor-pointer items-center gap-1.5">
          <input type="checkbox" checked={!!attrs.allowNetwork} onChange={(e) => setAttrs({ allowNetwork: e.target.checked })} className="accent-blue-500" />
          <Globe size={13} className="opacity-70" /> Allow internet access <span className="opacity-50">(load libraries, fetch data over https)</span>
        </label>
      )}
      {!!attrs.interactive && (
        <span className="opacity-50">
          Tip: <code>&lt;script src="https://cdn…"&gt;</code> needs internet access.
        </span>
      )}
    </div>
  )
}
