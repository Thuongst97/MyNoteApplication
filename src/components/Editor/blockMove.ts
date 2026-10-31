import { Extension, type Editor } from '@tiptap/react'
import { NodeSelection, TextSelection, type EditorState } from '@tiptap/pm/state'
import type { Node as PMNode } from '@tiptap/pm/model'
import type { EditorView } from '@tiptap/pm/view'

/** List items move on their own (like Notion); everything else moves as a top-level block. */
const ITEM_TYPES = new Set(['listItem', 'taskItem'])

export interface BlockTarget {
  pos: number
  node: PMNode
}

/** The movable block around a document position. */
export function blockAt(state: EditorState, pos: number): BlockTarget | null {
  const doc = state.doc
  if (pos < 0 || pos > doc.content.size) return null
  const $pos = doc.resolve(pos)
  for (let d = $pos.depth; d >= 1; d--) {
    if (ITEM_TYPES.has($pos.node(d).type.name)) return { pos: $pos.before(d), node: $pos.node(d) }
  }
  if ($pos.depth >= 1) return { pos: $pos.before(1), node: $pos.node(1) }
  // Between top-level blocks, or on a top-level atom (image, diagram, divider).
  const after = $pos.nodeAfter
  return after ? { pos, node: after } : null
}

/** The block the selection is in (or the selected block itself). */
export function blockAtSelection(state: EditorState): BlockTarget | null {
  const sel = state.selection
  if (sel instanceof NodeSelection) {
    // A selected list item/atom is the block; a node selected inside a list item moves the item.
    const inner = blockAt(state, sel.from + 1)
    if (inner && ITEM_TYPES.has(inner.node.type.name) && inner.pos < sel.from) return inner
    return { pos: sel.from, node: sel.node }
  }
  return blockAt(state, sel.from)
}

/**
 * Swaps a block with its previous/next sibling. Keeps the cursor/selection on the
 * moved block. Returns false when it can't move further.
 */
export function moveBlock(editor: Editor, dir: 'up' | 'down', target = blockAtSelection(editor.state)) {
  if (!target) return false
  const { state } = editor
  const $start = state.doc.resolve(target.pos)
  const parent = $start.parent
  const index = $start.index()
  const siblingIndex = dir === 'up' ? index - 1 : index + 1
  if (siblingIndex < 0 || siblingIndex >= parent.childCount) return false
  const sibling = parent.child(siblingIndex)
  const node = target.node

  const tr = state.tr
  const from = dir === 'up' ? target.pos - sibling.nodeSize : target.pos
  const to = dir === 'up' ? target.pos + node.nodeSize : target.pos + node.nodeSize + sibling.nodeSize
  tr.replaceWith(from, to, dir === 'up' ? [node, sibling] : [sibling, node])

  const shift = dir === 'up' ? -sibling.nodeSize : sibling.nodeSize
  const sel = state.selection
  try {
    if (sel instanceof NodeSelection) {
      tr.setSelection(NodeSelection.create(tr.doc, sel.from + shift))
    } else if (sel.from >= target.pos && sel.to <= target.pos + node.nodeSize) {
      tr.setSelection(TextSelection.create(tr.doc, sel.anchor + shift, sel.head + shift))
    } else {
      // Moved from the handle menu: select the moved block.
      tr.setSelection(NodeSelection.create(tr.doc, target.pos + shift))
    }
  } catch {
    // Selection couldn't be restored exactly; leave ProseMirror's mapped selection.
  }
  editor.view.dispatch(tr.scrollIntoView())
  return true
}

export function duplicateBlock(editor: Editor, target: BlockTarget) {
  const end = target.pos + target.node.nodeSize
  const attrs = target.node.attrs.blockId ? { ...target.node.attrs, blockId: null } : target.node.attrs
  const tr = editor.state.tr.insert(end, target.node.type.create(attrs, target.node.content, target.node.marks))
  tr.setSelection(NodeSelection.create(tr.doc, end))
  editor.view.dispatch(tr.scrollIntoView())
}

export function deleteBlock(editor: Editor, target: BlockTarget) {
  editor.chain().focus().deleteRange({ from: target.pos, to: target.pos + target.node.nodeSize }).run()
}

/** Ctrl/Cmd+Shift+↑/↓ moves the current block (Notion's shortcut). */
export const MoveBlockShortcuts = Extension.create({
  name: 'moveBlockShortcuts',
  addKeyboardShortcuts() {
    return {
      'Mod-Shift-ArrowUp': ({ editor }) => {
        moveBlock(editor, 'up')
        return true
      },
      'Mod-Shift-ArrowDown': ({ editor }) => {
        moveBlock(editor, 'down')
        return true
      },
    }
  },
})

