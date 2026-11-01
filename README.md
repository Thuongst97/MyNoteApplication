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
| ![Code highlighting](docs/screenshots/31-code-highlight-light.png) | ![Mermaid doc](docs/screenshots/32-mermaid-doc-dark.png) |
| ![Markdown block editing](docs/screenshots/47-markdown-editing-light.png) | ![Rendered Markdown](docs/screenshots/48-markdown-rendered-light.png) |
| ![Pasted Markdown](docs/screenshots/49-markdown-pasted-light.png) | ![Table toolbar](docs/screenshots/50-table-toolbar-dark.png) |
| ![Tasks matrix](docs/screenshots/12-tasks-matrix-dark.png) | ![Tasks matrix light](docs/screenshots/13-tasks-matrix-light.png) |
| ![Task dialog](docs/screenshots/14-task-dialog-light.png) | ![Reminder settings](docs/screenshots/15-reminder-settings-light.png) |
| ![Block handle menu](docs/screenshots/16-block-handle-menu-light.png) | ![Dragging a block](docs/screenshots/18-drag-drop-line-light.png) |
| ![Text color menu](docs/screenshots/19-text-color-menu-light.png) | ![Formatted text](docs/screenshots/21-formatted-text-dark.png) |
| ![Chart editor](docs/screenshots/22-chart-editor-light.png) | ![Line chart](docs/screenshots/23-chart-line-dark.png) |
| ![Charts](docs/screenshots/24-charts-dark.png) | ![Drawing in a note](docs/screenshots/27-drawing-in-note-dark.png) |
| ![Drawing editor](docs/screenshots/25-drawing-editor-light.png) | ![Page links](docs/screenshots/28-page-links-light.png) |
| ![Block reference jump](docs/screenshots/29-block-reference-jump-light.png) | ![Whiteboard](docs/screenshots/30-whiteboard-light.png) |
| ![Graph view](docs/screenshots/31-graph-view-dark.png) | ![Mind map in a page](docs/screenshots/34-mindmap-in-note-dark.png) |
| ![Mind map editor](docs/screenshots/32-mindmap-editor-light.png) | ![Mind map (light)](docs/screenshots/33-mindmap-in-note-light.png) |
| ![Mind map colors](docs/screenshots/35-mindmap-colors-editor-light.png) | ![Colored mind map](docs/screenshots/36-mindmap-colors-dark.png) |
| ![Dragging the page edge](docs/screenshots/37-page-width-drag-light.png) | ![Page width menu](docs/screenshots/38-page-width-menu-light.png) |
| ![Full-width page](docs/screenshots/39-page-full-width-light.png) | ![Libraries panel](docs/screenshots/40-libraries-panel-light.png) |
| ![Collapsed libraries](docs/screenshots/41-libraries-collapsed-light.png) | ![Libraries in a drawing](docs/screenshots/42-libraries-drawing-light.png) |
| ![Mind map with moved topics](docs/screenshots/43-mindmap-free-positions-light.png) | ![Moved topics in the page](docs/screenshots/44-mindmap-free-positions-page-light.png) |
| ![Two-way arrow tool](docs/screenshots/45-two-way-arrow-tool-light.png) | ![Two-way arrows](docs/screenshots/46-two-way-arrows-light.png) |

## Features

