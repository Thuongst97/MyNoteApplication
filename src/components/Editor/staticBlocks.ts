import { createContext, useContext } from 'react'

/**
 * True where blocks are shown as pictures (slide thumbnails): heavy or live content
 * (interactive HTML) shows a still version instead of running.
 */
export const StaticBlocksContext = createContext(false)
export const useStaticBlocks = () => useContext(StaticBlocksContext)
