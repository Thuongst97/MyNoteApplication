; Refresh Explorer's icon cache after install/uninstall so the Start menu,
; desktop shortcut and taskbar show PremiumNote's icon immediately instead of a
; stale cached one (e.g. the default Electron icon from an earlier install).
!macro premiumNoteRefreshIcons
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0x1000, i 0, i 0)'
  IfFileExists "$SYSDIR\ie4uinit.exe" 0 +2
    nsExec::Exec '"$SYSDIR\ie4uinit.exe" -show'
!macroend

!macro customInstall
  !insertmacro premiumNoteRefreshIcons
!macroend

!macro customUnInstall
  !insertmacro premiumNoteRefreshIcons
!macroend
