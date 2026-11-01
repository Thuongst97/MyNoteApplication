import { useEffect, useRef, useState } from 'react'
import { BellRing, Check, ChevronDown, Settings2 } from 'lucide-react'
import { REMINDER_PRESETS } from '@/lib/reminders'
import { useTaskStore } from '@/stores/useTaskStore'
import { api, isElectron, platform } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Popover } from '@/components/ui/Popover'
import { PILL } from './quadrantStyle'

/** "At due time, 15 min before" — a short summary of the selected reminder offsets. */
export function summarizeReminders(minutes: number[]): string {
  if (!minutes.length) return 'None'
  const sorted = [...minutes].sort((a, b) => a - b)
  const names = sorted.map((m) => {
    const p = REMINDER_PRESETS.find((x) => x.minutes === m)
    if (m === 0) return 'At due time'
    return p ? `${p.short} before` : `${m} min before`
  })
  return names.length <= 2 ? names.join(', ') : `${names[0]} +${names.length - 1} more`
}

/** Popover with the default reminder offsets, the background option and a test notification. */
export function ReminderSettings() {
  const settings = useTaskStore((s) => s.settings)
  const { setSettings } = useTaskStore.getState()
  const [open, setOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null)
  const pickerRef = useRef<HTMLDivElement>(null)
  const showBackground = isElectron && platform !== 'darwin'

  useEffect(() => {
    if (!open) {
      setPickerOpen(false)
      setTestResult(null)
    }
  }, [open])

  // Close the reminder list when clicking elsewhere in the popover.
  useEffect(() => {
    if (!pickerOpen) return
    const onDown = (e: MouseEvent) => {
      if (!pickerRef.current?.contains(e.target as Node)) setPickerOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [pickerOpen])

  const toggle = (m: number) => {
    const cur = settings.defaultReminders
    void setSettings({ defaultReminders: cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m] })
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={PILL}
      >
        <Settings2 size={15} /> Reminders
      </button>
      <Popover
        open={open}
        onClose={() => setOpen(false)}
        className="right-0 top-10 w-[340px] rounded-2xl border-black/[0.06] p-0 text-[#1F2937] shadow-[0_12px_40px_rgba(0,0,0,0.08)] dark:border-white/10 dark:text-[#E5E7EB]"
      >
        <div role="dialog" aria-label="Reminder settings">
          {/* Default reminders */}
          <div className="px-5 pb-4 pt-5">
            <div className="mb-2.5 text-[13px] font-semibold tracking-tight">Default reminders</div>
            <div ref={pickerRef} className="relative">
              <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={pickerOpen}
                aria-label="Default reminders"
                onClick={() => setPickerOpen((v) => !v)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-xl border bg-white px-3.5 py-2.5 text-left text-sm transition-colors dark:bg-white/[0.04]',
                  pickerOpen
                    ? 'border-[#93B4DD] ring-4 ring-[#93B4DD]/15'
                    : 'border-[#E5E7EB] hover:border-[#D1D5DB] dark:border-white/10 dark:hover:border-white/20',
                )}
              >
                <BellRing size={15} className="shrink-0 text-[#6B7280] dark:text-[#9CA3AF]" />
                <span className="min-w-0 flex-1 truncate">{summarizeReminders(settings.defaultReminders)}</span>
                <ChevronDown size={15} className={cn('shrink-0 text-[#9CA3AF] transition-transform', pickerOpen && 'rotate-180')} />
              </button>
              {pickerOpen && (
                <ul
                  role="listbox"
                  aria-multiselectable="true"
                  aria-label="Reminder times"
                  className="absolute inset-x-0 top-full z-10 mt-1.5 max-h-[340px] overflow-y-auto rounded-xl border border-[#E5E7EB] bg-white p-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.08)] dark:border-white/10 dark:bg-[#26282d]"
                >
                  {REMINDER_PRESETS.map((p) => {
                    const on = settings.defaultReminders.includes(p.minutes)
                    return (
                      <li key={p.minutes}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={on}
                          onClick={() => toggle(p.minutes)}
                          className={cn(
                            'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
                            on ? 'font-medium text-[#1F2937] dark:text-white' : 'text-[#4B5563] hover:bg-[#F3F4F6] dark:text-[#C3C7CE] dark:hover:bg-white/[0.06]',
                            on && 'bg-[#F0F4F8] dark:bg-[#7FA7D9]/[0.12]',
                          )}
                        >
                          <span className="flex-1">{p.label}</span>
                          {on && <Check size={15} className="text-[#3B6FB6] dark:text-[#93B4DD]" strokeWidth={2.5} />}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* Background */}
          {showBackground && (
            <label className="flex cursor-pointer items-center gap-3 border-t border-black/[0.05] px-5 py-4 dark:border-white/[0.08]">
              <span className="flex-1 text-sm leading-snug">Keep running in the system tray after closing the window</span>
              <input
                type="checkbox"
                role="switch"
                checked={settings.runInBackground}
                onChange={(e) => void setSettings({ runInBackground: e.target.checked })}
                className="peer sr-only"
              />
              <span
                aria-hidden
                className={cn(
                  'relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-[#93B4DD]',
                  settings.runInBackground ? 'bg-[#5B83B7]' : 'bg-[#D1D5DB] dark:bg-white/20',
                )}
              >
                <span
                  className={cn(
                    'absolute top-[3px] h-4 w-4 rounded-full bg-white shadow-sm transition-[left]',
                    settings.runInBackground ? 'left-[19px]' : 'left-[3px]',
                  )}
                />
              </span>
            </label>
          )}

          {/* Test */}
          <div className="border-t border-black/[0.05] px-5 py-4 dark:border-white/[0.08]">
            <button
              type="button"
              onClick={async () => {
                const ok = await api.tasks.testNotification()
                setTestResult(ok ? { ok, text: 'Sent — check your notifications.' } : { ok, text: 'Notifications are blocked or unavailable.' })
              }}
              className="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-medium text-[#374151] transition-colors hover:border-[#D1D5DB] hover:bg-[#F9FAFB] dark:border-white/10 dark:bg-transparent dark:text-[#D1D5DB] dark:hover:bg-white/[0.05]"
            >
              Send test notification
            </button>
            {testResult && (
              <div role="status" className={cn('mt-2 text-center text-xs', testResult.ok ? 'text-[#4B5563] dark:text-[#9CA3AF]' : 'text-[#D25C5C]')}>
                {testResult.text}
              </div>
            )}
          </div>
        </div>
      </Popover>
    </div>
  )
}
