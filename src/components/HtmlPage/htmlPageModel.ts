/** Content of an HTML page: one web page that fills the whole page area. */
export interface HtmlPageContent {
  type: 'htmlPage'
  source: string
  /** Run JavaScript (sandboxed). */
  interactive: boolean
  allowNetwork: boolean
  /** False for pages imported from someone else: scripts wait for Run. */
  trusted: boolean
}

/** Starter page: a small, self-contained interactive web page. */
export const HTML_PAGE_TEMPLATE = `<style>
  body { font-family: system-ui, sans-serif; }
  .hero { min-height: 70vh; display: grid; place-items: center; text-align: center; }
  h1 { font-size: 44px; margin: 0 0 8px; letter-spacing: -0.02em; }
  p { opacity: .7; }
  button { font: inherit; padding: 10px 18px; border-radius: 10px; border: 0; background: #2563eb; color: #fff; cursor: pointer; }
</style>
<div class="hero">
  <div>
    <h1>My web page</h1>
    <p>Edit the code to build anything: a dashboard, a calculator, a demo…</p>
    <button id="btn">Clicked 0 times</button>
  </div>
</div>
<script>
  let n = 0
  document.getElementById('btn').onclick = (e) => { n++; e.target.textContent = 'Clicked ' + n + ' times' }
</script>`

export function newHtmlPageContent(): HtmlPageContent {
  return { type: 'htmlPage', source: HTML_PAGE_TEMPLATE, interactive: true, allowNetwork: false, trusted: true }
}

/** Makes stored content safe to use (missing fields get their defaults). */
export function normalizeHtmlPage(c: unknown): HtmlPageContent {
  const o = (c && typeof c === 'object' ? c : {}) as Partial<HtmlPageContent>
  return {
    type: 'htmlPage',
    source: typeof o.source === 'string' ? o.source : '',
    interactive: o.interactive !== false,
    allowNetwork: o.allowNetwork === true,
    trusted: o.trusted !== false,
  }
}
