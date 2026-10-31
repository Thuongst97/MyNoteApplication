/** Tiny className joiner (shadcn-style `cn`). */
export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

export function newId() {
  return crypto.randomUUID()
}

export const isMacLike = () =>
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
