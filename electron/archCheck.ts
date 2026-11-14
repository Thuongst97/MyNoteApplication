/**
 * The Intel (x64) build runs on Apple Silicon Macs (and the x64 Windows build on ARM PCs)
 * through translation (Rosetta / emulation), which makes the whole app noticeably slower.
 * Then the user is told which download to use instead.
 */
export function translationWarning(platform: string, translated: boolean): { message: string; detail: string } | null {
  if (!translated) return null
  if (platform === 'darwin')
    return {
      message: 'PremiumNote is running in Intel mode (Rosetta)',
      detail:
        'This copy is the Intel version, so your Apple Silicon Mac translates it and everything is slower (opening pages, typing, scrolling).\n\nFor full speed, install the Apple Silicon version: the file whose name ends in "mac-arm64.dmg".',
    }
  if (platform === 'win32')
    return {
      message: 'PremiumNote is running in emulation',
      detail: 'This copy is built for Intel/AMD processors, so your ARM PC emulates it and everything is slower.',
    }
  return null
}
