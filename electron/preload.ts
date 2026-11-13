import { contextBridge, ipcRenderer, webFrame, type IpcRendererEvent } from 'electron'
import type { ElectronAPI, PageUpdate, TaskSettings, TaskUpdate } from '../src/types'

const api: ElectronAPI = {
  platform: process.platform,

  getPageTree: () => ipcRenderer.invoke('get-page-tree'),
  readPage: (id: string) => ipcRenderer.invoke('read-page', id),
  savePage: (update: PageUpdate) => ipcRenderer.invoke('save-page', update),
  deletePage: (id: string) => ipcRenderer.invoke('delete-page', id),
  getLinks: () => ipcRenderer.invoke('get-links'),
  searchPages: (query: string) => ipcRenderer.invoke('search-pages', query),
  saveAsset: (data: Uint8Array, mime: string) => ipcRenderer.invoke('save-asset', data, mime),
  renderPlantUml: (server: string, source: string) => ipcRenderer.invoke('plantuml:render', server, source),
  pageFiles: {
    export: (id: string, includeChildren: boolean) => ipcRenderer.invoke('pages:export', id, includeChildren),
    import: (parentId: string | null) => ipcRenderer.invoke('pages:import', parentId),
  },

  libraries: {
    get: () => ipcRenderer.invoke('libraries:get'),
    save: (data) => ipcRenderer.invoke('libraries:save', data),
    installUrl: (url: string) => ipcRenderer.invoke('libraries:install-url', url),
    importFile: () => ipcRenderer.invoke('libraries:import-file'),
    browse: () => ipcRenderer.invoke('libraries:browse'),
    onInstalled: (cb) => {
      const listener = (_e: IpcRendererEvent, r: Parameters<typeof cb>[0]) => cb(r)
      ipcRenderer.on('libraries:installed', listener)
      return () => ipcRenderer.removeListener('libraries:installed', listener)
    },
  },
  tasks: {
    list: () => ipcRenderer.invoke('tasks:list'),
    save: (update: TaskUpdate) => ipcRenderer.invoke('tasks:save', update),
    remove: (id: string) => ipcRenderer.invoke('tasks:remove', id),
    getSettings: () => ipcRenderer.invoke('tasks:get-settings'),
    setSettings: (patch: Partial<TaskSettings>) => ipcRenderer.invoke('tasks:set-settings', patch),
    testNotification: () => ipcRenderer.invoke('tasks:test-notification'),
    onOpenTask: (cb) => {
      const listener = (_e: IpcRendererEvent, id: string) => cb(id)
      ipcRenderer.on('tasks:open', listener)
      return () => ipcRenderer.removeListener('tasks:open', listener)
    },
    onChanged: (cb) => {
      const listener = () => cb()
      ipcRenderer.on('tasks:changed', listener)
      return () => ipcRenderer.removeListener('tasks:changed', listener)
    },
  },
  clipboard: {
    writeRich: (html: string, text: string) => ipcRenderer.invoke('clipboard:write-rich', html, text),
    inlineImages: () => ipcRenderer.invoke('clipboard:inline-images'),
  },
  diagrams: {
    copyImage: (png: Uint8Array) => ipcRenderer.invoke('diagram:copy', png),
    save: (svg: string, png: Uint8Array, name: string) => ipcRenderer.invoke('diagram:save', svg, png, name),
  },
  pageMenu: {
    setOnPage: (onPage: boolean) => {
      ipcRenderer.sendSync('context:on-page', onPage === true)
    },
    onCopyPage: (cb) => {
      const listener = (_e: IpcRendererEvent, format: 'rich' | 'markdown' | 'text') => cb(format)
      ipcRenderer.on('page:copy', listener)
      return () => ipcRenderer.removeListener('page:copy', listener)
    },
  },
  spellcheck: {
    set: (on: boolean) => ipcRenderer.send('spellcheck:set', on === true),
    onTurnedOff: (cb) => {
      const listener = () => cb()
      ipcRenderer.on('spellcheck:turned-off', listener)
      return () => ipcRenderer.removeListener('spellcheck:turned-off', listener)
    },
  },
  zoom: {
    get: () => webFrame.getZoomFactor(),
    set: (factor: number) => {
      if (Number.isFinite(factor)) webFrame.setZoomFactor(Math.min(3, Math.max(0.5, factor)))
    },
  },
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    toggleMaximize: () => ipcRenderer.send('window:toggle-maximize'),
    close: () => ipcRenderer.send('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
    onMaximizedChange: (cb) => {
      const listener = (_e: IpcRendererEvent, maximized: boolean) => cb(maximized)
      ipcRenderer.on('window:maximized-changed', listener)
      return () => ipcRenderer.removeListener('window:maximized-changed', listener)
    },
  },

  onFlushRequest: (cb) => {
    const listener = async () => {
      try {
        await cb()
      } finally {
        ipcRenderer.send('app:flush-done')
      }
    }
    ipcRenderer.on('app:flush-request', listener)
    return () => ipcRenderer.removeListener('app:flush-request', listener)
  },
}

contextBridge.exposeInMainWorld('electronAPI', api)
