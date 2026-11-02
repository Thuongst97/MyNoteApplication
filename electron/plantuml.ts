import { MAX_PLANTUML_SOURCE, normalizePlantUmlServer, plantUmlSvgUrl } from '../src/lib/plantuml'

export type PlantUmlResult = { svg: string } | { error: string }

const MAX_SVG_BYTES = 5 * 1024 * 1024
const TIMEOUT_MS = 15_000
const cache = new Map<string, string>()
/** Total size of cached diagrams (they can be big; keep memory bounded). */
const CACHE_BUDGET = 8 * 1024 * 1024
let cached = 0

/**
 * Fetches a diagram's SVG from a PlantUML server (main process: no CSP / CORS issues).
 * Syntax errors come back from the server as an SVG showing the error, which is shown as is.
 * `fetchImpl` is injectable for tests.
 */
export async function renderPlantUml(serverInput: unknown, source: unknown, fetchImpl: typeof fetch): Promise<PlantUmlResult> {
  const server = normalizePlantUmlServer(serverInput)
  if (!server) return { error: 'The PlantUML server address is not a valid http(s) URL.' }
  if (typeof source !== 'string' || !source.trim()) return { error: 'Empty diagram.' }
  if (source.length > MAX_PLANTUML_SOURCE) return { error: 'This diagram is too large to render.' }
  const url = plantUmlSvgUrl(server, source)
  const hit = cache.get(url)
  if (hit) return { svg: hit }
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    // Redirects are followed by hand: at most 3, and only to http(s) (never to file:, the
    // app's own schemes or anything else a server might point at).
    let target = url
    let res = await fetchImpl(target, { signal: ctrl.signal, redirect: 'manual', credentials: 'omit' })
    for (let hops = 0; res.status >= 300 && res.status < 400 && res.headers.get('location'); hops++) {
      const next = new URL(res.headers.get('location')!, target)
      if (hops >= 3 || (next.protocol !== 'https:' && next.protocol !== 'http:')) return { error: 'The PlantUML server redirected to an address that is not allowed.' }
      target = next.toString()
      res = await fetchImpl(target, { signal: ctrl.signal, redirect: 'manual', credentials: 'omit' })
    }
    const type = res.headers.get('content-type') ?? ''
    const text = await res.text()
    if (!/svg/i.test(type) || !/<svg[\s>]/i.test(text)) return { error: `The server didn't return a diagram (HTTP ${res.status}).` }
    if (text.length > MAX_SVG_BYTES) return { error: 'The diagram is too large.' }
    if (res.ok && text.length <= CACHE_BUDGET / 4) {
      cache.set(url, text)
      cached += text.length
      while (cached > CACHE_BUDGET && cache.size) {
        const [oldUrl, oldSvg] = cache.entries().next().value!
        cache.delete(oldUrl)
        cached -= oldSvg.length
      }
    }
    return { svg: text }
  } catch (err) {
    const aborted = (err as Error)?.name === 'AbortError'
    return { error: aborted ? 'The PlantUML server did not answer in time.' : `Couldn't reach the PlantUML server (${new URL(server).host}). Check your connection or the server address.` }
  } finally {
    clearTimeout(timer)
  }
}

/** For tests. */
export function clearPlantUmlCache() {
  cache.clear()
  cached = 0
}
