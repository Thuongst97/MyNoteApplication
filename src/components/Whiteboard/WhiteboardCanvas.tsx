import { useRef } from 'react'
import { Excalidraw, FONT_FAMILY, MainMenu, hashElementsVersion } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'
import type { BinaryFiles } from '@excalidraw/excalidraw/types'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import type { Theme } from '@/stores/useAppStore'
import { useAppStore } from '@/stores/useAppStore'
import { parsePageUrl } from '@/lib/links'
import type { WhiteboardContent } from './WhiteboardPage'
import { useLibraryIntegration } from '@/components/Library/LibraryPanel'

interface Props {
  theme: Theme
  initial: WhiteboardContent
  onChange: (scene: WhiteboardContent['scene']) => void
}

/** Excalidraw as a full page. Only real drawing changes are saved (not panning/zooming). */
export default function WhiteboardCanvas({ theme, initial, onChange }: Props) {
  const lastHash = useRef<number | null>(null)
  const lastFiles = useRef(0)
  const library = useLibraryIntegration(theme)

  return (
    <div className="relative h-full w-full">
    <Excalidraw
      excalidrawAPI={library.setApi}
      {...library.excalidrawProps}
      theme={theme}
      autoFocus
      initialData={{
        elements: initial.scene.elements as ExcalidrawElement[],
        files: initial.scene.files as BinaryFiles,
        appState: {
          viewBackgroundColor: initial.scene.background ?? (theme === 'dark' ? '#191919' : '#ffffff'),
          currentItemRoughness: 0,
          currentItemFontFamily: FONT_FAMILY.Nunito,
          currentItemRoundness: 'sharp',
          currentItemStrokeWidth: 2,
        },
        scrollToContent: true,
      }}
      onChange={(elements, appState, files) => {
        const hash = hashElementsVersion(elements)
        const fileCount = Object.keys(files).length
        if (lastHash.current === null) {
          // First call is the initial load, not an edit.
          lastHash.current = hash
          lastFiles.current = fileCount
          return
        }
        if (hash === lastHash.current && fileCount === lastFiles.current) return
        lastHash.current = hash
        lastFiles.current = fileCount
        const live = elements.filter((e) => !e.isDeleted)
        const used = new Set(live.map((e) => (e as { fileId?: string }).fileId).filter(Boolean))
        onChange({
          elements: live as unknown[],
          files: Object.fromEntries(Object.entries(files).filter(([id]) => used.has(id))),
          background: appState.viewBackgroundColor,
        })
      }}
      // Links to pages (notionclone://page/…) on shapes open the page in the app.
      onLinkOpen={(element, event) => {
        const ref = parsePageUrl(element.link)
        if (!ref) return
        event.preventDefault()
        useAppStore.getState().setActivePage(ref.pageId, { blockId: ref.blockId })
      }}
      UIOptions={{
        canvasActions: { loadScene: false, saveToActiveFile: false, export: false, saveAsImage: true, toggleTheme: false, changeViewBackgroundColor: true, clearCanvas: true },
      }}
    >
      <MainMenu>
        <MainMenu.DefaultItems.SaveAsImage />
        <MainMenu.DefaultItems.ClearCanvas />
        <MainMenu.DefaultItems.ChangeCanvasBackground />
        <MainMenu.DefaultItems.Help />
      </MainMenu>
    </Excalidraw>
    {library.panel}
    </div>
  )
}
