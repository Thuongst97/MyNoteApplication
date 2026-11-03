import type { JSONContent } from '@tiptap/react'

/** Internal link format: notionclone://page/<pageId>[#<blockId>] */
export const LINK_SCHEME = 'notionclone:'

export function pageUrl(pageId: string, blockId?: string | null) {
  return `notionclone://page/${pageId}${blockId ? `#${blockId}` : ''}`
}

export function parsePageUrl(url: string | null | undefined): { pageId: string; blockId: string | null } | null {
  const m = /^notionclone:\/\/page\/([A-Za-z0-9_-]{1,64})(?:#([A-Za-z0-9_-]{1,64}))?\s*$/.exec(String(url ?? '').trim())
  return m ? { pageId: m[1], blockId: m[2] ?? null } : null
}

/** Ids of pages a document/whiteboard links to (mentions, page blocks, links, whiteboard element links). */
export function extractLinks(content: unknown): string[] {
  const out = new Set<string>()
  const visit = (node: JSONContent | undefined) => {
    if (!node || typeof node !== 'object') return
    if ((node.type === 'mention' || node.type === 'pageLink') && typeof node.attrs?.pageId === 'string') out.add(node.attrs.pageId)
    for (const mark of node.marks ?? []) {
      const p = mark.type === 'link' ? parsePageUrl(mark.attrs?.href) : null
      if (p) out.add(p.pageId)
    }
    if (node.type === 'drawing') scanScene(node.attrs?.data?.scene)
    node.content?.forEach(visit)
  }
  const scanScene = (scene: { elements?: Array<{ link?: string | null; isDeleted?: boolean }> } | undefined) => {
    for (const el of scene?.elements ?? []) {
      const p = !el.isDeleted ? parsePageUrl(el.link) : null
      if (p) out.add(p.pageId)
    }
  }
  const c = content as { type?: string; scene?: unknown } | null
  if (c?.type === 'whiteboard') scanScene(c.scene as never)
  else if (c?.type === 'slides') for (const s of (c as { slides?: Array<{ content?: JSONContent }> }).slides ?? []) visit(s.content)
  else visit(c as JSONContent)
  return [...out]
}