- **Nested page tree** (`parentId` hierarchy) with fold/unfold animation, hover `+` to add sub-pages, `•••` menu (Add sub-page / Rename / Delete), double-click or `F2` to rename, resizable & collapsible sidebar.
- **Block editor (TipTap)** with a **`/` slash menu**: Text, Heading 1–3, To-do list, Bulleted list, Numbered list, Quote, Code, Divider. Markdown shortcuts (`#`, `-`, `1.`, `[]`, `>`, ```` ``` ````) work too.
- **Images**: paste (`Ctrl/⌘+V`, e.g. a screenshot), drag files in from your desktop, or use `/image` to pick files. Drag the side handles to resize; click an image and press Delete to remove it. PNG, JPEG, GIF, WebP, AVIF, BMP and SVG up to 25 MB.
- **Mermaid diagrams**: `/mermaid` adds a diagram block → paste or type the code (live preview) → **Save** (`Ctrl/⌘+Enter`) renders it in the note. Double-click or **Edit** to change it. Pasting a ```` ```mermaid ```` fenced block creates a diagram directly. Diagrams follow the dark/light theme; invalid code shows the parse error.
- **Code blocks with syntax highlighting**: `/code` adds a code block colored like a code editor (VS Code Light+/Dark+ palettes). The language is auto-detected (shown as "Auto · Kotlin") or picked from the dropdown (~35 languages incl. Kotlin, Java, TypeScript, Python, Go, Rust, Swift, C#, SQL, Bash, JSON, YAML). Tab/Shift+Tab indent, spellcheck is off, and **Copy** copies the code.
- **Mermaid docs**: `/mermaid doc` adds a Mermaid *code* block — the source stays visible and highlighted, with the rendered diagram live underneath (updates as you type; **Hide diagram** to collapse). Any code block set to Mermaid (or a ```` ```mermaid ```` typed fence) works the same way.
- **Markdown**: paste Markdown anywhere (a README, notes from VS Code, ChatGPT answers…) and it turns into real blocks: headings, bold/italic/code, links, bullet/numbered/to-do lists, quotes, dividers, **tables**, highlighted code and Mermaid docs. Or use `/markdown` for a Markdown block: paste or type the source with a live side-by-side preview, save to see it rendered, double-click to edit, **To blocks** to turn it into normal editable blocks, and **Copy** for the source. Content is sanitized (scripts, event handlers, iframes, styles and non-http(s) links are removed). Only https and embedded images load; images with relative paths show as 🖼 placeholders with their alt text.
- **Tables**: `/table` adds a 3×3 table with a header row. `Tab`/`Shift+Tab` move between cells (Tab in the last cell adds a row). While the cursor is in a table, a toolbar under it adds rows above/below and columns left/right, deletes rows/columns, toggles the header row, merges/splits selected cells and deletes the table.
- **Tasks – Eisenhower Matrix** (sidebar → **Tasks**, or `Ctrl/⌘+Shift+T`): four quadrants: *Do first* (important & urgent), *Schedule* (important), *Delegate* (urgent) and *Eliminate* (neither). Add tasks per quadrant, drag them between quadrants, tick them off, show or hide completed ones. The sidebar badge counts tasks due today or overdue.
- **Due dates & reminders**: click a task to set a due date (with *Today 17:00 / Tomorrow 9:00 / Next week* shortcuts) and reminders: at the due time, 5 min, 15 min, 30 min, 1 h, 3 h, 1 day or 1 week before. **Reminders → Default reminders** sets which ones new tasks get. Reminders are native OS notifications, and clicking one opens the task.
- **Text formatting**: select text to get a toolbar with *Turn into* (text, H1–H3, bulleted/numbered/to-do list, quote, code), **text size** (Small → Huge), bold/italic/underline/strike/code, links, and **text & background colors**. Colors adapt to dark/light mode.
- **Charts**: `/chart` adds a chart block. Pick *Columns, Bars, Line, Area* or *Parts of a whole*, type the data into the grid or **paste it from Excel/Google Sheets/CSV**, and save. Charts have hover tooltips, a legend, a *Table* view of the exact numbers, and colors that work for color-blind readers in both themes.
- **Drawings (PowerPoint-style)**: `/drawing` opens a full-window drawing editor (Excalidraw) with rectangles, diamonds, ellipses, arrows that stay attached to shapes, lines, text and text inside shapes, freehand pen, images, fill/stroke colors, layers, grouping and alignment. Clean lines and a regular font by default. Saved drawings appear in the note as sharp images that match the theme. Double-click a drawing to edit it, and text inside drawings is searchable.
- **Mind maps**: `/mindmap` adds a mind map (its central topic starts as the page title), or use **⋮⋮ → Turn list into mind map** on any bullet/numbered/to-do list. The full-window editor is keyboard-driven:

  | Key | Action |
  | --- | --- |
  | **Tab** | Add a sub-topic |
  | **Enter** | Add a topic at the same level |
  | Start typing / **F2** / double-click | Edit the selected topic |
  | **Delete** | Remove the selected topic |
  | **Space** | Fold or unfold a branch |
  | **Arrow keys** | Move between topics |
  | **Alt+↑/↓** | Reorder topics |
  | **Home** | Jump to the central topic |
  | `Ctrl/⌘+Z` | Undo |

  **Positioning topics:**
  - **Drag a topic anywhere:** it stays where you drop it, and its sub-topics move with it.
  - **Drop it onto another topic** (dashed highlight) to attach it there instead.
  - **Drag a main branch across the central topic** to move it to the other side.
  - **Shift+arrow keys** nudge the selected topic in 10px steps.
  - **Tidy up** puts every topic back into the automatic layout.

  You can also choose a *both sides* or *right-only* layout, and pan or zoom the map.

  **Colors:** select any topic, including the central topic, and pick a color from the toolbar's color button or the side panel. Choose one of 8 palette colors (they adjust for dark mode) or **Custom…** for any color. Sub-topics take their parent's color unless they have their own, and **Auto** resets a topic to the inherited color. The **Notes** panel lets you document each topic; topics with notes show a dot, and hovering them in the page shows the notes. Maps appear in the page as sharp images that match the theme, can be turned back into an outline (**To outline**), and all their topics and notes are searchable.
- **Sub-pages in documents**: `/page` creates a sub-page and opens it. The parent keeps a clickable link block. Sub-pages also appear nested in the sidebar.
- **Page links & block references**: type `[[` (anywhere) or `@` (after a space) to link to any page, or create one on the spot. To link to a specific block, open the block's **⋮⋮ → Copy link to block** and paste it into any page. It shows as *Page › start of block*, and clicking it opens the page, scrolls to the block and highlights it. Each page lists **Linked from** (backlinks) at the bottom. **Copy link to page** is in the sidebar page menu.
- **Graph view** (sidebar, or `Ctrl/⌘+Shift+G`): every page as a node, connected by links and (optionally) sub-page relations. Drag nodes, pan, zoom, and hover to highlight connections. Search to find a page, and click a node to open it.
- **Infinite canvas / whiteboard pages**: **New whiteboard** in the sidebar (or *Add whiteboard inside* on a page) creates a page that is one endless canvas with shapes, arrows, text, pen, images, colors and layers. Changes save automatically. Shapes can link to pages (paste a copied page link into a shape's link), and clicking the link opens the page. Whiteboard text is searchable, and whiteboards appear in the sidebar, search and graph.
- **Two-way arrows**: whiteboards and drawings have a **↔ Two-way arrow** tool right after the arrow tool, for arrows with heads at both ends. Like the other tools it applies to the next arrow; with the tool lock 🔒 it stays on. Choosing the normal arrow (or pressing `A` / `5`) goes back to one-way arrows. Existing arrows can still be changed in the style panel under *Arrowheads*.
- **Drawing libraries (saved permanently)**: in any whiteboard or drawing, the **Library** button opens a panel where every library is its own **collapsible category**, with **Expand all / Collapse all**, search (by library name, item name or text inside items), and per-library **Rename / Update from source / Delete**. Items can be deleted one by one.
  - **Install:** **Browse libraries** opens the Excalidraw libraries website in an app window. Clicking *Add to Excalidraw* there downloads the library and saves it. You can also **Install from link** or **Import file (.excalidrawlib)**.
  - **Use:** click an item to place it in the middle of the view, or drag it onto the canvas.
  - **Personal library:** keeps your own shapes (*Add selected shapes*, or the canvas menu's *Add to library*).
  - **Storage:** everything is saved in `libraries.json` and shared by all whiteboards and drawings.
- **Move blocks freely**: hover any block (text, heading, list item, image, diagram) to show a **⋮⋮** handle. Drag it to move the block; a blue line shows where it will land. Click the handle for *Move up/down, Duplicate, Delete* and, for images and diagrams, *Align left/center/right*. **+** adds a block below. You can also press `Ctrl/⌘+Shift+↑/↓` to move the current block. Typing while an image or diagram is selected starts a new line instead of replacing it.
- **Adjustable page width** (per page): drag the left or right edge of a page to make it wider or narrower (a live label shows the width; drag to the window edge for full width, double-click the edge to reset), or use **••• → Page width** in the top bar for *Narrow / Default / Wide / Full* and a slider.
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
| `Ctrl/⌘ + Shift + G` | Open Graph view |
| `[[` or `@` | Link to a page (in the editor) |
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

## Tests

```bash
npm test
```

Unit tests use [Vitest](https://vitest.dev) with jsdom and React Testing Library. They live in `tests/`:

| Folder | What it covers |
| --- | --- |
| `tests/lib` | Reminder rules, links, search text, dates, auto-save engine, image helpers, the browser fallback API |
| `tests/electron` | Main-process storage in a temp folder: pages (atomic writes, cascade delete, link index, path checks), image assets and cleanup, tasks/settings |
| `tests/editor` | A real TipTap editor with the app's nodes: moving/duplicating/dropping blocks, block ids & references, Mermaid/chart/drawing/mind map/link nodes, slash commands, chart data parsing, mind map edits/layout/navigation/list conversion, text formatting |
| `tests/stores` | Page/navigation store and task store |
| `tests/components` | UI behavior: Eisenhower Matrix, task dialog, mind map editor (keyboard, notes, folding, undo), menus, sidebar, search, breadcrumbs, backlinks, graph, plus an integration test of the whole app (editor, shortcuts, page header, Mermaid, charts, drawings, page links) |

Other commands:

```bash
npm run test:watch
```

```bash
npm run test:coverage
```

```bash
npm run typecheck:test
```

`test:watch` re-runs tests on change, `test:coverage` writes an HTML report to `coverage/`, and `typecheck:test` type-checks the tests.

Tests are **not part of release builds**:
- `npm run build` only compiles `src/` and `electron/`.
- Vite only bundles code the app imports.
- `electron-builder` only packages `dist/` and `dist-electron/`, and explicitly excludes test files.
- The test tools are all dev dependencies, so they're never shipped.

`npm run dist`, `dist:win` and `dist:mac`, and the GitHub Actions build, run the tests first and stop if any fail.

## Security

The app treats everything outside its own code as untrusted (pasted content, downloaded libraries, the libraries website, files on disk).

**App windows and processes**
- **Isolated app pages:** pages run sandboxed with context isolation and no Node.js access. They reach the main process only through a small preload API, and every message is checked to come from the app's own page.
- **Content Security Policy:** scripts load only from the app itself. Objects, frames, `<base>` and form submissions are blocked.
- **Navigation and links:** the app window can't be navigated away. New windows and `<webview>`s are blocked everywhere, and only `http(s)` links are handed to the system browser (never `file:`, `javascript:` or other schemes).
- **Permissions:** everything is denied by default (camera, microphone, location, notifications, …). Only clipboard and fullscreen are allowed, and only to the app's own page.

**Content and stored data**
- **Untrusted markup:** pasted HTML, drawing previews and library thumbnails are sanitized (DOMPurify) before display. Links with `javascript:`/`data:` addresses are refused. Page covers accept only safe gradients, colors and https/data images.
- **Stored images:** images are served from `notion-asset://`, which only resolves file names the app created inside its assets folder, with `nosniff` and a no-script policy.
- **Validation:** page fields, task fields, mind maps, charts, drawings and libraries are validated when saved and again when loaded. Damaged data falls back safely, and a broken block or page shows an error message instead of crashing the app.

**Libraries website and downloads**
- **Browse libraries:** the site opens in a separate in-memory session. It can't use the app's storage or `notion-asset://`, can't download files or request permissions, and installing a library always asks for confirmation.
- **Downloads:** library downloads are https-only (checked again after redirects), capped at 20 MB while streaming, time out after 30 s, and are validated before saving.

**Release builds**
- **No developer access:** dev tools, the reload shortcut and the test overrides (`NOTION_CLONE_LIBRARIES_URL`, http downloads) are disabled.
- **Electron fuses:** `ELECTRON_RUN_AS_NODE`, `NODE_OPTIONS` and `--inspect` are disabled. The app loads only from its archive, archive integrity validation and cookie encryption are on.

**Dependencies:** `npm audit` reports no high or critical issues. Patched versions of `nanoid`, `katex` and `lodash-es` are forced through `overrides`. The remaining moderate advisories are in the electron-builder build tooling, which isn't shipped and isn't exploitable through our own build config.

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
  libraries.ts     # Drawing libraries: storage, downloads, file import
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
    Library/       # Categorized drawing-library panel (insert, drag, rename, delete, install)
    Editor/code/     # Highlighted code block (lowlight, language detection, Mermaid grammar + live preview)
    Editor/markdown/ # Markdown block (source + sanitized rendered view, convert to blocks)
    Editor/mermaid/  # Mermaid diagram block (node, view, lazy renderer)
    Editor/mindmap/  # Mind map block: model (edits, layout, list conversion), SVG renderer, editor
resources/         # App icons (icon.ico, icon.icns, icon.png, icon.svg)
```

## Data storage

Each page (document or whiteboard) is a JSON file at `<userData>/pages/<id>.json`, where `<userData>` is:

- Windows: `%APPDATA%\notion-clone`
- macOS: `~/Library/Application Support/notion-clone`
- Linux: `~/.config/notion-clone`

Images are stored as separate files in `<userData>/assets/` and referenced from pages as
`notion-asset://local/<file>`, so page files stay small. The app only serves files from that folder with
names it generated. At startup, images that no page uses anymore are deleted.

Links between pages are stored inside the page content and use the internal URL format
`notionclone://page/<pageId>#<blockId>`. The main process keeps a link index for backlinks and the graph.

Drawing libraries are stored in `<userData>/libraries.json`. Downloads are https-only, limited to 20 MB, and checked to be valid `.excalidrawlib` files before saving.

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
