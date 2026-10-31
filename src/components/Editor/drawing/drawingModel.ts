/** What a drawing block stores. Elements/files are Excalidraw's own JSON. */
export interface DrawingScene {
  elements: unknown[]
  files: Record<string, unknown>
  background: string
}

export interface DrawingData {
  scene: DrawingScene
  /** Pre-rendered previews, so notes show drawings without loading the editor. */
  svgLight: string
  svgDark: string
}

export const EMPTY_DRAWING: DrawingData = {
  scene: { elements: [], files: {}, background: '#ffffff' },
  svgLight: '',
  svgDark: '',
}

/** Text typed inside a drawing (for full-text search). */
export function drawingText(data: Partial<DrawingData> | undefined): string {
  const elements = (data?.scene?.elements ?? []) as Array<{ type?: string; text?: string; isDeleted?: boolean }>
  return elements
    .filter((e) => e.type === 'text' && !e.isDeleted && e.text)
    .map((e) => e.text)
    .join(' ')
}
