import { useEditorState, type Editor } from '@tiptap/react'
import { CellSelection } from '@tiptap/pm/tables'
import { BubbleMenu } from '@tiptap/react/menus'
import {
  ArrowDownToLine,
  ArrowLeftToLine,
  ArrowRightToLine,
  ArrowUpToLine,
  Columns3,
  Heading,
  Rows3,
  TableCellsMerge,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/** The <table> element around the cursor, if any. */
function currentTable(editor: Editor): HTMLElement | null {
  const { view, state } = editor
  try {
    const at = view.domAtPos(state.selection.from).node
    const el = at instanceof HTMLElement ? at : at.parentElement
    return el?.closest('table') ?? null
  } catch {
    return null
  }
}

/** Floating toolbar under a table while the cursor is inside it: add/remove rows & columns, header, delete. */
export function TableToolbar({ editor }: { editor: Editor }) {
  const run = (fn: (c: ReturnType<Editor['chain']>) => ReturnType<Editor['chain']>) => fn(editor.chain().focus()).run()
  // Re-evaluated on every transaction so buttons enable/disable as the cursor moves.
  const can = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      if (!e.isActive('table')) return null
      const c = e.can()
      return {
        addRowBefore: c.addRowBefore(),
        addRowAfter: c.addRowAfter(),
        deleteRow: c.deleteRow(),
        addColumnBefore: c.addColumnBefore(),
        addColumnAfter: c.addColumnAfter(),
        deleteColumn: c.deleteColumn(),
        toggleHeaderRow: c.toggleHeaderRow(),
        mergeOrSplit: c.mergeOrSplit(),
        deleteTable: c.deleteTable(),
      }
    },
  }) ?? {
    addRowBefore: false,
    addRowAfter: false,
    deleteRow: false,
    addColumnBefore: false,
    addColumnAfter: false,
    deleteColumn: false,
    toggleHeaderRow: false,
    mergeOrSplit: false,
    deleteTable: false,
  }
  return (
    <BubbleMenu
      editor={editor}
      pluginKey="tableToolbar"
      options={{ placement: 'bottom-start', offset: 6, flip: true, shift: { padding: 8 } }}
      // Hidden while text is selected inside a cell, where the formatting toolbar shows instead.
      shouldShow={({ editor: e, state }) => e.isEditable && e.isActive('table') && (state.selection.empty || state.selection instanceof CellSelection)}
      getReferencedVirtualElement={() => {
        const table = currentTable(editor)
        return table ? { getBoundingClientRect: () => table.getBoundingClientRect() } : null
      }}
      className="no-drag z-40"
    >
      <div
        role="toolbar"
        aria-label="Table"
        className="flex items-center gap-0.5 rounded-lg border border-black/10 bg-white p-1 text-ink-light shadow-lg dark:border-white/10 dark:bg-[#252525] dark:text-ink-dark"
        onMouseDown={(e) => e.preventDefault()}
      >
        <Btn label="Add row above" onClick={() => run((c) => c.addRowBefore())} disabled={!can.addRowBefore}>
          <ArrowUpToLine size={15} />
        </Btn>
        <Btn label="Add row below" onClick={() => run((c) => c.addRowAfter())} disabled={!can.addRowAfter}>
          <ArrowDownToLine size={15} />
        </Btn>
        <Btn label="Delete row" onClick={() => run((c) => c.deleteRow())} disabled={!can.deleteRow} danger>
          <Rows3 size={15} />
        </Btn>
        <Sep />
        <Btn label="Add column left" onClick={() => run((c) => c.addColumnBefore())} disabled={!can.addColumnBefore}>
          <ArrowLeftToLine size={15} />
        </Btn>
        <Btn label="Add column right" onClick={() => run((c) => c.addColumnAfter())} disabled={!can.addColumnAfter}>
          <ArrowRightToLine size={15} />
        </Btn>
        <Btn label="Delete column" onClick={() => run((c) => c.deleteColumn())} disabled={!can.deleteColumn} danger>
          <Columns3 size={15} />
        </Btn>
        <Sep />
        <Btn label="Header row on/off" onClick={() => run((c) => c.toggleHeaderRow())} disabled={!can.toggleHeaderRow}>
          <Heading size={15} />
        </Btn>
        <Btn label="Merge or split cells" onClick={() => run((c) => c.mergeOrSplit())} disabled={!can.mergeOrSplit}>
          <TableCellsMerge size={15} />
        </Btn>
        <Sep />
        <Btn label="Delete table" onClick={() => run((c) => c.deleteTable())} disabled={!can.deleteTable} danger>
          <Trash2 size={15} />
        </Btn>
      </div>
    </BubbleMenu>
  )
}

function Btn({ children, label, onClick, disabled, danger }: { children: React.ReactNode; label: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'rounded-md p-1.5 hover:bg-black/5 disabled:opacity-30 disabled:hover:bg-transparent dark:hover:bg-white/10',
        danger && 'hover:text-red-600 dark:hover:text-red-400',
      )}
    >
      {children}
    </button>
  )
}

const Sep = () => <span className="mx-0.5 h-5 w-px bg-black/10 dark:bg-white/10" />
