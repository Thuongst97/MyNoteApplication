import { useEffect, useRef, useState } from 'react'
import { Excalidraw, exportToSvg, FONT_FAMILY, MainMenu } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'
import type { ExcalidrawImperativeAPI, BinaryFiles, ExcalidrawInitialDataState } from '@excalidraw/excalidraw/types'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import { Check, Loader2, X } from 'lucide-react'
import type { Theme } from '@/stores/useAppStore'
import { isMacLike } from '@/lib/utils'
import { canvasBackground, type DrawingData } from './drawingModel'
import { externalizeFiles, inlineFiles, replaceInSvg } from '@/lib/sceneFiles'
import { useLibraryIntegration } from '@/components/Library/LibraryPanel'
import { useTwoWayArrowTool } from '@/components/Whiteboard/twoWayArrow'
import { useMovableShapePanel } from '@/components/Whiteboard/movablePanel'
import { OFFICE_SHAPE_DEFAULTS, useOfficeShapes } from '@/components/Whiteboard/officeShapes'

interface Props {
  initial: DrawingData
  theme: Theme
  /** Saved data, or null when cancelled. */
  onClose: (result: DrawingData | null) => void
}

/** Full-window drawing editor (shapes, arrows, text, pen, colors, layers…). */
export default function DrawingEditor({ initial, theme, onClose }: Props) {
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null)
  const [saving, setSaving] = useState(false)
  const dirty = useRef(false)
  const library = useLibraryIntegration(theme)
  const twoWay = useTwoWayArrowTool(library.api)

  const rootRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  useMovableShapePanel(canvasRef)
  const office = useOfficeShapes(library.api, canvasRef)
  // Stored images are asset files; load them back inline for Excalidraw (once).
  const [initialData] = useState(() =>
    inlineFiles(initial.scene.files).then((files): ExcalidrawInitialDataState => ({
      elements: initial.scene.elements as ExcalidrawElement[],
      files: files as BinaryFiles,
      appState: {
        viewBackgroundColor: canvasBackground(initial.scene.background),
        // PowerPoint-like defaults: clean lines, sharp corners, regular font.
        currentItemRoughness: 0,
        currentItemFontFamily: FONT_FAMILY.Nunito,
        currentItemRoundness: 'sharp',
        currentItemStrokeWidth: 2,
        ...OFFICE_SHAPE_DEFAULTS,
      },
      scrollToContent: true,
    })),
  )

  useEffect(() => {
    document.body.classList.add('drawing-open')
    // Take keyboard focus away from the note behind, so tool shortcuts (R, O, A, T…)
    // don't also type into the note.
    ;(document.activeElement as HTMLElement | null)?.blur?.()
    return () => document.body.classList.remove('drawing-open')
  }, [])

  const save = async () => {
    const api = apiRef.current
    if (!api || saving) return
    setSaving(true)
    try {
      const elements = api.getSceneElements().filter((e) => !e.isDeleted)
      const allFiles = api.getFiles()
      // Keep only images still used in the drawing.
      const used = new Set(elements.map((e) => (e as { fileId?: string }).fileId).filter(Boolean))
      const files = Object.fromEntries(Object.entries(allFiles).filter(([id]) => used.has(id))) as BinaryFiles
      const background = api.getAppState().viewBackgroundColor
      const render = async (dark: boolean) => {
        if (!elements.length) return ''
        const svg = await exportToSvg({
          elements,
          appState: { exportBackground: false, viewBackgroundColor: background, exportWithDarkMode: dark, exportScale: 1 },
          files,
          exportPadding: 16,
        })
        svg.setAttribute('role', 'img')
        svg.removeAttribute('width')
        svg.removeAttribute('height')
        return svg.outerHTML
      }
      const [svgLight, svgDark] = await Promise.all([render(false), render(true)])
      // Store images as asset files (not base64 in the page, three times over).
      const stored = await externalizeFiles(files as never)
      onClose({
        scene: { elements: elements as unknown[], files: stored.files, background },
        svgLight: replaceInSvg(svgLight, stored.replaced),
        svgDark: replaceInSvg(svgDark, stored.replaced),
      })
    } catch (err) {
      console.error('[drawing] save failed', err)
      window.alert(`Couldn't save the drawing: ${(err as Error)?.message ?? err}`)
      setSaving(false)
    }
  }

  const cancel = () => {
    if (dirty.current && !window.confirm('Discard changes to this drawing?')) return
    onClose(null)
  }

  const mod = isMacLike() ? '⌘' : 'Ctrl'

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      className="no-drag fixed inset-0 z-[200] flex flex-col bg-white outline-none dark:bg-[#191919]"
      // Keep events away from the note editor behind (React portals bubble to the node view).
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault()
          void save()
        }
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onDragStart={(e) => e.stopPropagation()}
      onPaste={(e) => e.stopPropagation()}
    >
      <div className="drag flex h-11 shrink-0 items-center gap-2 border-b border-black/10 px-4 dark:border-white/10" style={{ paddingLeft: isMacLike() ? 84 : undefined }}>
        <span className="text-sm font-medium">Drawing</span>
        <span className="text-xs opacity-50">Pick a shape from the toolbar · select a shape and type to write in it · Background sets its fill</span>
        <span className="ml-auto text-xs opacity-40">{mod}+Enter to save</span>
        <button type="button" onClick={cancel} className="no-drag flex items-center gap-1 rounded-md px-2.5 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/10">
          <X size={14} /> Cancel
        </button>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="no-drag flex items-center gap-1 rounded-md bg-blue-500 px-3 py-1 text-sm text-white hover:bg-blue-600 disabled:opacity-60"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save
        </button>
      </div>
      <div ref={canvasRef} className={`relative min-h-0 flex-1${twoWay.active ? ' two-way-arrow-host' : ''}`}>
        <Excalidraw
          excalidrawAPI={(api) => {
            apiRef.current = api
            library.setApi(api)
          }}
          {...library.excalidrawProps}
          autoFocus
          theme={theme}
          initialData={initialData}
          onChange={(_elements, state, _files) => {
            twoWay.onAppStateChange(state)
            office.onAppStateChange(state)
            if (apiRef.current) dirty.current = true
          }}
          UIOptions={{
            canvasActions: { loadScene: false, saveToActiveFile: false, export: false, saveAsImage: true, toggleTheme: false, changeViewBackgroundColor: true, clearCanvas: true },
            tools: { image: true },
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
        {twoWay.button}
      </div>
    </div>
  )
}
