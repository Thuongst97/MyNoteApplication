/**
 * Clears the "user ran these scripts" mark of every interactive HTML block in page content
 * (any shape: documents, presentations…). Used on import: scripts from another person's
 * page wait for the user to press Run.
 */
export function untrustScripts<T>(value: T): T {
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk)
    if (!v || typeof v !== 'object') return v
    const o = v as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const [k, x] of Object.entries(o)) out[k] = walk(x)
    if (o.type === 'htmlBlock' && out.attrs && typeof out.attrs === 'object') out.attrs = { ...(out.attrs as object), trusted: false }
    return out
  }
  return walk(value) as T
}
