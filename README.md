# NotionClone — a Notion-like desktop notes app

Block-based note-taking app built with **Electron + React 18 + TypeScript + Tailwind CSS + TipTap + Zustand**.
Runs on Windows and macOS (and Linux), stores everything locally, and uses a frameless window.

## Screenshots

| Dark | Light |
| --- | --- |
| ![Page in dark mode](docs/screenshots/01-page-dark.png) | ![Page in light mode](docs/screenshots/01-page-light.png) |
| ![Slash menu](docs/screenshots/02-slash-menu-dark.png) | ![Icon picker](docs/screenshots/05-icon-picker-light.png) |
| ![Search](docs/screenshots/04-search-dark.png) | ![Collapsed sidebar](docs/screenshots/06-sidebar-collapsed-light.png) |
| ![Page menu](docs/screenshots/03-page-menu-dark.png) | ![Getting started](docs/screenshots/07-getting-started-dark.png) |
| ![Mermaid editing](docs/screenshots/09-mermaid-editing-dark.png) | ![Pasted images](docs/screenshots/08-pasted-image-light.png) |
| ![Mermaid diagrams](docs/screenshots/10-mermaid-dark.png) | ![Mermaid diagrams light](docs/screenshots/11-mermaid-light.png) |
| ![Tasks matrix](docs/screenshots/12-tasks-matrix-dark.png) | ![Tasks matrix light](docs/screenshots/13-tasks-matrix-light.png) |
| ![Task dialog](docs/screenshots/14-task-dialog-light.png) | ![Reminder settings](docs/screenshots/15-reminder-settings-light.png) |
| ![Block handle menu](docs/screenshots/16-block-handle-menu-light.png) | ![Dragging a block](docs/screenshots/18-drag-drop-line-light.png) |

## Features

