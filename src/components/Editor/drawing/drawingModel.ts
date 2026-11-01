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

/** Makes stored drawing data safe to open (damaged or pasted data falls back to empty). */
export function normalizeDrawing(raw: unknown): DrawingData {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<DrawingData>
  const scene = (r.scene && typeof r.scene === 'object' ? r.scene : {}) as Partial<DrawingScene>
  return {
    scene: {
      elements: Array.isArray(scene.elements) ? scene.elements.filter((e) => !!e && typeof e === 'object') : [],
      files: scene.files && typeof scene.files === 'object' && !Array.isArray(scene.files) ? scene.files : {},
      background: typeof scene.background === 'string' && /^(#[0-9a-f]{3,8}|transparent)$/i.test(scene.background) ? scene.background : '#ffffff',
    },
    svgLight: typeof r.svgLight === 'string' ? r.svgLight : '',
    svgDark: typeof r.svgDark === 'string' ? r.svgDark : '',
  }
}
