import { api } from './api'

/**
 * Images on whiteboards and in drawings are Excalidraw "files" whose `dataURL` is
 * the whole image as base64. Kept inline, a few photos make a page file many MB,
 * and that page is re-written on every auto-save and held in memory whenever the
 * page is open. So pages store them as asset files instead (`notion-asset://…`),
 * uploaded once each, and they're turned back into data URLs only while a canvas
 * is open (Excalidraw needs data URLs).
 */

export const ASSET_URL = /^notion-asset:\/\/local\/[0-9a-f-]{36}\.[a-z]+$/
const DATA_URL = /^data:(image\/(?:png|jpeg|gif|webp|avif|bmp|svg\+xml));base64,/

type SceneFile = { id?: string; dataURL?: unknown; mimeType?: string } & Record<string, unknown>
export type SceneFiles = Record<string, unknown>

/** Uploaded asset URL per image (Excalidraw file ids are content hashes). */
const uploaded = new Map<string, string>()
const uploading = new Map<string, Promise<string | null>>()

const keyFor = (id: string, dataURL: string) => `${id}:${dataURL.length}`

async function upload(id: string, dataURL: string): Promise<string | null> {
  const key = keyFor(id, dataURL)
  const done = uploaded.get(key)
  if (done) return done
  let task = uploading.get(key)
  if (!task) {
    task = (async () => {
      try {
        const mime = DATA_URL.exec(dataURL)![1]
        const bytes = new Uint8Array(await (await fetch(dataURL)).arrayBuffer())
        const url = await api.saveAsset(bytes, mime)
        uploaded.set(key, url)
        return url
      } catch (err) {
        console.warn('[images] keeping image inline, upload failed:', err)
        return null
      } finally {
        uploading.delete(key)
      }
    })()
    uploading.set(key, task)
  }
  return task
}

function entries(files: SceneFiles | null | undefined): Array<[string, SceneFile]> {
  if (!files || typeof files !== 'object') return []
  return Object.entries(files).filter((e): e is [string, SceneFile] => !!e[1] && typeof e[1] === 'object')
}

/**
 * Same files with every already-uploaded image swapped for its asset URL, or null
 * if some image still needs uploading (then use {@link externalizeFiles}).
 */
export function externalizeFilesSync(files: SceneFiles): SceneFiles | null {
  const out: SceneFiles = {}
  for (const [id, f] of entries(files)) {
    const dataURL = typeof f.dataURL === 'string' ? f.dataURL : ''
    if (DATA_URL.test(dataURL)) {
      const url = uploaded.get(keyFor(id, dataURL))
      if (!url) return null
      out[id] = { ...f, dataURL: url }
    } else out[id] = f
  }
  return out
}

/**
 * Uploads inline images and returns the files with asset URLs, plus the
 * data URL → asset URL replacements made (for rewriting exported SVG previews).
 * Images that can't be uploaded stay inline.
 */
export async function externalizeFiles(files: SceneFiles): Promise<{ files: SceneFiles; replaced: Map<string, string> }> {
  const replaced = new Map<string, string>()
  const out: SceneFiles = {}
  await Promise.all(
    entries(files).map(async ([id, f]) => {
      const dataURL = typeof f.dataURL === 'string' ? f.dataURL : ''
      const url = DATA_URL.test(dataURL) ? await upload(id, dataURL) : null
      if (url) replaced.set(dataURL, url)
      out[id] = url ? { ...f, dataURL: url } : f
    }),
  )
  return { files: out, replaced }
}

/** Puts asset URLs into SVG markup in place of the data URLs they replaced. */
export function replaceInSvg(svg: string, replaced: Map<string, string>): string {
  let out = svg
  for (const [dataURL, url] of replaced) if (out.includes(dataURL)) out = out.split(dataURL).join(url)
  return out
}

async function toDataURL(url: string): Promise<string> {
  const blob = await (await fetch(url)).blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

/** Loads stored images back as data URLs so Excalidraw can use them. */
export async function inlineFiles(files: SceneFiles): Promise<SceneFiles> {
  const out: SceneFiles = {}
  await Promise.all(
    entries(files).map(async ([id, f]) => {
      const url = typeof f.dataURL === 'string' ? f.dataURL : ''
      if (!ASSET_URL.test(url)) {
        out[id] = f
        return
      }
      try {
        const dataURL = await toDataURL(url)
        if (DATA_URL.test(dataURL)) uploaded.set(keyFor(id, dataURL), url) // already stored: no re-upload
        out[id] = { ...f, dataURL }
      } catch (err) {
        console.warn('[images] could not load', url, err)
        // Leave it out: Excalidraw shows a placeholder for the missing image.
      }
    }),
  )
  return out
}

/** For tests. */
export function resetSceneFileCache() {
  uploaded.clear()
  uploading.clear()
}
