import { createContext, useContext, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Pencil } from 'lucide-react'

/** True inside a presentation slide's editor (which is drawn scaled down). */
export const InSlideContext = createContext(false)

/**
 * A block's editing UI (code + preview, chart data…). On a page it is shown in place; on a
 * slide — which is scaled to fit the screen — it opens as a dialog at normal size instead.
 */
export function BlockEditPanel({ title, children }: { title: string; children: ReactNode }) {
  const inSlide = useContext(InSlideContext)
  if (!inSlide) return <>{children}</>
  return (
    <>
      <div contentEditable={false} className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-blue-400/60 bg-blue-500/[0.05] py-6 text-[0.8em] opacity-80">
        <Pencil size={18} /> Editing {title}…
      </div>
      {createPortal(
        <div className="fixed inset-0 z-[300] flex items-start justify-center overflow-y-auto bg-black/40 p-6 pt-[8vh]" data-testid="block-edit-dialog">
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Edit ${title}`}
            contentEditable={false}
            className="w-full max-w-[1040px] animate-pop-in rounded-xl bg-white p-1.5 text-ink-light shadow-2xl dark:bg-[#202020] dark:text-ink-dark"
          >
            {children}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
