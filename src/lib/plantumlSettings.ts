import { useSyncExternalStore } from 'react'
import { DEFAULT_PLANTUML_SERVER, normalizePlantUmlServer } from './plantuml'

const KEY = 'premiumnote:plantuml-server'
const listeners = new Set<() => void>()

export function getPlantUmlServer(): string {
  try {
    return normalizePlantUmlServer(localStorage.getItem(KEY)) ?? DEFAULT_PLANTUML_SERVER
  } catch {
    return DEFAULT_PLANTUML_SERVER
  }
}

/** Saves the server (null/invalid = back to the default). Returns the server now in use. */
export function setPlantUmlServer(value: string | null): string {
  const v = normalizePlantUmlServer(value)
  try {
    if (v && v !== DEFAULT_PLANTUML_SERVER) localStorage.setItem(KEY, v)
    else localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
  listeners.forEach((l) => l())
  return getPlantUmlServer()
}

export function usePlantUmlServer(): string {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    getPlantUmlServer,
  )
}
