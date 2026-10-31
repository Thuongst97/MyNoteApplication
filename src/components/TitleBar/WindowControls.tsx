import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

/** Custom minimize / maximize / close buttons for Windows & Linux (frameless window). */
export function WindowControls() {
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    void api.window.isMaximized().then(setMaximized)
    return api.window.onMaximizedChange(setMaximized)
  }, [])

  const base =
    'no-drag flex h-full w-[46px] items-center justify-center text-ink-light/80 transition-colors dark:text-ink-dark/80'

  return (
    <div className="flex h-full self-start" style={{ height: 'var(--titlebar-h)' }}>
      <button type="button" aria-label="Minimize" onClick={api.window.minimize} className={`${base} hover:bg-black/5 dark:hover:bg-white/10`}>
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
          <path d="M0 5h10" stroke="currentColor" strokeWidth="1" />
        </svg>
      </button>
      <button
        type="button"
        aria-label={maximized ? 'Restore' : 'Maximize'}
        onClick={api.window.toggleMaximize}
        className={`${base} hover:bg-black/5 dark:hover:bg-white/10`}
      >
        {maximized ? (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
            <path d="M2.5 2.5V.5h7v7h-2" stroke="currentColor" strokeWidth="1" />
            <rect x=".5" y="2.5" width="7" height="7" stroke="currentColor" strokeWidth="1" />
          </svg>
        ) : (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
            <rect x=".5" y=".5" width="9" height="9" stroke="currentColor" strokeWidth="1" />
          </svg>
        )}
      </button>
      <button type="button" aria-label="Close" onClick={api.window.close} className={`${base} hover:bg-[#E81123] hover:text-white`}>
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
          <path d="M0 0l10 10M10 0L0 10" stroke="currentColor" strokeWidth="1" />
        </svg>
      </button>
    </div>
  )
}