- **Nested page tree** (`parentId` hierarchy) with fold/unfold animation, hover `+` to add sub-pages, `•••` menu (Add sub-page / Rename / Delete), double-click or `F2` to rename, resizable & collapsible sidebar.
- **Block editor (TipTap)** with a **`/` slash menu**: Text, Heading 1–3, To-do list, Bulleted list, Numbered list, Quote, Code, Divider. Markdown shortcuts (`#`, `-`, `1.`, `[]`, `>`, ```` ``` ````) work too.
- **Images**: paste (`Ctrl/⌘+V`, e.g. a screenshot), drag files in from your desktop, or use `/image` to pick files. Drag the side handles to resize; click an image and press Delete to remove it. PNG, JPEG, GIF, WebP, AVIF, BMP and SVG up to 25 MB.
- **Mermaid diagrams**: `/mermaid` adds a diagram block → paste or type the code (live preview) → **Save** (`Ctrl/⌘+Enter`) renders it in the note. Double-click or **Edit** to change it. Pasting a ```` ```mermaid ```` fenced block creates a diagram directly. Diagrams follow the dark/light theme; invalid code shows the parse error.
- **Tasks – Eisenhower Matrix** (sidebar → **Tasks**, or `Ctrl/⌘+Shift+T`): four quadrants: *Do first* (important & urgent), *Schedule* (important), *Delegate* (urgent) and *Eliminate* (neither). Add tasks per quadrant, drag them between quadrants, tick them off, show or hide completed ones. The sidebar badge counts tasks due today or overdue.
- **Due dates & reminders**: click a task to set a due date (with *Today 17:00 / Tomorrow 9:00 / Next week* shortcuts) and reminders: at the due time, 5 min, 15 min, 30 min, 1 h, 3 h, 1 day or 1 week before. **Reminders → Default reminders** sets which ones new tasks get. Reminders are native OS notifications, and clicking one opens the task.
- **Move blocks freely**: hover any block (text, heading, list item, image, diagram) to show a **⋮⋮** handle. Drag it to move the block; a blue line shows where it will land. Click the handle for *Move up/down, Duplicate, Delete* and, for images and diagrams, *Align left/center/right*. **+** adds a block below. You can also press `Ctrl/⌘+Shift+↑/↓` to move the current block. Typing while an image or diagram is selected starts a new line instead of replacing it.
- **Page header**: editable title, emoji icon picker, cover picker (gradient gallery or image URL).
- **Global search** (`Ctrl/⌘+K`) over titles **and** page content, with snippets.
- **Dark / light theme** using the Notion palette (`#191919`/`#202020`/`#D4D4D4` and `#FFFFFF`/`#F7F7F5`/`#37352F`).
- **Auto-save** 500 ms after you stop typing, with a Saving…/Saved indicator.
- **Frameless window**: native traffic lights on macOS, custom minimize/maximize/close on Windows/Linux.

### Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl/⌘ + K` | Search |
| `Ctrl/⌘ + N` | New page |
| `Ctrl/⌘ + \` | Toggle sidebar |
| `Ctrl/⌘ + Shift + L` | Toggle dark/light |
| `Ctrl/⌘ + Shift + T` | Open Tasks (Eisenhower Matrix) |
| `/` | Block menu (in editor) |
| `Ctrl/⌘ + Shift + ↑ / ↓` | Move the current block up/down |
| `Enter` / `↓` in title | Jump into the page body |

## Getting started

```bash
npm install
```

```bash
npm run dev
```

`npm run dev` starts Vite and launches Electron with hot reload. (Opening the Vite URL in a normal browser also works — the app falls back to `localStorage` there, which is handy for UI work.)

## Building installers

```bash
npm run dist:win
```

```bash
npm run dist:mac
```

Output goes to `dist_electron/`. Build Windows installers on Windows and macOS installers on a Mac
(cross-building NSIS from Linux/macOS requires `wine`). The **Build installers** GitHub Actions
workflow (`.github/workflows/build.yml`, run manually or on a `v*` tag) produces both and uploads them as artifacts.
Builds are unsigned, so macOS Gatekeeper / Windows SmartScreen will warn on first launch.

## Project layout

```
electron/
  main.ts          # BrowserWindow (frameless), IPC handlers, flush-on-close
  preload.ts       # contextBridge → window.electronAPI
  storage.ts       # JSON-file page storage (atomic writes, per-page write queue)
  assets.ts        # Image files + notion-asset:// protocol + unused-image cleanup
  tasks.ts         # Task + settings storage and the reminder check
src/
  types.ts         # Page / PageMeta / ElectronAPI contracts shared by both processes
  stores/useAppStore.ts   # Zustand: pages, activePageId, expanded nodes, sidebar, theme, search
  lib/autoSave.ts  # Debounced auto-save engine (per-page timers, flush, cancel)
  lib/reminders.ts # Quadrants, reminder presets and reminder rules (shared by main + renderer)
  stores/useTaskStore.ts  # Zustand store for tasks and reminder settings
  lib/api.ts       # window.electronAPI, or a localStorage fallback in a plain browser
  components/
    Sidebar/       # Sidebar + recursive PageTreeItem
    Editor/        # PageView, PageHeader (title/icon/cover), TipTap Editor, slash menu
    TitleBar/      # Top bar (breadcrumbs, save status) + Windows/Linux window controls
    Search/        # Ctrl+K search palette
    Tasks/         # Eisenhower Matrix, task cards, task dialog, reminder settings
    Editor/mermaid/  # Mermaid diagram block (node, view, lazy renderer)
resources/         # App icons (icon.ico, icon.icns, icon.png, icon.svg)
```

## Data storage

Each page is a JSON file at `<userData>/pages/<id>.json`, where `<userData>` is:

- Windows: `%APPDATA%\notion-clone`
- macOS: `~/Library/Application Support/notion-clone`
- Linux: `~/.config/notion-clone`

Images are stored as separate files in `<userData>/assets/` and referenced from pages as
`notion-asset://local/<file>`, so page files stay small. The app only serves files from that folder with
names it generated. At startup, images that no page uses anymore are deleted.

Tasks are stored in `<userData>/tasks.json` and reminder settings in `<userData>/task-settings.json`.

### How reminders work

- The scheduler runs in the main process and checks every 15 seconds, so reminders arrive while you're on any page.
- **Windows/Linux:** closing the window keeps the app running in the system tray, so reminders still arrive. Quit from the tray icon, or turn this off under *Tasks → Reminders*.
- **macOS:** the app keeps running in the Dock after its window closes, as usual. Reminders stop when you quit with ⌘Q.
- Each reminder fires once. Reminders whose time had already passed when you set the due date don't fire. Changing the due date sets up its reminders again.
- If the app wasn't running when reminders were due, you get one *missed reminder* notification per task the next time it starts. Reminders more than 7 days old are skipped.
- Use *Tasks → Reminders → Send test notification* to check that your OS allows notifications. On macOS, allow NotionClone under System Settings → Notifications. On Windows, check Focus Assist.

Set `NOTION_CLONE_DATA_DIR=/some/folder` to use a different folder (handy for testing).

How saving stays safe:

- Writes go to a temp file and are then renamed, so a crash never leaves a half-written page.
- Reads and writes for the same page run in order in the main process.
- Edits wait in a separate debounce timer for each page. Switching pages saves the page you left right away, and a page's pending edits are saved before it is loaded again.
- Before the window closes, the app saves any edits still waiting.
- Deleting a page cancels its pending saves, and the main process ignores saves that arrive late for a deleted page, so deleted pages don't come back.

UI preferences (theme, sidebar width, expanded nodes, last open page) are kept in `localStorage`.
