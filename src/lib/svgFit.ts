/**
 * Makes a diagram SVG scale like an image: it keeps its proportions and shrinks to fit the
 * page (never wider than its natural size) instead of being squashed.
 *
 * PlantUML writes `preserveAspectRatio="none"` and a fixed `style="width:…px;height:…px"`;
 * in a narrow column the browser then squeezes a wide diagram (e.g. a long sequence
 * diagram) horizontally. Here: natural size → viewBox (added if missing), aspect ratio kept,
 * fixed sizes removed, `max-width` = natural width, `height: auto`.
 */
export function fitSvg(svg: string): string {
  if (!svg || typeof DOMParser === 'undefined') return svg
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml')
  const el = doc.documentElement
  if (!el || el.nodeName.toLowerCase() !== 'svg' || doc.getElementsByTagName('parsererror').length) return svg
  const num = (v: string | null) => {
    const n = parseFloat(v ?? '')
    return Number.isFinite(n) && n > 0 && !String(v).includes('%') ? n : null
  }
  const style = el.getAttribute('style') ?? ''
  const fromStyle = (prop: string) => num(new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([\\d.]+)px`, 'i').exec(style)?.[1] ?? null)
  const vb = (el.getAttribute('viewBox') ?? '').trim().split(/[\s,]+/).map(Number)
  const hasVb = vb.length === 4 && vb.every(Number.isFinite) && vb[2] > 0 && vb[3] > 0
  const w = num(el.getAttribute('width')) ?? fromStyle('width') ?? (hasVb ? vb[2] : null)
  const h = num(el.getAttribute('height')) ?? fromStyle('height') ?? (hasVb ? vb[3] : null)
  if (!w || !h) return svg
  if (!hasVb) el.setAttribute('viewBox', `0 0 ${w} ${h}`)
  el.setAttribute('preserveAspectRatio', 'xMidYMid meet')
  el.setAttribute('width', String(w))
  el.setAttribute('height', String(h))
  // Keep the rest of the inline style (e.g. background), drop fixed sizes.
  const rest = style
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s && !/^(width|height|max-width|min-width)\s*:/i.test(s))
  rest.push(`max-width:${w}px`, 'width:100%', 'height:auto')
  el.setAttribute('style', rest.join(';'))
  el.setAttribute('data-natural-width', String(w))
  return new XMLSerializer().serializeToString(el)
}
