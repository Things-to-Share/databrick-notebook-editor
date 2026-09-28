# Databricks Local Notebook IDE

A local IDE for creating and editing Databricks notebooks directly against files on disk — no backend, no server, no build step. Open a folder, edit `.py` / `.sql` / `.ipynb` notebooks (and plain files like `.md`, `.yml`, `.json`, etc.) with Databricks-aware cell parsing, syntax highlighting, and a notebook structure outline, then save straight back to the same files on your machine.

This repo contains two implementations of the same cell-editing UX:

- **[`web-editor/`](web-editor/)** — a standalone, browser-based app (`adb.html`), described below.
- **[`vscode-extension/`](vscode-extension/)** — a native VS Code custom editor extension, described in [VS Code Extension](#vs-code-extension-vscode-extension) below.

## Why

Databricks notebooks are plain text files (`# Databricks notebook source` + `# COMMAND ----------` separated cells with `%sql` / `%python` / `%md` magics), but there's no lightweight way to view and edit them with proper cell-based UX outside of the Databricks workspace itself. This tool renders those raw files as an actual notebook editor, entirely client-side, and writes changes back in the same Databricks-compatible format.

## Features

- **Three-panel layout**: resizable/collapsible file navigation panel, the notebook editor, and (for notebooks) a right-hand structure/outline panel.
- **Databricks-aware parsing**: `.py` and `.sql` notebook source files are split into cells based on `# COMMAND ----------` separators, with support for:
  - Per-cell language magics (`%sql`, `%python`, `%md`) and a notebook-wide default language.
  - Cell titles (`DBTITLE`), stored and displayed without escaping/quoting.
  - The `%skip` marker, shown as a checkbox instead of raw text.
  - The `%run` marker (executes another notebook), kept visible in the cell body since it isn't a selectable language.
  - `.ipynb` (Jupyter) notebooks.
- **Other file types** (Markdown, YAML, JSON, CSS, HTML, JS, XML, PowerShell, shell, plain text, ...) open as a single scrollable cell with automatic syntax highlighting — no ability to add extra cells.
- **Multi-tab editing**: pinnable, draggable, double-click-to-rename tabs, with an optional side-by-side split editor.
- **Notebook structure panel**: navigate by Markdown headers and cell titles; sections are collapsible and stay in sync with the editor.
- **Dark / light theme toggle**, applied consistently across every input, button, tab, and panel.
- **Workspace management**: create/rename/delete files and folders, bind additional folders into the workspace, and browse with type-aware icons.
- **Auto-save toggle** in the header (with on/off visual status) — when off, changes are only written to disk on explicit save (`Ctrl+S` / Save button); a local draft is still kept in `localStorage` as a safety net.
- **In-browser Python execution** for Python cells via [Pyodide](https://pyodide.org/) (lazily loaded from a CDN), including error output. SQL cells show a note that execution requires a real Databricks/Spark connection.

## Getting started

1. Open [`adb.html`](adb.html) in a recent version of **Chrome** or **Edge** (any browser with the [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API)).
2. Click **Open Repository Folder…** and pick the local folder containing your Databricks notebooks / repo.
3. Double-click a file in the navigation panel to open it. Notebooks (`.py`, `.sql`, `.ipynb` in Databricks source format) render as cells; everything else renders as a single editable file.
4. Edit cells, titles, and languages as needed — changes are written back to disk automatically (or on save, if auto-save is turned off).

> **Note:** This is a static, client-only app. There is no install step — just open `adb.html`. It won't work in browsers without File System Access API support (e.g. Firefox, Safari).

## VS Code Extension (`vscode-extension/`)

In addition to the standalone web app above, this repo includes a native **VS Code custom editor extension** (`vscode-extension/`) that provides the same Databricks notebook cell-editing experience directly inside VS Code — no File System Access API and no browser permission prompts, since it reads/writes through VS Code's own `TextDocument`/`WorkspaceEdit` APIs.

### Features

- **Custom editor for Databricks notebooks**: registers a "Databricks Notebook Editor" custom editor for `.py`, `.sql`, `.ipynb` — opt-in via *Open With…* or the Explorer context-menu command **"Open as Databricks Notebook"**, so it never hijacks normal Python/SQL editing.
- **Other file types too**: also selectable for `.md`, `.yml`/`.yaml`, `.json`, `.xml`, `.html`/`.htm`, `.css`, `.js`, `.ps1`, opened as a single syntax-highlighted editor (no cell add/remove).
- **Native VS Code integration**: saving, dirty-state tracking, and undo/redo all work through VS Code's normal document model (`Ctrl+Z`, the dirty-dot tab indicator, etc.) — no separate file-permission flow.
- **Convert plain files to Databricks notebooks**: `.py`/`.sql` files missing the `Databricks notebook source` header show a compatibility warning plus a **"Convert to Databricks Notebook"** button that wraps the original content verbatim into the notebook's first cell.
- **Full Databricks cell model**: `# COMMAND ----------` cell splitting, `DBTITLE` cell titles (stored/displayed unescaped), per-cell language magics (`%sql`/`%python`/`%md`), the `%skip` checkbox, an always-visible `%run` marker, and `.ipynb` support — the same parsing engine as the web editor.
- **Notebook structure panel**: outline built from Markdown headers and cell titles, with live search/filter, a draggable resize handle, scrollspy-style highlighting of the active section while scrolling, and per-section expand/collapse that's remembered across reopens.
- **Auto-save toggle**: a header checkbox turns auto-save on/off with a color-coded, theme-aware toolbar background reflecting the current state; when off, changes are only written via `Ctrl+S`/the Save button, and a "last saved" timestamp is shown.
- **Default-language dropdown** (Markdown / SQL / Python): switching between SQL and Python renames the underlying file's extension and automatically re-tags cells with the correct `%sql`/`%python` markers.
- **Cell toolbar**: editable title, per-cell language dropdown, skip checkbox, collapse/expand caret, and add-cell-above/add-cell-below buttons.
- **Drag-and-drop cell reordering** via a dedicated drag handle, alongside the existing ▲/▼ move buttons.
- **Syntax highlighting** for Python, Databricks/Spark SQL, Markdown, JSON, YAML, XML/HTML, CSS, JS, and PowerShell — theme-aware for both dark and light VS Code themes using native `--vscode-*` CSS variables.
- **Markdown cells**: rendered live preview (including tables) when not being edited, editable textarea when focused.
- **Python cell execution**: in-webview Python execution via a vendored [Pyodide](https://pyodide.org/) runtime, with a per-cell **▶ Run** button and inline output/error display. (SQL cells remain informational-only — there's no local warehouse to execute against.)
- **Mermaid diagrams**: Python cells containing a `%%mermaid` magic or a `render_mermaid("""...""")` call render as a live diagram using a vendored Mermaid runtime; double-click the diagram to switch back to editing its source.
- **Fully offline**: Pyodide and Mermaid are vendored locally under `vscode-extension/media/libraries/`, so the extension works with no internet connection once installed.
- **UI state persistence**: auto-save preference, collapsed sections/cells, and structure-panel width are remembered per file across close/reopen (via VS Code's `workspaceState`).
- **Line-number gutters** on every code cell editor.

### Installing / running

There's no build step — plain JS, zero dependencies. Run [`deploy.ps1`](vscode-extension/deploy.ps1) to package and install the extension (it uses `vsce`/the `code` CLI if available, or falls back to copying the extension straight into your VS Code extensions folder):

```powershell
powershell -ExecutionPolicy Bypass -File vscode-extension/deploy.ps1
```

Then reload VS Code (**Developer: Reload Window**) and use **Open With… → Databricks Notebook Editor**, or the Explorer context-menu's **"Open as Databricks Notebook"**, on a `.py`/`.sql`/`.ipynb` file.

To develop/debug the extension itself, open `vscode-extension/` as its own workspace folder and press **F5** to launch an Extension Development Host (see [`.vscode/launch.json`](vscode-extension/.vscode/launch.json)).

## Files

| File | Purpose |
|---|---|
| [`adb.html`](adb.html) | Page markup / layout (top bar, navigation panel, editor panes, structure panel). |
| [`adb.css`](adb.css) | All styling, including the dark/light theme CSS variables and per-language cell accent colors. |
| [`adb.js`](adb.js) | All application logic: file system access, notebook/`.ipynb` parsing & serialization, syntax highlighting, rendering, and state management. |
| [`adb.config.js`](adb.config.js) | Optional overrides (debounce timings, default theme, cell accent colors, extension → language/icon maps, extra keywords, Pyodide CDN URL). Edit this instead of `adb.js` to customize behavior. |

## Configuration

`adb.config.js` is loaded before `adb.js` and merged with built-in defaults via `window.ADB_CONFIG`. You can tweak things like:

- `draftSaveDebounceMs` / `diskSaveDebounceMs` — how aggressively changes are auto-saved.
- `defaultTheme` — `'dark'` or `'light'` on first load.
- `cellColors` — the accent color per Databricks cell language.
- `extLanguageMap` / `extIcons` — add syntax highlighting or icons for additional file extensions.
- `extraPythonKeywords` / `extraSqlKeywords` — extend keyword highlighting (e.g. Databricks/Delta SQL keywords are included by default).
- `pyodideCdnUrl` — where to load Pyodide from for in-browser Python execution (leave empty to disable "Run").

## Databricks notebook format reference

- A notebook file starts with `# Databricks notebook source` (or `-- Databricks notebook source` for SQL).
- Cells are separated by `# COMMAND ----------` (or `-- COMMAND ----------`).
- A cell can start with `# DBTITLE 1,<title>` to give it a title.
- Non-default-language content is wrapped in `# MAGIC` lines, e.g. `# MAGIC %sql` followed by the SQL body.
- `%skip` marks a cell to be skipped and is shown as a checkbox rather than raw text.
- `%run ./path/to/notebook` executes another notebook and is always shown inline (never hidden), since it isn't tied to a specific language.
