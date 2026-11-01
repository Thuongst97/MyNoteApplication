import plantumlEncoder from 'plantuml-encoder'

/**
 * PlantUML diagrams are drawn by a PlantUML server (PlantUML itself is a Java program).
 * The default is the public server at plantuml.com; a self-hosted server
 * (e.g. `docker run -p 8080:8080 plantuml/plantuml-server`) keeps diagrams private.
 */
export const DEFAULT_PLANTUML_SERVER = 'https://www.plantuml.com/plantuml'

/** Largest diagram source sent to a server (URLs get too long beyond this). */
export const MAX_PLANTUML_SOURCE = 20_000

/** A usable http(s) server base URL without trailing slash, or null. */
export function normalizePlantUmlServer(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  try {
    const u = new URL(value.trim())
    if ((u.protocol !== 'https:' && u.protocol !== 'http:') || !u.hostname || u.username || u.password) return null
    u.search = ''
    u.hash = ''
    return u.toString().replace(/\/+$/, '')
  } catch {
    return null
  }
}

/** Adds @startuml/@enduml when the source has no @start… line. */
export function withStartEnd(source: string): string {
  return /^\s*@start\w+/m.test(source) ? source : `@startuml\n${source.trim()}\n@enduml`
}

/** URL of the SVG for `source` on `server`. */
export function plantUmlSvgUrl(server: string, source: string): string {
  return `${server}/svg/${plantumlEncoder.encode(withStartEnd(source))}`
}

export function decodePlantUml(encoded: string): string {
  return plantumlEncoder.decode(encoded)
}
