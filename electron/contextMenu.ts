import type { ContextMenuParams, MenuItemConstructorOptions } from 'electron'

/** What the menu items do (injected so the template can be tested without Electron). */
export interface ContextMenuActions {
  replaceMisspelling: (word: string) => void
  addToDictionary: (word: string) => void
  pasteAsPlainText: () => void
  copyImage: () => void
  copyText: (text: string) => void
  openExternal: (url: string) => void
}

type Params = Pick<
  ContextMenuParams,
  'isEditable' | 'selectionText' | 'editFlags' | 'linkURL' | 'mediaType' | 'hasImageContents' | 'misspelledWord' | 'dictionarySuggestions'
>

const isWebLink = (url: string) => /^https?:\/\//i.test(url)

/**
 * The right-click menu for the page (Cut/Copy/Paste on text, Copy on selected text,
 * link and image actions, spelling suggestions). Returns [] when there's nothing
 * useful to show (then no menu appears). Places with their own menu (e.g. the
 * whiteboard canvas) cancel the event, so this isn't shown there.
 */
export function contextMenuTemplate(p: Params, a: ContextMenuActions): MenuItemConstructorOptions[] {
  const groups: MenuItemConstructorOptions[][] = []
  const hasSelection = p.selectionText.trim().length > 0

  if (p.isEditable && p.misspelledWord) {
    const fixes: MenuItemConstructorOptions[] = p.dictionarySuggestions
      .slice(0, 5)
      .map((s) => ({ label: s, click: () => a.replaceMisspelling(s) }))
    if (!fixes.length) fixes.push({ label: 'No suggestions', enabled: false })
    fixes.push({ label: 'Add to dictionary', click: () => a.addToDictionary(p.misspelledWord) })
    groups.push(fixes)
  }

  if (p.linkURL && isWebLink(p.linkURL)) {
    groups.push([
      { label: 'Open link in browser', click: () => a.openExternal(p.linkURL) },
      { label: 'Copy link address', click: () => a.copyText(p.linkURL) },
    ])
  }

  if (p.mediaType === 'image' && p.hasImageContents) {
    groups.push([{ label: 'Copy image', click: () => a.copyImage() }])
  }

  if (p.isEditable) {
    groups.push([
      { role: 'cut', enabled: p.editFlags.canCut && hasSelection },
      { role: 'copy', enabled: p.editFlags.canCopy && hasSelection },
      { role: 'paste', enabled: p.editFlags.canPaste },
      { label: 'Paste as plain text', enabled: p.editFlags.canPaste, click: () => a.pasteAsPlainText() },
    ])
    groups.push([{ role: 'selectAll', enabled: p.editFlags.canSelectAll }])
  } else if (hasSelection) {
    groups.push([{ role: 'copy', enabled: p.editFlags.canCopy }, { role: 'selectAll' }])
  }

  const out: MenuItemConstructorOptions[] = []
  for (const g of groups) {
    if (out.length) out.push({ type: 'separator' })
    out.push(...g)
  }
  return out
}
