// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { translationWarning } from '../../electron/archCheck'

describe('Intel build on Apple Silicon', () => {
  it('warns only when the app is translated, and names the right download', () => {
    expect(translationWarning('darwin', false)).toBeNull()
    expect(translationWarning('darwin', true)?.detail).toContain('mac-arm64.dmg')
    expect(translationWarning('win32', true)?.message).toContain('emulation')
    expect(translationWarning('linux', true)).toBeNull()
  })
})
