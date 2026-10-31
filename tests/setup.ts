import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'

// ---- Browser APIs jsdom doesn't provide (only when running in jsdom) ----
if (typeof window !== 'undefined') {
  const { cleanup } = await import('@testing-library/react')
  afterEach(() => cleanup())

  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia

  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver

  // ProseMirror measures text ranges; jsdom has no layout.
  const rect = () => ({ x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON: () => ({}) }) as DOMRect
  Range.prototype.getBoundingClientRect ??= rect
  Range.prototype.getClientRects ??= () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] }) as unknown as DOMRectList
  document.elementFromPoint ??= () => null
  Element.prototype.scrollIntoView ??= function () {}

  if (!globalThis.crypto?.randomUUID) {
    const { randomUUID } = await import('node:crypto')
    Object.defineProperty(globalThis.crypto, 'randomUUID', { value: randomUUID })
  }

  // ProseMirror's pasteHTML/pasteText build a ClipboardEvent.
  if (typeof globalThis.ClipboardEvent === 'undefined') {
    globalThis.ClipboardEvent = class extends Event {
      clipboardData: DataTransfer | null
      constructor(type: string, init?: ClipboardEventInit) {
        super(type, init)
        this.clipboardData = init?.clipboardData ?? null
      }
    } as unknown as typeof ClipboardEvent
  }

  // Clipboard (used by "Copy link" actions)
  if (!navigator.clipboard) {
    let text = ''
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn(async (t: string) => void (text = t)), readText: vi.fn(async () => text) },
      configurable: true,
    })
  }
}
