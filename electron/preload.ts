import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { ElectronAPI, PageUpdate } from '../src/types'

const api: ElectronAPI = {
  platform: process.platform,

  getPageTree: () => ipcRenderer.invoke('get-page-tree'),
  readPage: (id: string) => ipcRenderer.invoke('read-page', id),
  savePage: (update: PageUpdate) => ipcRenderer.invoke('save-page', update),
  deletePage: (id: string) => ipcRenderer.invoke('delete-page', id),
  searchPages: (query: string) => ipcRenderer.invoke('search-pages', query),
  saveAsset: (data: Uint8Array, mime: string) => ipcRenderer.invoke('save-asset', data, mime),

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