// ---------------------------------------------------------------------------
// Drag & drop of blocks via the handle
// ---------------------------------------------------------------------------

/** The block currently being dragged by its handle (null when no handle drag is active). */
export const blockDrag: { current: BlockTarget | null } = { current: null }

export interface BlockDrop {
  /** Document position to insert at (before mapping the deletion of the source). */
  insertPos: number
  /** Wrap the dragged list item in a list of its own (dropping it outside its list). */
  wrapInList: boolean
  /** Where to draw the drop line (viewport coordinates). */
  line: { top: number; left: number; width: number }
}

const isItem = (n: PMNode) => ITEM_TYPES.has(n.type.name)

/** Works out where a dragged block would land for the given pointer position. */
export function computeBlockDrop(view: EditorView, source: BlockTarget, clientX: number, clientY: number): BlockDrop | null {
  const { state } = view
  const content = view.dom.getBoundingClientRect()
  const x = Math.min(Math.max(clientX, content.left + 2), content.right - 2)
  const sourceParent = state.doc.resolve(source.pos).parent

  let target: BlockTarget | null = null
  const hit = view.posAtCoords({ left: x, top: clientY })
  if (hit) target = blockAt(state, hit.inside >= 0 ? hit.inside : hit.pos)

  // Pointer below the last block: drop at the very end.
  const last = state.doc.lastChild
  if (!target || (last && clientY > (view.nodeDOM(state.doc.content.size - last.nodeSize) as HTMLElement)?.getBoundingClientRect().bottom)) {
    if (!last) return null
    target = { pos: state.doc.content.size - last.nodeSize, node: last }
    const rect = (view.nodeDOM(target.pos) as HTMLElement).getBoundingClientRect()
    return {
      insertPos: state.doc.content.size,
      wrapInList: isItem(source.node),
      line: { top: rect.bottom + 2, left: content.left, width: content.width },
    }
  }

  // Decide the level we drop at.
  let wrapInList = false
  if (isItem(source.node)) {
    const targetParent = state.doc.resolve(target.pos).parent
    if (!(isItem(target.node) && targetParent.type === sourceParent.type)) {
      // Leaving its list: drop next to the top-level block, as a list of its own.
      wrapInList = true
      target = topLevel(state, target.pos)
    }
  } else if (isItem(target.node) || state.doc.resolve(target.pos).depth > 0) {
    target = topLevel(state, target.pos)
  }
  if (!target) return null

  const dom = view.nodeDOM(target.pos) as HTMLElement | null
  if (!dom?.getBoundingClientRect) return null
  const rect = dom.getBoundingClientRect()
  const before = clientY < rect.top + rect.height / 2
  const insertPos = before ? target.pos : target.pos + target.node.nodeSize
  const left = isItem(target.node) ? rect.left : content.left
  return {
    insertPos,
    wrapInList,
    line: { top: before ? rect.top - 2 : rect.bottom + 2, left, width: content.right - left },
  }
}

function topLevel(state: EditorState, pos: number): BlockTarget | null {
  const $pos = state.doc.resolve(pos)
  const top = $pos.depth >= 1 ? $pos.before(1) : pos
  const node = state.doc.nodeAt(top)
  return node ? { pos: top, node } : null
}

/** Moves `source` to the drop position. Returns false if nothing changed. */
export function performBlockDrop(view: EditorView, source: BlockTarget, drop: BlockDrop) {
  const { state } = view
  const node = state.doc.nodeAt(source.pos)
  if (!node || node.type !== source.node.type) return false
  const end = source.pos + node.nodeSize
  // Dropping a block right where it already is.
  if (drop.insertPos >= source.pos && drop.insertPos <= end) return false

  const $src = state.doc.resolve(source.pos)
  const tr = state.tr
  // Removing the only item of a list removes the (now empty) list.
  if (isItem(node) && $src.parent.childCount === 1) tr.delete($src.before(), $src.after())
  else tr.delete(source.pos, end)

  const insertNode = drop.wrapInList ? $src.parent.type.create($src.parent.attrs, node) : node
  const at = tr.mapping.map(drop.insertPos)
  tr.insert(at, insertNode)
  try {
    if (insertNode.isTextblock) tr.setSelection(TextSelection.create(tr.doc, at + insertNode.nodeSize - 1))
    else tr.setSelection(NodeSelection.create(tr.doc, drop.wrapInList ? at + 1 : at))
  } catch {
    // keep mapped selection
  }
  view.dispatch(tr.scrollIntoView().setMeta('uiEvent', 'drop'))
  view.focus()
  return true
}
