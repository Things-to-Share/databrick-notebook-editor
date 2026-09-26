/* Databricks Local Notebook IDE - configuration & utility overrides.
 * This file is optional: adb.js falls back to sensible built-in defaults for
 * anything not defined here. Edit these values to customize the editor
 * without touching adb.js.
 */
window.ADB_CONFIG = {
  // Debounce timings (ms)
  draftSaveDebounceMs: 300,
  diskSaveDebounceMs: 900,

  // Default theme: 'dark' | 'light'
  defaultTheme: 'dark',

  // Cell accent colors (per Databricks magic language), used as CSS custom
  // properties (--cell-*) so they can be tuned without editing adb.css.
  cellColors: {
    python: '#00ff00',
    sql: '#2600ff',
    markdown: '#d900ff',
    scala: '#8c3d1c',
    r: '#4a5fa5',
    other: '#5a5a5a',
  },

  // Maps a file extension (lowercase, no dot) to a syntax-highlighting
  // language understood by adb.js's `highlightForLanguage`.
  extLanguageMap: {
    py: 'python',
    sql: 'sql',
    md: 'markdown',
    markdown: 'markdown',
    yml: 'yaml',
    yaml: 'yaml',
    css: 'css',
    scss: 'css',
    html: 'html',
    htm: 'html',
    js: 'javascript',
    mjs: 'javascript',
    cjs: 'javascript',
    json: 'json',
    xml: 'xml',
    ps1: 'powershell',
    psm1: 'powershell',
    psd1: 'powershell',
    sh: 'shell',
    txt: 'text',
  },

  // Maps a file extension (lowercase, no dot) to an emoji icon shown in the
  // navigation tree. Falls back to a generic document icon when missing.
  extIcons: {
    py: '\uD83D\uDC0D',
    sql: '\uD83D\uDDC3\uFE0F',
    md: '\uD83D\uDCDD',
    markdown: '\uD83D\uDCDD',
    yml: '\u2699\uFE0F',
    yaml: '\u2699\uFE0F',
    json: '\uD83D\uDD22',
    css: '\uD83C\uDFA8',
    scss: '\uD83C\uDFA8',
    html: '\uD83C\uDF10',
    htm: '\uD83C\uDF10',
    js: '\uD83D\uDFE8',
    mjs: '\uD83D\uDFE8',
    xml: '\uD83D\uDCC0',
    ps1: '\uD83D\uDC9B',
    sh: '\uD83D\uDCBB',
    ipynb: '\uD83D\uDCD3',
    scala: '\uD83D\uDD34',
    r: '\uD83D\uDD35',
  },

  // Extra keywords merged into the built-in Python / SQL keyword lists.
  extraPythonKeywords: [],
  extraSqlKeywords: ['DATABRICKS', 'DELTA', 'OPTIMIZE', 'VACUUM', 'ZORDER', 'CLONE', 'STREAM'],

  // URL used to lazily load Pyodide for in-browser Python cell execution.
  // Points at the copy vendored under editor/libraries/pyodide (downloaded
  // from the jsdelivr CDN) so the app works fully offline; swap back to a
  // CDN URL (e.g. 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js')
  // if you'd rather not ship the ~13MB runtime. Leave empty to disable the
  // "Run" button's actual execution (UI still works, but will show a message
  // instead). Pyodide's sibling files (pyodide.asm.js/.wasm, python_stdlib.zip,
  // pyodide-lock.json) are resolved relative to this file's own directory.
  pyodideCdnUrl: 'libraries/pyodide/pyodide.js',

  // URL used to lazily load Mermaid, for rendering `%%mermaid` diagrams
  // inside Python cells. Points at the copy vendored under
  // editor/libraries/mermaid so the app works fully offline; swap back to a
  // CDN URL (e.g. 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js')
  // if preferred. Leave empty to disable diagram rendering (the raw code
  // will be shown instead).
  mermaidCdnUrl: 'libraries/mermaid/mermaid.min.js',
};
