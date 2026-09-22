/* Databricks Local Notebook IDE - client-side logic
 * No backend. Uses the File System Access API to read/write files directly
 * inside the git repository folder the user selects as the "root".
 * Drafts are continuously auto-saved to localStorage as a safety net.
 */

(() => {
  'use strict';

  // ---------------------------------------------------------------------
  // Configuration (adb.config.js, optional) & small helpers
  // ---------------------------------------------------------------------

  const CONFIG = window.ADB_CONFIG || {};

  const COMMENT_TOKEN = { py: '#', sql: '--', scala: '//', r: '#' };
  const NOTEBOOK_EXTS = ['py', 'sql'];
  const IGNORED_NAMES = new Set(['.git', '.DS_Store', 'node_modules', '.venv', '__pycache__']);
  const DRAFT_PREFIX = 'adbIde:draft:';
  const IDB_NAME = 'adb-ide';
  const IDB_STORE = 'handles';
  const IDB_ROOT_KEY = 'rootHandle';
  const IDB_EXTRA_ROOTS_KEY = 'extraRootIds';
  const THEME_STORAGE_KEY = 'adbIde:theme';
  const SIDEBAR_COLLAPSED_STORAGE_KEY = 'adbIde:sidebarCollapsed';
  const DISK_SAVE_DEBOUNCE_MS = CONFIG.diskSaveDebounceMs || 900;
  const DRAFT_SAVE_DEBOUNCE_MS = CONFIG.draftSaveDebounceMs || 300;

  // Per-cell language dropdown intentionally only exposes these three
  // Databricks magics; cells without an explicit marker inherit the
  // notebook's default language (see getCellLanguage) and the dropdown
  // reflects that by pre-selecting it, rather than showing a blank option.
  // %run cells are never offered here - they are never "default-language"
  // cells and are only round-tripped when already present in a file.
  const CELL_LANGUAGE_OPTIONS = [
    { value: 'markdown', label: 'Markdown' },
    { value: 'sql', label: 'SQL' },
    { value: 'python', label: 'Python' },
  ];

  const DEFAULT_LANG_OPTIONS = [
    { value: 'markdown', label: 'Markdown', key: 'markdown' },
    { value: 'sql', label: 'SQL', key: 'sql' },
    { value: 'python', label: 'Python', key: 'py' },
  ];

  function defaultLangKey(lang) {
    const found = DEFAULT_LANG_OPTIONS.find((o) => o.value === lang);
    return found ? found.key : 'py';
  }

  // Extension a default-language file gets when its notebook default language
  // is switched, e.g. via the pane's language dropdown.
  const DEFAULT_LANG_EXT = { python: 'py', sql: 'sql' };

  const PY_KEYWORDS = ['False','None','True','and','as','assert','async','await','break','class',
    'continue','def','del','elif','else','except','finally','for','from','global','if','import',
    'in','is','lambda','nonlocal','not','or','pass','raise','return','try','while','with','yield',
    ...(CONFIG.extraPythonKeywords || [])];

  const SQL_KEYWORDS = ['SELECT','FROM','WHERE','JOIN','INNER','LEFT','RIGHT','FULL','OUTER','ON',
    'GROUP','BY','ORDER','HAVING','INSERT','INTO','VALUES','UPDATE','SET','DELETE','CREATE','TABLE',
    'VIEW','DROP','ALTER','AS','AND','OR','NOT','NULL','IS','IN','LIKE','BETWEEN','LIMIT','DISTINCT',
    'UNION','ALL','CASE','WHEN','THEN','ELSE','END','WITH','USING','PARTITION','OVER','DESC','ASC',
    'CAST','EXISTS','MERGE','USE','SCHEMA','DATABASE',
    ...(CONFIG.extraSqlKeywords || [])];

  const JS_KEYWORDS = ['break','case','catch','class','const','continue','debugger','default','delete',
    'do','else','export','extends','finally','for','function','if','import','in','instanceof','let',
    'new','return','super','switch','this','throw','try','typeof','var','void','while','with','yield',
    'async','await','static','get','set','of','null','undefined','true','false'];

  const PS_KEYWORDS = ['begin','break','catch','continue','data','do','dynamicparam','else','elseif',
    'end','exit','filter','finally','for','foreach','function','if','in','param','process','return',
    'switch','throw','trap','try','until','while','Write-Host','Write-Output','Write-Error','Write-Warning',
    'Get-ChildItem','Set-Location','New-Item','Remove-Item','ForEach-Object','Where-Object'];

  // Maps a file extension (no dot) to a `highlightForLanguage` language key.
  const EXT_LANGUAGE_MAP = Object.assign({
    py: 'python', sql: 'sql', md: 'markdown', markdown: 'markdown', yml: 'yaml', yaml: 'yaml',
    css: 'css', scss: 'css', html: 'html', htm: 'html', js: 'javascript', mjs: 'javascript',
    cjs: 'javascript', json: 'json', xml: 'xml', ps1: 'powershell', psm1: 'powershell',
    psd1: 'powershell', sh: 'shell',
  }, CONFIG.extLanguageMap || {});

  // Maps a file extension (no dot) to an emoji icon shown in the nav tree.
  const EXT_ICONS = Object.assign({
    py: '\uD83D\uDC0D', sql: '\uD83D\uDDC3\uFE0F', md: '\uD83D\uDCDD', markdown: '\uD83D\uDCDD',
    yml: '\u2699\uFE0F', yaml: '\u2699\uFE0F', json: '\uD83D\uDD22', css: '\uD83C\uDFA8',
    scss: '\uD83C\uDFA8', html: '\uD83C\uDF10', htm: '\uD83C\uDF10', js: '\uD83D\uDFE8',
    mjs: '\uD83D\uDFE8', xml: '\uD83D\uDCC0', ps1: '\uD83D\uDC9B', sh: '\uD83D\uDCBB',
    ipynb: '\uD83D\uDCD3', scala: '\uD83D\uDD34', r: '\uD83D\uDD35',
  }, CONFIG.extIcons || {});

  function iconForExt(ext) {
    return EXT_ICONS[ext] || '\uD83D\uDCC4';
  }

  function languageForExt(ext) {
    return EXT_LANGUAGE_MAP[ext] || 'text';
  }

  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function debounce(fn, ms) {
    let t = null;
    const wrapped = (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
    wrapped.flush = (...args) => { clearTimeout(t); fn(...args); };
    wrapped.cancel = () => clearTimeout(t);
    return wrapped;
  }

  function extOf(name) {
    const i = name.lastIndexOf('.');
    return i === -1 ? '' : name.slice(i + 1).toLowerCase();
  }

  function nowStr() {
    return new Date().toLocaleTimeString();
  }

  // ---------------------------------------------------------------------
  // IndexedDB helpers (store the directory handle across reloads)
  // ---------------------------------------------------------------------

  function idbOpen() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function idbSet(key, value) {
    const db = await idbOpen();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function idbGet(key) {
    const db = await idbOpen();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  // ---------------------------------------------------------------------
  // Databricks notebook (.py/.sql/.scala/.r) parsing & serialization
  // ---------------------------------------------------------------------

  function isDatabricksSource(content, token) {
    const firstLine = content.split(/\r?\n/, 1)[0].trim();
    return firstLine === `${token} Databricks notebook source`;
  }

  function parseDatabricksNotebook(content, token) {
    const lines = content.split(/\r?\n/);
    lines.shift(); // header line
    if (lines.length && lines[0].trim() === '') lines.shift();

    const cmdRe = new RegExp(`^${escapeRegex(token)} COMMAND -+$`);
    const blocks = [[]];
    for (const line of lines) {
      if (cmdRe.test(line.trim())) {
        blocks.push([]);
      } else {
        blocks[blocks.length - 1].push(line);
      }
    }

    return blocks.map((blockLines) => {
      // trim leading/trailing blank lines
      while (blockLines.length && blockLines[0].trim() === '') blockLines.shift();
      while (blockLines.length && blockLines[blockLines.length - 1].trim() === '') blockLines.pop();
      return parseCellBlock(blockLines, token);
    });
  }

  function unquoteTitle(s) {
    s = s.trim();
    if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) {
      return s.slice(1, -1).replace(/\\"/g, '"');
    }
    return s;
  }

  function formatTitleForSerialize(title) {
    // Titles are written out exactly as stored - no quote-wrapping and no
    // escaping - even when they contain commas or double-quote characters
    // (spec requirement), e.g. a title of `double "quotes" and a single
    // 'quote'` is serialized verbatim as
    // `DBTITLE 1,double "quotes" and a single 'quote'`.
    return title;
  }

  function parseCellBlock(lines, token) {
    let title = '';
    const dbTitleRe = new RegExp(`^${escapeRegex(token)} DBTITLE \\d+,(.*)$`);
    if (lines.length && dbTitleRe.test(lines[0])) {
      title = unquoteTitle(lines[0].match(dbTitleRe)[1]);
      lines = lines.slice(1);
    }

    const magicPrefix = `${token} MAGIC`;
    const isMagic = lines.length > 0 && lines[0].startsWith(magicPrefix);
    if (!isMagic) {
      return { title, language: '', skip: false, source: lines.join('\n') };
    }
    const stripped = lines.map((l) => {
      if (l === magicPrefix) return '';
      if (l.startsWith(magicPrefix + ' ')) return l.slice(magicPrefix.length + 1);
      return l;
    });
    let full = stripped.join('\n');

    // %skip is an optional leading marker line (greys the cell out); it is
    // always hidden from the displayed/editable source, same as the language magic.
    let skip = false;
    const skipMatch = full.match(/^%skip[ \t]*\n?/i);
    if (skipMatch) {
      skip = true;
      full = full.slice(skipMatch[0].length);
    }

    let language = '';
    const m = full.match(/^%(\w+)[ \t]*\n?/);
    if (m) {
      const key = m[1].toLowerCase();
      if (key === 'run') {
        // %run is not language-specific and, unlike %skip/%sql/%python/%md,
        // must remain visible in the cell's editable content (spec
        // requirement) - so it is left in place rather than stripped.
        language = 'run';
      } else {
        language = key === 'md' ? 'markdown' : key;
        full = full.slice(m[0].length);
      }
    }
    return { title, language, skip, source: full };
  }

  // Real Databricks notebooks still use the abbreviated "%md" magic on disk
  // (so files stay compatible when re-imported into Databricks); everywhere
  // in the UI the full word "Markdown" is used instead.
  function languageToMagicKeyword(lang) {
    return lang === 'markdown' ? 'md' : lang;
  }

  function serializeCellBlock(cell, token, defaultLang) {
    const lang = cell.language || '';
    const isRun = lang === 'run';
    // %run's marker is already kept inline in cell.source (see parseCellBlock),
    // so it must never be re-injected as a separate magic line here.
    const needsLangMagic = !isRun && !!lang && lang !== defaultLang;
    const skip = !!cell.skip;
    let body;
    if (needsLangMagic || isRun || skip) {
      const magicLines = [];
      if (skip) magicLines.push('%skip');
      if (needsLangMagic) magicLines.push('%' + languageToMagicKeyword(lang));
      const magicBody = magicLines.length ? magicLines.join('\n') + '\n' + cell.source : cell.source;
      body = magicBody.split('\n').map((l) => (l.length ? `${token} MAGIC ${l}` : `${token} MAGIC`)).join('\n');
    } else {
      body = cell.source;
    }
    if (cell.title) {
      return `${token} DBTITLE 1,${formatTitleForSerialize(cell.title)}\n${body}`;
    }
    return body;
  }

  function serializeDatabricksNotebook(cells, token, defaultLang) {
    const sep = `\n\n${token} COMMAND ----------\n\n`;
    const body = cells.map((c) => serializeCellBlock(c, token, defaultLang)).join(sep);
    return `${token} Databricks notebook source\n\n${body}\n`;
  }

  // ---------------------------------------------------------------------
  // .ipynb parsing & serialization
  // ---------------------------------------------------------------------

  function parseIpynb(content) {
    const json = JSON.parse(content);
    const cells = (json.cells || []).map((c) => ({
      cell_type: c.cell_type || 'code',
      title: (c.metadata && c.metadata.title) || '',
      language: (c.metadata && c.metadata.language) || '',
      skip: (c.metadata && c.metadata.skip) || false,
      source: Array.isArray(c.source) ? c.source.join('') : (c.source || ''),
      metadata: c.metadata || {},
      outputs: c.outputs || [],
      execution_count: c.execution_count ?? null,
    }));
    return { raw: json, cells };
  }

  function serializeIpynb(raw, cells, defaultLang) {
    const out = Object.assign({}, raw);
    out.cells = cells.map((c) => {
      const srcLines = c.source.split('\n');
      const source = srcLines.map((l, i) => (i < srcLines.length - 1 ? l + '\n' : l));
      const metadata = Object.assign({}, c.metadata || {});
      if (c.title) metadata.title = c.title;
      else delete metadata.title;
      if (c.language && c.language !== defaultLang) metadata.language = c.language;
      else delete metadata.language;
      if (c.skip) metadata.skip = true;
      else delete metadata.skip;
      const base = { cell_type: c.cell_type, metadata, source };
      if (c.cell_type === 'code') {
        base.outputs = c.outputs || [];
        base.execution_count = c.execution_count ?? null;
      }
      return base;
    });
    out.nbformat = out.nbformat || 4;
    out.nbformat_minor = out.nbformat_minor ?? 5;
    out.metadata = Object.assign({}, out.metadata || {});
    if (defaultLang) {
      out.metadata.language_info = Object.assign({}, out.metadata.language_info || {}, { name: defaultLang });
    }
    return JSON.stringify(out, null, 1);
  }

  // ---------------------------------------------------------------------
  // Syntax highlighting (lightweight, dependency-free)
  // ---------------------------------------------------------------------

  function highlightPython(src) {
    return tokenize(src, [
      { re: /#.*$/gm, cls: 'tok-com' },
      { re: /("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, cls: 'tok-str' },
      { re: /\b\d+(\.\d+)?\b/g, cls: 'tok-num' },
      { re: new RegExp(`\\b(${PY_KEYWORDS.join('|')})\\b`, 'g'), cls: 'tok-kw' },
      { re: /\b([A-Za-z_][A-Za-z0-9_]*)(?=\()/g, cls: 'tok-fn' },
    ]);
  }

  function highlightSql(src) {
    return tokenize(src, [
      { re: /--.*$/gm, cls: 'tok-com' },
      { re: /'(?:[^'\\]|\\.)*'/g, cls: 'tok-str' },
      { re: /\b\d+(\.\d+)?\b/g, cls: 'tok-num' },
      { re: new RegExp(`\\b(${SQL_KEYWORDS.join('|')})\\b`, 'gi'), cls: 'tok-kw' },
      { re: /\b([A-Za-z_][A-Za-z0-9_]*)(?=\()/g, cls: 'tok-fn' },
    ]);
  }

  function highlightPlain(src) {
    return escapeHtml(src);
  }

  function highlightMarkdown(src) {
    return tokenize(src, [
      { re: /```[\s\S]*?```/g, cls: 'tok-md-code' },
      { re: /`[^`\n]+`/g, cls: 'tok-md-code' },
      { re: /^#{1,6}[ \t].*$/gm, cls: 'tok-md-heading' },
      { re: /\*\*[^*\n]+\*\*/g, cls: 'tok-md-bold' },
      { re: /\*[^*\n]+\*/g, cls: 'tok-md-italic' },
      { re: /!?\[[^\]]*\]\([^)]*\)/g, cls: 'tok-md-link' },
      { re: /^>[ \t].*$/gm, cls: 'tok-md-quote' },
    ]);
  }

  function highlightJs(src) {
    return tokenize(src, [
      { re: /\/\/.*$/gm, cls: 'tok-com' },
      { re: /\/\*[\s\S]*?\*\//g, cls: 'tok-com' },
      { re: /(`(?:[^`\\]|\\.)*`|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, cls: 'tok-str' },
      { re: /\b\d+(\.\d+)?\b/g, cls: 'tok-num' },
      { re: new RegExp(`\\b(${JS_KEYWORDS.join('|')})\\b`, 'g'), cls: 'tok-kw' },
      { re: /\b([A-Za-z_$][A-Za-z0-9_$]*)(?=\()/g, cls: 'tok-fn' },
    ]);
  }

  function highlightCss(src) {
    return tokenize(src, [
      { re: /\/\*[\s\S]*?\*\//g, cls: 'tok-com' },
      { re: /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, cls: 'tok-str' },
      { re: /[.#]?[-A-Za-z0-9_]+(?=\s*\{)/g, cls: 'tok-fn' },
      { re: /[-a-z]+(?=\s*:)/g, cls: 'tok-kw' },
      { re: /#[0-9a-fA-F]{3,8}\b/g, cls: 'tok-num' },
    ]);
  }

  function highlightHtml(src) {
    return tokenize(src, [
      { re: /<!--[\s\S]*?-->/g, cls: 'tok-com' },
      { re: /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, cls: 'tok-str' },
      { re: /<\/?[A-Za-z][-A-Za-z0-9]*/g, cls: 'tok-kw' },
      { re: /[A-Za-z-]+(?==)/g, cls: 'tok-fn' },
    ]);
  }

  function highlightJson(src) {
    return tokenize(src, [
      { re: /"(?:[^"\\]|\\.)*"(?=\s*:)/g, cls: 'tok-fn' },
      { re: /"(?:[^"\\]|\\.)*"/g, cls: 'tok-str' },
      { re: /\b(true|false|null)\b/g, cls: 'tok-kw' },
      { re: /-?\b\d+(\.\d+)?([eE][+-]?\d+)?\b/g, cls: 'tok-num' },
    ]);
  }

  function highlightXml(src) {
    return tokenize(src, [
      { re: /<!--[\s\S]*?-->/g, cls: 'tok-com' },
      { re: /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, cls: 'tok-str' },
      { re: /<\/?[A-Za-z_][-:\w]*/g, cls: 'tok-kw' },
      { re: /[A-Za-z_:][-:\w]*(?==)/g, cls: 'tok-fn' },
    ]);
  }

  function highlightYaml(src) {
    return tokenize(src, [
      { re: /#.*$/gm, cls: 'tok-com' },
      { re: /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, cls: 'tok-str' },
      { re: /^[ \t]*-?[ \t]*[A-Za-z0-9_.-]+(?=\s*:)/gm, cls: 'tok-fn' },
      { re: /\b\d+(\.\d+)?\b/g, cls: 'tok-num' },
      { re: /\b(true|false|null|yes|no)\b/gi, cls: 'tok-kw' },
    ]);
  }

  function highlightPowerShell(src) {
    return tokenize(src, [
      { re: /#.*$/gm, cls: 'tok-com' },
      { re: /<#[\s\S]*?#>/g, cls: 'tok-com' },
      { re: /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, cls: 'tok-str' },
      { re: /\$[A-Za-z_][A-Za-z0-9_]*/g, cls: 'tok-fn' },
      { re: new RegExp(`\\b(${PS_KEYWORDS.join('|')})\\b`, 'gi'), cls: 'tok-kw' },
      { re: /\b\d+(\.\d+)?\b/g, cls: 'tok-num' },
    ]);
  }

  function highlightShell(src) {
    return tokenize(src, [
      { re: /#.*$/gm, cls: 'tok-com' },
      { re: /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, cls: 'tok-str' },
      { re: /\$\{?[A-Za-z_][A-Za-z0-9_]*\}?/g, cls: 'tok-fn' },
      { re: /\b(if|then|else|elif|fi|for|while|do|done|case|esac|function|return|export|local)\b/g, cls: 'tok-kw' },
    ]);
  }

  // Generic tokenizer: applies rules in priority order over the escaped text,
  // using placeholder markers so earlier matches (e.g. comments/strings) are
  // not re-matched by later rules (e.g. keywords).
  function tokenize(src, rules) {
    const text = src;
    const matches = [];
    for (const rule of rules) {
      rule.re.lastIndex = 0;
      let m;
      while ((m = rule.re.exec(text)) !== null) {
        const start = m.index;
        const end = start + m[0].length;
        const overlaps = matches.some((x) => start < x.end && end > x.start);
        if (!overlaps) matches.push({ start, end, cls: rule.cls, text: m[0] });
        if (m[0].length === 0) rule.re.lastIndex++;
      }
    }
    matches.sort((a, b) => a.start - b.start);
    let out = '';
    let pos = 0;
    for (const m of matches) {
      if (m.start < pos) continue;
      out += escapeHtml(text.slice(pos, m.start));
      out += `<span class="${m.cls}">${escapeHtml(m.text)}</span>`;
      pos = m.end;
    }
    out += escapeHtml(text.slice(pos));
    return out;
  }

  function highlightForLanguage(source, language) {
    if (language === 'sql') return highlightSql(source);
    if (language === 'python') return highlightPython(source);
    if (language === 'markdown') return highlightMarkdown(source);
    if (language === 'javascript') return highlightJs(source);
    if (language === 'css') return highlightCss(source);
    if (language === 'html') return highlightHtml(source);
    if (language === 'json') return highlightJson(source);
    if (language === 'xml') return highlightXml(source);
    if (language === 'yaml') return highlightYaml(source);
    if (language === 'powershell') return highlightPowerShell(source);
    if (language === 'shell') return highlightShell(source);
    return highlightPlain(source);
  }

  // Simple, dependency-free Markdown -> HTML renderer used for the
  // read-only "preview" view of markdown cells (headings, lists, links,
  // images, bold/italic, inline & fenced code, blockquotes, paragraphs).
  function renderMarkdownToHtml(src) {
    const lines = (src || '').split(/\r?\n/);
    let html = '';
    let inCode = false;
    let codeBuf = [];
    let listMode = null; // 'ul' | 'ol'
    let paraBuf = [];

    function flushPara() {
      if (paraBuf.length) {
        html += `<p>${inline(paraBuf.join(' '))}</p>`;
        paraBuf = [];
      }
    }
    function flushList() {
      if (listMode) { html += `</${listMode}>`; listMode = null; }
    }
    function inline(text) {
      let t = escapeHtml(text);
      t = t.replace(/!\[([^\]]*)\]\(([^)]*)\)/g, '<img alt="$1" src="$2" />');
      t = t.replace(/\[([^\]]*)\]\(([^)]*)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
      t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
      t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      t = t.replace(/\*([^*]+)\*/g, '<em>$1</em>');
      return t;
    }

    // GFM-style pipe tables, e.g.:
    //   | Header A | Header B |
    //   | --- | :---: |
    //   | cell 1   | cell 2   |
    function splitTableRow(line) {
      let trimmed = line.trim();
      if (trimmed.startsWith('|')) trimmed = trimmed.slice(1);
      if (trimmed.endsWith('|') && !trimmed.endsWith('\\|')) trimmed = trimmed.slice(0, -1);
      return trimmed.split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'));
    }
    function isTableRow(line) {
      return /\|/.test(line);
    }
    function isTableSeparatorRow(line) {
      const trimmed = line.trim();
      return /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?$/.test(trimmed) && trimmed.includes('-');
    }
    function tableAligns(sepLine) {
      return splitTableRow(sepLine).map((cell) => {
        const left = cell.startsWith(':');
        const right = cell.endsWith(':');
        if (left && right) return 'center';
        if (right) return 'right';
        if (left) return 'left';
        return '';
      });
    }
    function alignAttr(align) {
      return align ? ` style="text-align:${align}"` : '';
    }
    function buildTableHtml(headerCells, aligns, bodyRows) {
      let out = '<table class="md-table"><thead><tr>';
      headerCells.forEach((cell, i) => {
        out += `<th${alignAttr(aligns[i])}>${inline(cell)}</th>`;
      });
      out += '</tr></thead><tbody>';
      for (const row of bodyRows) {
        out += '<tr>';
        headerCells.forEach((_, i) => {
          out += `<td${alignAttr(aligns[i])}>${inline(row[i] || '')}</td>`;
        });
        out += '</tr>';
      }
      out += '</tbody></table>';
      return out;
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^```/.test(line.trim())) {
        if (inCode) {
          html += `<pre class="md-code-block"><code>${escapeHtml(codeBuf.join('\n'))}</code></pre>`;
          codeBuf = [];
          inCode = false;
        } else {
          flushPara(); flushList();
          inCode = true;
        }
        continue;
      }
      if (inCode) { codeBuf.push(line); continue; }

      if (isTableRow(line) && lines[i + 1] !== undefined && isTableSeparatorRow(lines[i + 1])) {
        flushPara(); flushList();
        const headerCells = splitTableRow(line);
        const aligns = tableAligns(lines[i + 1]);
        const bodyRows = [];
        let j = i + 2;
        while (j < lines.length && lines[j].trim() !== '' && isTableRow(lines[j]) && !isTableSeparatorRow(lines[j])) {
          bodyRows.push(splitTableRow(lines[j]));
          j++;
        }
        html += buildTableHtml(headerCells, aligns, bodyRows);
        i = j - 1;
        continue;
      }

      const heading = line.match(/^(#{1,6})[ \t]+(.*)$/);
      if (heading) {
        flushPara(); flushList();
        const level = heading[1].length;
        html += `<h${level}>${inline(heading[2].trim())}</h${level}>`;
        continue;
      }
      const quote = line.match(/^>[ \t]?(.*)$/);
      if (quote) {
        flushPara(); flushList();
        html += `<blockquote>${inline(quote[1])}</blockquote>`;
        continue;
      }
      const ol = line.match(/^\s*\d+\.[ \t]+(.*)$/);
      const ul = line.match(/^\s*[-*+][ \t]+(.*)$/);
      if (ol || ul) {
        flushPara();
        const mode = ol ? 'ol' : 'ul';
        if (listMode !== mode) { flushList(); html += `<${mode}>`; listMode = mode; }
        html += `<li>${inline((ol || ul)[1])}</li>`;
        continue;
      }
      if (line.trim() === '') { flushPara(); flushList(); continue; }
      paraBuf.push(line.trim());
    }
    flushPara();
    flushList();
    if (inCode) html += `<pre class="md-code-block"><code>${escapeHtml(codeBuf.join('\n'))}</code></pre>`;
    return html || '<p class="md-empty">(empty markdown cell)</p>';
  }

  // A python cell whose first non-empty line is the `%%mermaid` marker is
  // rendered as a Mermaid diagram instead of a plain code editor.
  function isMermaidCell(source) {
    const firstLine = (source || '').split(/\r?\n/, 1)[0].trim();
    return /^%%mermaid$/i.test(firstLine);
  }

  function stripMermaidMarker(source) {
    const lines = (source || '').split(/\r?\n/);
    if (/^%%mermaid$/i.test((lines[0] || '').trim())) lines.shift();
    return lines.join('\n');
  }

  // Resolve the effective language of a cell: an explicit per-cell language
  // (e.g. from a %sql/%md magic, or an ipynb markdown cell_type) always wins;
  // otherwise the cell inherits the notebook's default language.
  function getCellLanguage(record, cell) {
    if (record.kind === 'ipynb') {
      if (cell.cell_type === 'markdown') return 'markdown';
      return cell.language || record.defaultLang || 'python';
    }
    return cell.language || record.defaultLang;
  }

  function cellLangCssKey(lang) {
    if (lang === 'python') return 'py';
    return lang || 'py';
  }

  // When the file's default language changes, cells that were implicitly
  // inheriting that default (cell.language === '') must be pinned to the old
  // default so their effective language - and underlying code content - does
  // not silently change. Pinning sets cell.language explicitly, which causes
  // serializeCellBlock to add/update the %<lang> magic line automatically.
  function pinCellLanguagesToOldDefault(record, oldDefaultLang, newDefaultLang) {
    if (!record || !Array.isArray(record.cells) || oldDefaultLang === newDefaultLang) return;
    for (const cell of record.cells) {
      if (record.kind === 'ipynb' && cell.cell_type === 'markdown') continue;
      if (!cell.language) {
        cell.language = oldDefaultLang;
      }
    }
  }

  // ---------------------------------------------------------------------
  // Application state
  // ---------------------------------------------------------------------

  const state = {
    rootHandle: null,
    extraRoots: [], // [{ id, handle }] additional bound folders shown alongside the primary root
    openFiles: new Map(), // path -> record { handle, path, parentHandle, ext, kind, token, cells, raw, defaultLang, dirty }
    fileOrder: [], // tab order (paths)
    panes: { a: { activePath: null }, b: { activePath: null } },
    splitEnabled: false,
    focusedPane: 'a',
    lastFocusedRecord: null,
    theme: (localStorage.getItem(THEME_STORAGE_KEY) || CONFIG.defaultTheme || 'dark'),
    expandedFolderPaths: new Set(), // folder paths currently expanded in the nav tree, kept across tree rebuilds
    sidebarCollapsed: localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === '1',
    selectedNode: null, // { path, isDir, handle, parentHandle } - currently selected nav tree item (for F2 rename)
  };

  const debouncers = new Map(); // path -> { draft, disk }

  const LANG_LABEL = { py: 'Python', sql: 'SQL', scala: 'Scala', r: 'R', ipynb: 'Jupyter' };
  const LANG_BADGE = { py: 'PY', sql: 'SQL', scala: 'SCALA', r: 'R', ipynb: 'IPYNB' };

  function langLabel(ext) { return LANG_LABEL[ext] || (ext ? ext.toUpperCase() : 'Text'); }
  function langBadge(ext) { return LANG_BADGE[ext] || (ext ? ext.toUpperCase() : 'TXT'); }

  const el = {
    unsupportedBanner: document.getElementById('unsupported-banner'),
    repoName: document.getElementById('repo-name'),
    btnOpenRepo: document.getElementById('btn-open-repo'),
    btnReconnect: document.getElementById('btn-reconnect'),
    btnToggleSidebar: document.getElementById('btn-toggle-sidebar'),
    btnThemeToggle: document.getElementById('btn-theme-toggle'),
    btnNewNotebook: document.getElementById('btn-new-notebook'),
    btnNewFile: document.getElementById('btn-new-file'),
    btnNewFolder: document.getElementById('btn-new-folder'),
    btnBindFolder: document.getElementById('btn-bind-folder'),
    btnRefreshTree: document.getElementById('btn-refresh-tree'),
    treeSearch: document.getElementById('tree-search'),
    treeRoot: document.getElementById('tree-root'),
    editorPanel: document.getElementById('editor-panel'),
    autoSaveToggle: document.getElementById('auto-save-toggle'),
    autoSaveStatus: document.getElementById('auto-save-status'),
    btnSplitEditor: document.getElementById('btn-split-editor'),
    modalOverlay: document.getElementById('modal-overlay'),
    modal: document.getElementById('modal'),
    contextMenu: document.getElementById('context-menu'),
    resizer: document.getElementById('resizer'),
    sidebar: document.getElementById('sidebar'),
    statusText: document.getElementById('status-text'),
    structurePanel: document.getElementById('structure-panel'),
    structureContainer: document.getElementById('structure-container'),
    structureResizer: document.getElementById('structure-resizer'),
    btnStructureCollapse: document.getElementById('btn-structure-collapse'),
  };

  function getPaneEls(paneId) {
    return {
      root: document.getElementById(`pane-${paneId}`),
      tabs: document.getElementById(`pane-${paneId}-tabs`),
      filename: document.getElementById(`pane-${paneId}-filename`),
      lang: document.getElementById(`pane-${paneId}-lang`),
      status: document.getElementById(`pane-${paneId}-status`),
      addCellBtn: document.getElementById(`pane-${paneId}-add-cell`),
      saveBtn: document.getElementById(`pane-${paneId}-save`),
      empty: document.getElementById(`pane-${paneId}-empty`),
      cells: document.getElementById(`pane-${paneId}-cells`),
    };
  }

  function setPaneSaveStatus(paneId, cls, text) {
    const s = document.getElementById(`pane-${paneId}-status`);
    if (!s) return;
    s.className = 'save-status ' + cls;
    s.textContent = text;
  }

  // ---------------------------------------------------------------------
  // Feature detection
  // ---------------------------------------------------------------------

  function checkSupport() {
    if (!('showDirectoryPicker' in window)) {
      el.unsupportedBanner.style.display = 'block';
      el.unsupportedBanner.textContent =
        'Your browser does not support the File System Access API required to read/write local files. ' +
        'Please use a recent Chrome or Edge browser.';
      el.btnOpenRepo.disabled = true;
      return false;
    }
    return true;
  }

  // ---------------------------------------------------------------------
  // Theme (dark / light)
  // ---------------------------------------------------------------------

  function applyTheme(theme) {
    state.theme = theme;
    document.body.classList.toggle('theme-light', theme === 'light');
    if (el.btnThemeToggle) el.btnThemeToggle.textContent = theme === 'light' ? '\u263D' : '\u2600';
    try { localStorage.setItem(THEME_STORAGE_KEY, theme); } catch { /* ignore */ }
  }

  el.btnThemeToggle.addEventListener('click', () => {
    applyTheme(state.theme === 'light' ? 'dark' : 'light');
  });

  // ---------------------------------------------------------------------
  // Auto-save toggle (header checkbox; visual on/off feedback)
  // ---------------------------------------------------------------------

  function updateAutoSaveStatus() {
    const on = el.autoSaveToggle.checked;
    el.autoSaveStatus.textContent = on ? 'On' : 'Off';
    el.autoSaveStatus.classList.toggle('on', on);
    el.autoSaveStatus.classList.toggle('off', !on);
  }

  el.autoSaveToggle.addEventListener('change', updateAutoSaveStatus);

  // ---------------------------------------------------------------------
  // Navigation panel collapse / expand toggle (width itself stays
  // adjustable via #resizer; this only shows/hides the whole panel)
  // ---------------------------------------------------------------------

  function applySidebarCollapsed() {
    el.sidebar.classList.toggle('hidden', state.sidebarCollapsed);
    el.resizer.classList.toggle('hidden', state.sidebarCollapsed);
    el.btnToggleSidebar.classList.toggle('active', state.sidebarCollapsed);
  }

  el.btnToggleSidebar.addEventListener('click', () => {
    state.sidebarCollapsed = !state.sidebarCollapsed;
    try { localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, state.sidebarCollapsed ? '1' : '0'); } catch { /* ignore */ }
    applySidebarCollapsed();
  });

  // ---------------------------------------------------------------------
  // Repository open / reconnect
  // ---------------------------------------------------------------------

  async function openRepo() {
    try {
      const handle = await window.showDirectoryPicker({ id: 'adb-ide-root', mode: 'readwrite' });
      state.rootHandle = handle;
      await idbSet(IDB_ROOT_KEY, handle);
      el.repoName.textContent = handle.name;
      el.btnReconnect.classList.add('hidden');
      setStatus(`Opened repository "${handle.name}"`);
      await buildTree();
    } catch (err) {
      if (err.name !== 'AbortError') setStatus('Failed to open repository: ' + err.message, true);
    }
  }

  async function tryRestoreRepo() {
    try {
      const handle = await idbGet(IDB_ROOT_KEY);
      if (!handle) return;
      const perm = await handle.queryPermission({ mode: 'readwrite' });
      if (perm === 'granted') {
        state.rootHandle = handle;
        el.repoName.textContent = handle.name;
        setStatus(`Restored repository "${handle.name}"`);
        await buildTree();
      } else {
        state.rootHandle = handle;
        el.repoName.textContent = `${handle.name} (permission needed)`;
        el.btnReconnect.classList.remove('hidden');
      }
    } catch {
      // ignore; user will use "Open Repository"
    }
  }

  async function reconnectRepo() {
    if (!state.rootHandle) return;
    try {
      const perm = await state.rootHandle.requestPermission({ mode: 'readwrite' });
      if (perm === 'granted') {
        el.repoName.textContent = state.rootHandle.name;
        el.btnReconnect.classList.add('hidden');
        setStatus('Reconnected to repository');
        await buildTree();
      }
    } catch (err) {
      setStatus('Reconnect failed: ' + err.message, true);
    }
  }

  // ---------------------------------------------------------------------
  // Bind / unbind additional folders into the workspace
  // ---------------------------------------------------------------------

  async function bindFolder() {
    try {
      const handle = await window.showDirectoryPicker({ id: 'adb-ide-extra-' + Date.now(), mode: 'readwrite' });
      const id = 'bound-' + Date.now();
      state.extraRoots.push({ id, handle });
      await persistExtraRoots();
      setStatus(`Bound folder "${handle.name}"`);
      await buildTree();
    } catch (err) {
      if (err.name !== 'AbortError') setStatus('Failed to bind folder: ' + err.message, true);
    }
  }

  async function unbindFolder(id) {
    const entry = state.extraRoots.find((r) => r.id === id);
    state.extraRoots = state.extraRoots.filter((r) => r.id !== id);
    await persistExtraRoots();
    if (entry) {
      const prefix = `[${id}]/`;
      for (const openPath of [...state.fileOrder]) {
        if (openPath.startsWith(prefix)) {
          disposeDebouncers(openPath);
          removeFileFromOpenTabs(openPath);
        }
      }
    }
    setStatus('Folder unbound from workspace');
    await buildTree();
    renderAll();
  }

  async function persistExtraRoots() {
    await idbSet(IDB_EXTRA_ROOTS_KEY, state.extraRoots.map((r) => ({ id: r.id, handle: r.handle })));
  }

  async function tryRestoreExtraRoots() {
    try {
      const stored = await idbGet(IDB_EXTRA_ROOTS_KEY);
      if (!Array.isArray(stored) || !stored.length) return;
      const restored = [];
      for (const entry of stored) {
        try {
          const perm = await entry.handle.queryPermission({ mode: 'readwrite' });
          if (perm === 'granted') restored.push({ id: entry.id, handle: entry.handle });
        } catch { /* skip stale handle */ }
      }
      state.extraRoots = restored;
      if (restored.length) await buildTree();
    } catch { /* ignore; user can re-bind manually */ }
  }

  // ---------------------------------------------------------------------
  // File tree
  // ---------------------------------------------------------------------

  async function buildTree() {
    el.treeRoot.innerHTML = '';
    if (state.rootHandle) {
      const rootLi = await createDirNode(state.rootHandle, '', true);
      el.treeRoot.appendChild(rootLi);
    }
    for (const { id, handle } of state.extraRoots) {
      const boundLi = await createDirNode(handle, `[${id}]`, false, { bound: true, unbindId: id, displayName: handle.name });
      el.treeRoot.appendChild(boundLi);
    }
    refreshDirtyMarkers();
  }

  async function createDirNode(dirHandle, path, expanded, opts) {
    opts = opts || {};
    const shouldExpand = expanded || state.expandedFolderPaths.has(path);
    const li = document.createElement('li');
    const node = document.createElement('div');
    node.className = 'node dir' + (opts.bound ? ' bound-root' : '');
    node.dataset.path = path;
    node.innerHTML = `<span class="twisty">${shouldExpand ? '\u25BE' : '\u25B8'}</span><span class="icon">${shouldExpand ? '\uD83D\uDCC2' : '\uD83D\uDCC1'}</span><span class="label"></span>${opts.bound ? '<span class="bound-badge" title="Bound folder">\u{1F517}</span>' : ''}`;
    node.querySelector('.label').textContent = opts.displayName || dirHandle.name;
    const childUl = document.createElement('ul');
    childUl.className = 'tree';
    let loaded = false;

    async function loadChildren() {
      if (loaded) return;
      loaded = true;
      const entries = [];
      for await (const [name, handle] of dirHandle.entries()) {
        if (IGNORED_NAMES.has(name)) continue;
        entries.push([name, handle]);
      }
      entries.sort((a, b) => {
        const aDir = a[1].kind === 'directory';
        const bDir = b[1].kind === 'directory';
        if (aDir !== bDir) return aDir ? -1 : 1;
        return a[0].localeCompare(b[0]);
      });
      for (const [name, handle] of entries) {
        const childPath = path ? `${path}/${name}` : name;
        if (handle.kind === 'directory') {
          const childLi = await createDirNode(handle, childPath, false);
          childUl.appendChild(childLi);
        } else {
          const childLi = createFileNode(handle, childPath, dirHandle);
          childUl.appendChild(childLi);
        }
      }
    }

    node.addEventListener('click', async () => {
      document.querySelectorAll('.tree .node.selected').forEach((n) => n.classList.remove('selected'));
      node.classList.add('selected');
      state.selectedNode = (path && !opts.bound) ? { path, isDir: true, handle: dirHandle } : null;
      const isExpanded = childUl.classList.contains('open');
      if (!isExpanded) {
        await loadChildren();
        childUl.classList.add('open');
        node.querySelector('.twisty').textContent = '\u25BE';
        node.querySelector('.icon').textContent = '\uD83D\uDCC2';
        childUl.style.display = 'block';
        state.expandedFolderPaths.add(path);
      } else {
        childUl.classList.remove('open');
        node.querySelector('.twisty').textContent = '\u25B8';
        node.querySelector('.icon').textContent = '\uD83D\uDCC1';
        childUl.style.display = 'none';
        state.expandedFolderPaths.delete(path);
      }
    });

    node.addEventListener('contextmenu', (ev) => {
      ev.preventDefault();
      showContextMenu(ev.clientX, ev.clientY, [
        { label: 'New Notebook here', action: () => promptNewNotebook(dirHandle, path) },
        { label: 'New File here', action: () => promptNewFile(dirHandle, path) },
        { label: 'New Folder here', action: () => promptNewFolder(dirHandle, path) },
        ...(path && !opts.bound ? [{ label: 'Rename Folder', action: () => promptRenameFolder(dirHandle, path) }] : []),
        ...(opts.bound ? [{ label: 'Unbind Folder', danger: true, action: () => unbindFolder(opts.unbindId) }] : []),
        ...(path && !opts.bound ? [{ label: 'Delete Folder', danger: true, action: () => promptDelete(dirHandle, path, true) }] : []),
      ]);
    });

    li.appendChild(node);
    childUl.style.display = 'none';
    li.appendChild(childUl);

    if (shouldExpand) {
      await loadChildren();
      childUl.classList.add('open');
      childUl.style.display = 'block';
      state.expandedFolderPaths.add(path);
    }
    return li;
  }

  function createFileNode(fileHandle, path, parentHandle) {
    const li = document.createElement('li');
    const node = document.createElement('div');
    const ext = extOf(fileHandle.name);
    const isNb = NOTEBOOK_EXTS.includes(ext) || ext === 'ipynb';
    node.className = 'node file';
    node.dataset.path = path;
    node.innerHTML = `<span class="twisty"></span><span class="icon">${isNb ? '\uD83D\uDCD3' : iconForExt(ext)}</span><span class="label"></span>`;
    node.querySelector('.label').textContent = fileHandle.name;

    node.addEventListener('click', () => {
      highlightSelectedNode(path);
      state.selectedNode = { path, isDir: false, handle: fileHandle, parentHandle };
    });
    node.addEventListener('dblclick', () => openFile(fileHandle, path, parentHandle));
    node.addEventListener('contextmenu', (ev) => {
      ev.preventDefault();
      showContextMenu(ev.clientX, ev.clientY, [
        { label: 'Open', action: () => openFile(fileHandle, path, parentHandle) },
        { label: 'Rename File', action: () => promptRenameFile(parentHandle, path) },
        { label: 'Delete File', danger: true, action: () => promptDelete(parentHandle, path, false) },
      ]);
    });

    li.appendChild(node);
    return li;
  }

  function refreshDirtyMarkers() {
    document.querySelectorAll('.tree .node.file').forEach((n) => {
      n.classList.remove('dirty');
      n.classList.remove('open-in-editor');
    });
    for (const [path, record] of state.openFiles) {
      const n = document.querySelector(`.tree .node.file[data-path="${cssEscape(path)}"]`);
      if (!n) continue;
      n.classList.add('open-in-editor');
      if (record.dirty) n.classList.add('dirty');
    }
  }

  function cssEscape(s) {
    return window.CSS && CSS.escape ? CSS.escape(s) : s.replace(/["\\]/g, '\\$&');
  }

  function highlightSelectedNode(path) {
    document.querySelectorAll('.tree .node.selected').forEach((n) => n.classList.remove('selected'));
    const n = document.querySelector(`.tree .node.file[data-path="${cssEscape(path)}"]`);
    if (n) n.classList.add('selected');
  }

  // ---------------------------------------------------------------------
  // Search / filter
  // ---------------------------------------------------------------------

  el.treeSearch.addEventListener('input', () => {
    const q = el.treeSearch.value.trim().toLowerCase();
    const nodes = document.querySelectorAll('.tree li');
    if (!q) {
      nodes.forEach((li) => li.classList.remove('hidden-node'));
      return;
    }
    document.querySelectorAll('.tree .node.file').forEach((n) => {
      const match = n.dataset.path.toLowerCase().includes(q);
      n.closest('li').classList.toggle('hidden-node', !match);
      if (match) {
        // expand & show ancestors
        let parentUl = n.closest('li').parentElement;
        while (parentUl && parentUl.classList.contains('tree')) {
          parentUl.classList.add('open');
          parentUl.style.display = 'block';
          const parentLi = parentUl.closest('li');
          if (!parentLi) break;
          parentLi.classList.remove('hidden-node');
          const twisty = parentLi.querySelector(':scope > .node .twisty');
          const icon = parentLi.querySelector(':scope > .node .icon');
          if (twisty) twisty.textContent = '\u25BE';
          if (icon) icon.textContent = '\uD83D\uDCC2';
          parentUl = parentLi.parentElement;
        }
      }
    });
    document.querySelectorAll('.tree .node.dir').forEach((n) => {
      const li = n.closest('li');
      const anyVisibleChild = li.querySelector('li:not(.hidden-node)');
      if (!anyVisibleChild) li.classList.add('hidden-node');
    });
  });

  // ---------------------------------------------------------------------
  // Context menu
  // ---------------------------------------------------------------------

  function showContextMenu(x, y, items) {
    el.contextMenu.innerHTML = '';
    for (const item of items) {
      const div = document.createElement('div');
      div.className = 'item' + (item.danger ? ' danger' : '');
      div.textContent = item.label;
      div.addEventListener('click', () => {
        hideContextMenu();
        item.action();
      });
      el.contextMenu.appendChild(div);
    }
    el.contextMenu.style.left = x + 'px';
    el.contextMenu.style.top = y + 'px';
    el.contextMenu.classList.remove('hidden');
  }

  function hideContextMenu() {
    el.contextMenu.classList.add('hidden');
  }

  document.addEventListener('click', hideContextMenu);

  // ---------------------------------------------------------------------
  // Modal helper
  // ---------------------------------------------------------------------

  function openModal(html) {
    el.modal.innerHTML = html;
    el.modalOverlay.classList.remove('hidden');
    return el.modal;
  }

  function closeModal() {
    el.modalOverlay.classList.add('hidden');
    el.modal.innerHTML = '';
  }

  el.modalOverlay.addEventListener('click', (ev) => {
    if (ev.target === el.modalOverlay) closeModal();
  });

  // ---------------------------------------------------------------------
  // New notebook / folder / delete
  // ---------------------------------------------------------------------

  function promptNewNotebook(dirHandle, dirPath) {
    const modal = openModal(`
      <h2>New Databricks Notebook</h2>
      <div class="field">
        <label>File name</label>
        <input id="nb-name" type="text" placeholder="my_notebook" />
      </div>
      <div class="field">
        <label>Language</label>
        <select id="nb-lang">
          <option value="py">Python (.py)</option>
          <option value="sql">SQL (.sql)</option>
          <option value="ipynb">Jupyter (.ipynb)</option>
        </select>
      </div>
      <div class="actions">
        <button id="nb-cancel">Cancel</button>
        <button id="nb-create" class="primary">Create</button>
      </div>
    `);
    modal.querySelector('#nb-name').focus();
    modal.querySelector('#nb-cancel').addEventListener('click', closeModal);
    modal.querySelector('#nb-create').addEventListener('click', async () => {
      let name = modal.querySelector('#nb-name').value.trim();
      const lang = modal.querySelector('#nb-lang').value;
      if (!name) return;
      if (!name.includes('.')) name += '.' + lang;
      try {
        const fileHandle = await dirHandle.getFileHandle(name, { create: true });
        const existing = await (await fileHandle.getFile()).text();
        if (!existing) {
          const content = lang === 'ipynb' ? defaultIpynbContent() : defaultNotebookContent(lang);
          const writable = await fileHandle.createWritable();
          await writable.write(content);
          await writable.close();
        }
        closeModal();
        await buildTree();
        const path = dirPath ? `${dirPath}/${name}` : name;
        await openFile(fileHandle, path, dirHandle);
        setStatus(`Created ${name}`);
      } catch (err) {
        setStatus('Failed to create notebook: ' + err.message, true);
      }
    });
  }

  function defaultNotebookContent(lang) {
    const token = COMMENT_TOKEN[lang];
    return `${token} Databricks notebook source\n\n`;
  }

  function defaultIpynbContent() {
    return JSON.stringify({
      cells: [{ cell_type: 'code', title: '', language: '', skip: false, metadata: {}, source: [], outputs: [], execution_count: null }],
      metadata: { language_info: { name: 'python' } },
      nbformat: 4,
      nbformat_minor: 5,
    }, null, 1);
  }

  function promptNewFolder(dirHandle, dirPath) {
    const modal = openModal(`
      <h2>New Folder</h2>
      <div class="field">
        <label>Folder name</label>
        <input id="folder-name" type="text" placeholder="my_folder" />
      </div>
      <div class="actions">
        <button id="folder-cancel">Cancel</button>
        <button id="folder-create" class="primary">Create</button>
      </div>
    `);
    modal.querySelector('#folder-name').focus();
    modal.querySelector('#folder-cancel').addEventListener('click', closeModal);
    modal.querySelector('#folder-create').addEventListener('click', async () => {
      const name = modal.querySelector('#folder-name').value.trim();
      if (!name) return;
      try {
        await dirHandle.getDirectoryHandle(name, { create: true });
        closeModal();
        await buildTree();
        setStatus(`Created folder ${name}`);
      } catch (err) {
        setStatus('Failed to create folder: ' + err.message, true);
      }
    });
  }

  function promptDelete(parentHandle, path, isDir) {
    const name = path.split('/').pop();
    const modal = openModal(`
      <h2>Delete ${isDir ? 'Folder' : 'File'}</h2>
      <p>Are you sure you want to delete <strong>${escapeHtml(name)}</strong>? This cannot be undone.</p>
      <div class="actions">
        <button id="del-cancel">Cancel</button>
        <button id="del-confirm" class="danger">Delete</button>
      </div>
    `);
    modal.querySelector('#del-cancel').addEventListener('click', closeModal);
    modal.querySelector('#del-confirm').addEventListener('click', async () => {
      try {
        await parentHandle.removeEntry(name, { recursive: isDir });
        localStorage.removeItem(DRAFT_PREFIX + path);
        if (isDir) {
          const prefix = path + '/';
          for (const openPath of [...state.fileOrder]) {
            if (openPath === path || openPath.startsWith(prefix)) {
              disposeDebouncers(openPath);
              removeFileFromOpenTabs(openPath);
              localStorage.removeItem(DRAFT_PREFIX + openPath);
            }
          }
        } else if (state.openFiles.has(path)) {
          disposeDebouncers(path);
          removeFileFromOpenTabs(path);
        }
        closeModal();
        await buildTree();
        renderAll();
        setStatus(`Deleted ${name}`);
      } catch (err) {
        setStatus('Failed to delete: ' + err.message, true);
      }
    });
  }

  // ---------------------------------------------------------------------
  // Path resolution helpers (support the primary root + bound folders)
  // ---------------------------------------------------------------------

  function rootForPath(path) {
    const m = path.match(/^\[([^\]]+)\]/);
    if (m) {
      const entry = state.extraRoots.find((r) => r.id === m[1]);
      return entry ? entry.handle : null;
    }
    return state.rootHandle;
  }

  function stripRootPrefix(path) {
    return path.replace(/^\[[^\]]+\]\/?/, '');
  }

  async function resolveParentDirHandle(path) {
    const root = rootForPath(path);
    const segments = stripRootPrefix(path).split('/').filter(Boolean);
    segments.pop();
    let handle = root;
    for (const seg of segments) handle = await handle.getDirectoryHandle(seg);
    return handle;
  }

  async function copyDirRecursive(srcHandle, destParentHandle, name) {
    const destHandle = await destParentHandle.getDirectoryHandle(name, { create: true });
    for await (const [childName, childHandle] of srcHandle.entries()) {
      if (IGNORED_NAMES.has(childName)) continue;
      if (childHandle.kind === 'directory') {
        await copyDirRecursive(childHandle, destHandle, childName);
      } else {
        const content = await (await childHandle.getFile()).arrayBuffer();
        const newFileHandle = await destHandle.getFileHandle(childName, { create: true });
        const writable = await newFileHandle.createWritable();
        await writable.write(content);
        await writable.close();
      }
    }
    return destHandle;
  }

  // ---------------------------------------------------------------------
  // Rename-safety helpers: existing-name validation + best-effort rewriting
  // of %run references elsewhere in the workspace when a notebook file or
  // a folder containing notebook files is renamed/moved.
  // ---------------------------------------------------------------------

  async function entryExists(dirHandle, name) {
    try { await dirHandle.getFileHandle(name); return true; } catch { /* not a file */ }
    try { await dirHandle.getDirectoryHandle(name); return true; } catch { /* not a directory either */ }
    return false;
  }

  async function listAllFiles(dirHandle, prefix) {
    const out = [];
    for await (const [name, handle] of dirHandle.entries()) {
      if (IGNORED_NAMES.has(name)) continue;
      const childPrefix = prefix ? `${prefix}/${name}` : name;
      if (handle.kind === 'directory') {
        out.push(...(await listAllFiles(handle, childPrefix)));
      } else {
        out.push(childPrefix);
      }
    }
    return out;
  }

  function stripRunQuotes(s) {
    s = s.trim();
    if (s.length >= 2 && ((s[0] === '"' && s[s.length - 1] === '"') || (s[0] === "'" && s[s.length - 1] === "'"))) {
      return s.slice(1, -1);
    }
    return s;
  }

  function resolveRunPathSegments(baseDirSegments, target) {
    target = stripRunQuotes(target);
    const raw = target.startsWith('/') ? target.slice(1).split('/') : baseDirSegments.concat(target.split('/'));
    const out = [];
    for (const seg of raw) {
      if (seg === '' || seg === '.') continue;
      if (seg === '..') out.pop();
      else out.push(seg);
    }
    return out;
  }

  function runSegmentsMatchPath(segments, filePathNoRoot) {
    const joined = segments.join('/');
    const noExt = filePathNoRoot.replace(/\.[^/.]+$/, '');
    return joined === filePathNoRoot || joined === noExt;
  }

  function relativeRunPath(fromDirSegments, toSegments, keepExt) {
    let i = 0;
    while (i < fromDirSegments.length && i < toSegments.length && fromDirSegments[i] === toSegments[i]) i++;
    const ups = fromDirSegments.length - i;
    const downs = toSegments.slice(i);
    const target = keepExt ? downs : (() => {
      const copy = downs.slice();
      if (copy.length) copy[copy.length - 1] = copy[copy.length - 1].replace(/\.[^/.]+$/, '');
      return copy;
    })();
    const parts = [];
    for (let k = 0; k < ups; k++) parts.push('..');
    parts.push(...target);
    return ups === 0 ? './' + parts.join('/') : parts.join('/');
  }

  async function updateRunReferencesInFile(fileHandle, filePath, renamedPairs) {
    const openRecord = state.openFiles.get(filePath);
    let text;
    if (openRecord) {
      if (openRecord.kind !== 'notebook') return;
      text = serializeDatabricksNotebook(openRecord.cells, openRecord.token, openRecord.defaultLang);
    } else {
      text = await (await fileHandle.getFile()).text();
    }
    const token = COMMENT_TOKEN[extOf(filePath)];
    if (!token || !isDatabricksSource(text, token)) return;

    const fromDirSegments = filePath.includes('/') ? filePath.slice(0, filePath.lastIndexOf('/')).split('/') : [];
    const magicRe = new RegExp(`^${escapeRegex(token)} MAGIC %run[ \\t]+(.*)$`);
    let changed = false;
    const lines = text.split(/\r?\n/).map((line) => {
      const m = line.match(magicRe);
      if (!m) return line;
      const targetRaw = m[1];
      const hadExt = /\.[A-Za-z0-9]+$/.test(stripRunQuotes(targetRaw));
      const resolved = resolveRunPathSegments(fromDirSegments, targetRaw);
      for (const { oldPath, newPath } of renamedPairs) {
        if (runSegmentsMatchPath(resolved, oldPath)) {
          const newTarget = relativeRunPath(fromDirSegments, newPath.split('/'), hadExt);
          changed = true;
          return `${token} MAGIC %run ${newTarget}`;
        }
      }
      return line;
    });
    if (!changed) return;
    const newText = lines.join('\n');
    if (openRecord) {
      openRecord.cells = parseDatabricksNotebook(newText, token);
      markDirty(openRecord);
    } else {
      const writable = await fileHandle.createWritable();
      await writable.write(newText);
      await writable.close();
    }
  }

  async function walkFilesForRunUpdate(dirHandle, pathPrefix, renamedPairs) {
    for await (const [name, handle] of dirHandle.entries()) {
      if (IGNORED_NAMES.has(name)) continue;
      const childPath = pathPrefix ? `${pathPrefix}/${name}` : name;
      if (handle.kind === 'directory') {
        await walkFilesForRunUpdate(handle, childPath, renamedPairs);
      } else if (NOTEBOOK_EXTS.includes(extOf(name))) {
        await updateRunReferencesInFile(handle, childPath, renamedPairs);
      }
    }
  }

  // Best-effort: after a file/folder rename, rewrite %run targets elsewhere
  // in the workspace that pointed at the old path(s) so they keep working.
  // Only .py/.sql notebook sources are scanned/rewritten.
  async function updateWorkspaceRunReferences(renamedPairs) {
    const pairs = renamedPairs.filter((p) => NOTEBOOK_EXTS.includes(extOf(p.newPath)));
    if (!pairs.length) return;
    try {
      if (state.rootHandle) await walkFilesForRunUpdate(state.rootHandle, '', pairs);
      for (const { handle } of state.extraRoots) await walkFilesForRunUpdate(handle, '', pairs);
    } catch (err) {
      console.warn('Failed to update %run references after rename', err);
    }
  }

  // ---------------------------------------------------------------------
  // New file / rename file / rename folder
  // ---------------------------------------------------------------------

  const OTHER_FILE_TYPES = [
    { ext: 'md', label: 'Markdown (.md)' },
    { ext: 'yml', label: 'YAML (.yml)' },
    { ext: 'json', label: 'JSON (.json)' },
    { ext: 'css', label: 'CSS (.css)' },
    { ext: 'html', label: 'HTML (.html)' },
    { ext: 'js', label: 'JavaScript (.js)' },
    { ext: 'xml', label: 'XML (.xml)' },
    { ext: 'ps1', label: 'PowerShell (.ps1)' },
    { ext: 'sh', label: 'Shell (.sh)' },
    { ext: 'txt', label: 'Plain text (.txt)' },
  ];

  function promptNewFile(dirHandle, dirPath) {
    const modal = openModal(`
      <h2>New File</h2>
      <div class="field">
        <label>File name</label>
        <input id="nf-name" type="text" placeholder="notes" />
      </div>
      <div class="field">
        <label>Type</label>
        <select id="nf-ext">
          ${OTHER_FILE_TYPES.map((t) => `<option value="${t.ext}">${t.label}</option>`).join('')}
        </select>
      </div>
      <div class="actions">
        <button id="nf-cancel">Cancel</button>
        <button id="nf-create" class="primary">Create</button>
      </div>
    `);
    modal.querySelector('#nf-name').focus();
    modal.querySelector('#nf-cancel').addEventListener('click', closeModal);
    modal.querySelector('#nf-create').addEventListener('click', async () => {
      let name = modal.querySelector('#nf-name').value.trim();
      const ext = modal.querySelector('#nf-ext').value;
      if (!name) return;
      if (!name.includes('.')) name += '.' + ext;
      try {
        const fileHandle = await dirHandle.getFileHandle(name, { create: true });
        closeModal();
        await buildTree();
        const path = dirPath ? `${dirPath}/${name}` : name;
        await openFile(fileHandle, path, dirHandle);
        setStatus(`Created ${name}`);
      } catch (err) {
        setStatus('Failed to create file: ' + err.message, true);
      }
    });
  }

  function promptRenameFile(parentHandle, path) {
    const oldName = path.split('/').pop();
    const dot = oldName.lastIndexOf('.');
    const baseName = dot === -1 ? oldName : oldName.slice(0, dot);
    const ext = dot === -1 ? '' : oldName.slice(dot);
    const modal = openModal(`
      <h2>Rename File</h2>
      <div class="field">
        <label>New name (extension "${escapeHtml(ext)}" is kept)</label>
        <input id="rn-name" type="text" value="${escapeHtml(baseName)}" />
      </div>
      <div class="field" id="rn-error" style="display:none;color:#ff8a80;"></div>
      <div class="actions">
        <button id="rn-cancel">Cancel</button>
        <button id="rn-ok" class="primary">Rename</button>
      </div>
    `);
    const input = modal.querySelector('#rn-name');
    const errorEl = modal.querySelector('#rn-error');
    input.focus();
    input.select();
    modal.querySelector('#rn-cancel').addEventListener('click', closeModal);
    modal.querySelector('#rn-ok').addEventListener('click', async () => {
      const newBase = input.value.trim();
      if (!newBase) return;
      const newName = newBase + ext;
      if (newName === oldName) { closeModal(); return; }
      if (await entryExists(parentHandle, newName)) {
        errorEl.textContent = `"${newName}" already exists in this folder.`;
        errorEl.style.display = 'block';
        return;
      }
      closeModal();
      const record = state.openFiles.get(path);
      if (record) {
        await renameOpenFile(record, newName);
      } else {
        try {
          const content = await (await (await parentHandle.getFileHandle(oldName)).getFile()).arrayBuffer();
          const newHandle = await parentHandle.getFileHandle(newName, { create: true });
          const writable = await newHandle.createWritable();
          await writable.write(content);
          await writable.close();
          await parentHandle.removeEntry(oldName);
          await buildTree();
          setStatus(`Renamed to ${newName}`);
          if (NOTEBOOK_EXTS.includes(extOf(newName))) {
            const dirPath = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
            const newPath = dirPath ? `${dirPath}/${newName}` : newName;
            await updateWorkspaceRunReferences([{ oldPath: stripRootPrefix(path), newPath: stripRootPrefix(newPath) }]);
          }
        } catch (err) {
          setStatus('Failed to rename file: ' + err.message, true);
        }
      }
    });
  }

  function promptRenameFolder(dirHandle, path) {
    const oldName = path.split('/').pop();
    const modal = openModal(`
      <h2>Rename Folder</h2>
      <div class="field">
        <label>New name</label>
        <input id="rn-name" type="text" value="${escapeHtml(oldName)}" />
      </div>
      <div class="field" id="rn-error" style="display:none;color:#ff8a80;"></div>
      <div class="actions">
        <button id="rn-cancel">Cancel</button>
        <button id="rn-ok" class="primary">Rename</button>
      </div>
    `);
    const input = modal.querySelector('#rn-name');
    const errorEl = modal.querySelector('#rn-error');
    input.focus();
    input.select();
    modal.querySelector('#rn-cancel').addEventListener('click', closeModal);
    modal.querySelector('#rn-ok').addEventListener('click', async () => {
      const newName = input.value.trim();
      if (!newName || newName === oldName) { closeModal(); return; }
      try {
        const parentHandle = await resolveParentDirHandle(path);
        if (await entryExists(parentHandle, newName)) {
          errorEl.textContent = `"${newName}" already exists in this folder.`;
          errorEl.style.display = 'block';
          return;
        }
        closeModal();
        const subPaths = await listAllFiles(dirHandle, '');
        const parentPath = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
        const newPath = parentPath ? `${parentPath}/${newName}` : newName;
        await copyDirRecursive(dirHandle, parentHandle, newName);
        await parentHandle.removeEntry(oldName, { recursive: true });
        const oldPrefix = path + '/';
        for (const openPath of [...state.fileOrder]) {
          if (openPath === path || openPath.startsWith(oldPrefix)) {
            const rec = state.openFiles.get(openPath);
            const rewritten = newPath + openPath.slice(path.length);
            if (rec) {
              state.openFiles.delete(openPath);
              rec.path = rewritten;
              state.openFiles.set(rewritten, rec);
              const idx = state.fileOrder.indexOf(openPath);
              if (idx !== -1) state.fileOrder[idx] = rewritten;
              for (const paneId of Object.keys(state.panes)) {
                if (state.panes[paneId].activePath === openPath) state.panes[paneId].activePath = rewritten;
              }
            }
          }
        }
        await buildTree();
        renderAll();
        setStatus(`Renamed folder to "${newName}"`);
        const renamePairs = subPaths.map((sub) => ({
          oldPath: stripRootPrefix(sub ? `${path}/${sub}` : path),
          newPath: stripRootPrefix(sub ? `${newPath}/${sub}` : newPath),
        }));
        await updateWorkspaceRunReferences(renamePairs);
      } catch (err) {
        setStatus('Failed to rename folder: ' + err.message, true);
      }
    });
  }

  async function renameOpenFile(record, newFileName) {
    const oldPath = record.path;
    const oldName = oldPath.split('/').pop();
    if (newFileName === oldName) return;
    const dirPath = oldPath.includes('/') ? oldPath.slice(0, oldPath.lastIndexOf('/')) : '';
    const newPath = dirPath ? `${dirPath}/${newFileName}` : newFileName;
    if (state.openFiles.has(newPath)) { setStatus('A file with that name is already open', true); return; }
    if (await entryExists(record.parentHandle, newFileName)) { setStatus(`"${newFileName}" already exists in this folder`, true); return; }
    try {
      let text;
      if (record.kind === 'notebook') text = serializeDatabricksNotebook(record.cells, record.token, record.defaultLang);
      else if (record.kind === 'ipynb') text = serializeIpynb(record.raw, record.cells, record.defaultLang);
      else text = record.content;

      const newHandle = await record.parentHandle.getFileHandle(newFileName, { create: true });
      const writable = await newHandle.createWritable();
      await writable.write(text);
      await writable.close();
      await record.parentHandle.removeEntry(oldName);
      localStorage.removeItem(DRAFT_PREFIX + oldPath);

      state.openFiles.delete(oldPath);
      disposeDebouncers(oldPath);
      record.handle = newHandle;
      record.path = newPath;
      record.ext = extOf(newFileName);
      if (record.kind === 'notebook' && COMMENT_TOKEN[record.ext]) record.token = COMMENT_TOKEN[record.ext];
      record.dirty = false;
      state.openFiles.set(newPath, record);
      const idx = state.fileOrder.indexOf(oldPath);
      if (idx !== -1) state.fileOrder[idx] = newPath;
      for (const paneId of Object.keys(state.panes)) {
        if (state.panes[paneId].activePath === oldPath) state.panes[paneId].activePath = newPath;
      }
      await buildTree();
      highlightSelectedNode(newPath);
      renderAll();
      setStatus(`Renamed to ${newFileName}`);
      if (record.kind === 'notebook') {
        await updateWorkspaceRunReferences([{ oldPath: stripRootPrefix(oldPath), newPath: stripRootPrefix(newPath) }]);
      }
    } catch (err) {
      setStatus('Failed to rename file: ' + err.message, true);
    }
  }

  // ---------------------------------------------------------------------
  // Opening & closing files (multi-tab)
  // ---------------------------------------------------------------------

  async function openFile(fileHandle, path, parentHandle, pane) {
    pane = pane || state.focusedPane;

    if (state.openFiles.has(path)) {
      state.panes[pane].activePath = path;
      highlightSelectedNode(path);
      renderAll();
      return;
    }

    const file = await fileHandle.getFile();
    const content = await file.text();
    const ext = extOf(fileHandle.name);

    let record;
    if (ext === 'ipynb') {
      const { raw, cells } = parseIpynb(content || defaultIpynbContent());
      const lang = raw?.metadata?.language_info?.name || 'python';
      record = { handle: fileHandle, parentHandle, path, ext, kind: 'ipynb', raw, cells, defaultLang: lang };
    } else if (NOTEBOOK_EXTS.includes(ext)) {
      const token = COMMENT_TOKEN[ext];
      const defaultLang = ext === 'py' ? 'python' : ext === 'r' ? 'r' : ext;
      if (isDatabricksSource(content, token)) {
        const cells = parseDatabricksNotebook(content, token);
        record = { handle: fileHandle, parentHandle, path, ext, kind: 'notebook', token, cells, defaultLang };
      } else {
        record = { handle: fileHandle, parentHandle, path, ext, kind: 'plain', content, defaultLang };
      }
    } else {
      record = { handle: fileHandle, parentHandle, path, ext, kind: 'plain', content, defaultLang: 'text' };
    }
    record.dirty = false;
    record.lastFileMTime = file.lastModified;

    // check for a newer local draft
    const draftRaw = localStorage.getItem(DRAFT_PREFIX + path);
    if (draftRaw) {
      try {
        const draft = JSON.parse(draftRaw);
        if (draft.mtime > file.lastModified) {
          const useDraft = confirm(
            `A newer unsaved draft was found for "${fileHandle.name}" (from ${new Date(draft.savedAt).toLocaleString()}).\n\nRestore the draft instead of the file on disk?`
          );
          if (useDraft) {
            if (record.kind === 'notebook' || record.kind === 'ipynb') record.cells = draft.cells;
            else record.content = draft.content;
            record.dirty = true;
          }
        }
      } catch {
        // ignore corrupt draft
      }
    }

    state.openFiles.set(path, record);
    state.fileOrder.push(path);
    state.panes[pane].activePath = path;
    state.focusedPane = pane;
    highlightSelectedNode(path);
    renderAll();
  }

  function disposeDebouncers(path) {
    const d = debouncers.get(path);
    if (d) { d.draft.cancel(); d.disk.cancel(); debouncers.delete(path); }
  }

  function removeFileFromOpenTabs(path) {
    state.openFiles.delete(path);
    const idx = state.fileOrder.indexOf(path);
    if (idx !== -1) state.fileOrder.splice(idx, 1);
    for (const paneId of Object.keys(state.panes)) {
      if (state.panes[paneId].activePath === path) {
        const newIdx = Math.min(idx, state.fileOrder.length - 1);
        state.panes[paneId].activePath = newIdx >= 0 ? state.fileOrder[newIdx] : null;
      }
    }
    if (state.lastFocusedRecord && state.lastFocusedRecord.path === path) state.lastFocusedRecord = null;
  }

  async function closeFileTab(path) {
    const record = state.openFiles.get(path);
    if (record && record.dirty) await flushDiskSave(record);
    disposeDebouncers(path);
    removeFileFromOpenTabs(path);
    renderAll();
  }

  // ---------------------------------------------------------------------
  // Editor rendering (tabs + toolbar + cells, per pane)
  // ---------------------------------------------------------------------

  function renderAll() {
    renderPane('a');
    renderPane('b');
    document.getElementById('pane-b').classList.toggle('hidden', !state.splitEnabled);
    document.getElementById('pane-divider').classList.toggle('hidden', !state.splitEnabled);
  }

  function renderTabBar(paneId, container) {
    container.innerHTML = '';
    // Pinned tabs are shown first (in their existing relative order), then
    // the rest, following the spec's "tabs can be pinned" requirement.
    const ordered = [...state.fileOrder].sort((a, b) => {
      const ra = state.openFiles.get(a), rb = state.openFiles.get(b);
      const pa = ra && ra.pinned ? 0 : 1;
      const pb = rb && rb.pinned ? 0 : 1;
      return pa - pb;
    });
    for (const path of ordered) {
      const record = state.openFiles.get(path);
      if (!record) continue;
      const tab = document.createElement('div');
      tab.className = 'tab' + (state.panes[paneId].activePath === path ? ' active' : '') + (record.dirty ? ' dirty' : '') + (record.pinned ? ' pinned' : '');
      tab.title = path;
      tab.draggable = true;
      tab.dataset.path = path;

      const pinBtn = document.createElement('span');
      pinBtn.className = 'tab-pin';
      pinBtn.title = record.pinned ? 'Unpin tab' : 'Pin tab';
      pinBtn.textContent = '\uD83D\uDCCC';
      pinBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        record.pinned = !record.pinned;
        renderAll();
      });

      const badge = document.createElement('span');
      badge.className = 'tab-lang lang-' + record.ext;
      badge.textContent = langBadge(record.ext);

      const label = document.createElement('span');
      label.className = 'tab-label';
      label.textContent = path.split('/').pop();
      label.addEventListener('dblclick', (ev) => {
        ev.stopPropagation();
        startTabRename(record, label);
      });

      const closeBtn = document.createElement('span');
      closeBtn.className = 'tab-close';
      closeBtn.textContent = '\u00D7';
      closeBtn.title = 'Close';
      closeBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        closeFileTab(path);
      });

      tab.appendChild(pinBtn);
      tab.appendChild(badge);
      tab.appendChild(label);
      tab.appendChild(closeBtn);
      tab.addEventListener('click', () => {
        state.focusedPane = paneId;
        state.panes[paneId].activePath = path;
        highlightSelectedNode(path);
        renderAll();
      });

      tab.addEventListener('dragstart', (ev) => {
        ev.dataTransfer.setData('text/plain', path);
        ev.dataTransfer.effectAllowed = 'move';
      });
      tab.addEventListener('dragover', (ev) => ev.preventDefault());
      tab.addEventListener('drop', (ev) => {
        ev.preventDefault();
        const draggedPath = ev.dataTransfer.getData('text/plain');
        if (!draggedPath || draggedPath === path) return;
        const from = state.fileOrder.indexOf(draggedPath);
        const to = state.fileOrder.indexOf(path);
        if (from === -1 || to === -1) return;
        state.fileOrder.splice(from, 1);
        state.fileOrder.splice(to, 0, draggedPath);
        renderAll();
      });

      container.appendChild(tab);
    }
  }

  // Double-click a tab label to rename the file in place. Only the base
  // name is editable; the extension is preserved (spec requirement).
  function startTabRename(record, labelEl) {
    const oldName = record.path.split('/').pop();
    const dot = oldName.lastIndexOf('.');
    const baseName = dot === -1 ? oldName : oldName.slice(0, dot);
    const ext = dot === -1 ? '' : oldName.slice(dot);
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'tab-rename-input';
    input.value = baseName;
    labelEl.replaceWith(input);
    input.focus();
    input.select();

    let done = false;
    const commit = async () => {
      if (done) return;
      done = true;
      const newBase = input.value.trim();
      if (newBase && newBase !== baseName) {
        await renameOpenFile(record, newBase + ext);
      } else {
        renderAll();
      }
    };
    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') { ev.preventDefault(); input.blur(); }
      if (ev.key === 'Escape') { ev.preventDefault(); done = true; renderAll(); }
    });
  }

  function renderPane(paneId) {
    const pe = getPaneEls(paneId);
    if (!pe.root) return;
    renderTabBar(paneId, pe.tabs);

    const path = state.panes[paneId].activePath;
    const record = path ? state.openFiles.get(path) : null;

    if (!record) {
      pe.empty.classList.remove('hidden');
      pe.cells.innerHTML = '';
      pe.filename.textContent = '';
      pe.lang.innerHTML = '';
      pe.lang.classList.add('hidden');
      pe.addCellBtn.classList.add('hidden');
      setPaneSaveStatus(paneId, '', '');
      if (state.focusedPane === paneId) renderStructurePanel();
      return;
    }

    pe.empty.classList.add('hidden');
    pe.filename.textContent = record.path;
    if (record.kind === 'plain') {
      pe.lang.classList.add('hidden');
    } else {
      pe.lang.classList.remove('hidden');
      pe.lang.innerHTML = DEFAULT_LANG_OPTIONS.map((o) =>
        `<option value="${o.value}" ${o.value === record.defaultLang ? 'selected' : ''}>${o.label}</option>`
      ).join('');
      pe.lang.className = 'lang-select lang-' + defaultLangKey(record.defaultLang);
    }
    setPaneSaveStatus(paneId, record.dirty ? 'dirty' : 'saved', record.dirty ? 'Unsaved changes' : 'Up to date');

    pe.cells.innerHTML = '';
    if (record.kind === 'plain') {
      pe.addCellBtn.classList.add('hidden');
      renderPlainEditor(record, pe.cells, paneId);
    } else {
      pe.addCellBtn.classList.remove('hidden');
      record.ui = record.ui || { collapsedCells: new Set(), mdEditing: new Set(), collapsedSections: new Set(), mermaidEditing: new Set() };
      const outline = buildOutline(record);
      record.__outlineRanges = outline.ranges;
      record.cells.forEach((cell, idx) => {
        if (isCellHiddenBySection(record, idx, outline.ranges)) return;
        renderCell(record, cell, idx, pe.cells, paneId);
      });
    }
    if (state.focusedPane === paneId) renderStructurePanel();
  }

  function refreshPanesForPath(path, statusOverride) {
    const record = state.openFiles.get(path);
    for (const paneId of Object.keys(state.panes)) {
      const pe = getPaneEls(paneId);
      if (!pe.root) continue;
      renderTabBar(paneId, pe.tabs);
      if (state.panes[paneId].activePath === path && record) {
        const cls = statusOverride ? statusOverride.cls : (record.dirty ? 'dirty' : 'saved');
        const text = statusOverride ? statusOverride.text : (record.dirty ? 'Editing...' : 'Up to date');
        setPaneSaveStatus(paneId, cls, text);
      }
    }
  }

  function renderPlainEditor(record, container, paneId) {
    const lang = languageForExt(record.ext);
    const wrap = document.createElement('div');
    wrap.className = 'cell-editor-wrap';
    wrap.style.minHeight = '70vh';
    const pre = document.createElement('pre');
    pre.className = 'highlight-layer';
    pre.style.minHeight = '70vh';
    const textarea = document.createElement('textarea');
    textarea.className = 'code-input';
    textarea.style.minHeight = '70vh';
    textarea.value = record.content;
    pre.innerHTML = highlightForLanguage(record.content, lang) + '\n';

    textarea.addEventListener('focus', () => { state.focusedPane = paneId; state.lastFocusedRecord = record; });
    textarea.addEventListener('input', () => {
      record.content = textarea.value;
      pre.innerHTML = highlightForLanguage(record.content, lang) + '\n';
      markDirty(record);
    });
    syncScroll(textarea, pre);

    wrap.appendChild(pre);
    wrap.appendChild(textarea);
    container.appendChild(wrap);
  }

  function renderCell(record, cell, idx, container, paneId) {
    const isIpynb = record.kind === 'ipynb';
    const effectiveLang = getCellLanguage(record, cell);
    const isMarkdown = effectiveLang === 'markdown';
    const isMermaid = effectiveLang === 'python' && isMermaidCell(cell.source);
    record.ui = record.ui || { collapsedCells: new Set(), mdEditing: new Set(), collapsedSections: new Set(), mermaidEditing: new Set() };
    const isCollapsed = record.ui.collapsedCells.has(idx);

    const cellDiv = document.createElement('div');
    cellDiv.className = 'cell cell-lang-' + cellLangCssKey(effectiveLang) + (cell.skip ? ' cell-skipped' : '') + (isCollapsed ? ' cell-collapsed' : '');
    cellDiv.id = `cell-${paneId}-${idx}`;
    cellDiv.dataset.cellIndex = String(idx);

    const titleBar = document.createElement('div');
    titleBar.className = 'cell-title-bar';

    const collapseBtn = mkIconBtn(isCollapsed ? '\u25B8' : '\u25BE', isCollapsed ? 'Expand cell' : 'Collapse cell', () => {
      if (record.ui.collapsedCells.has(idx)) record.ui.collapsedCells.delete(idx);
      else record.ui.collapsedCells.add(idx);
      renderPane(paneId);
    });
    collapseBtn.classList.add('cell-collapse-toggle');
    titleBar.appendChild(collapseBtn);

    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.className = 'cell-title-input';
    titleInput.placeholder = `Cell ${idx + 1} \u2013 untitled`;
    titleInput.value = cell.title || '';
    titleInput.addEventListener('focus', () => {
      state.focusedPane = paneId;
      state.lastFocusedRecord = record;
    });
    titleInput.addEventListener('input', () => {
      cell.title = titleInput.value;
      markDirty(record);
      renderStructurePanel();
    });
    titleBar.appendChild(titleInput);

    const langSelect = document.createElement('select');
    langSelect.className = 'lang-select lang-' + cellLangCssKey(effectiveLang);
    langSelect.title = 'Cell language';
    const isRunCell = !isIpynb && cell.language === 'run';
    if (isIpynb) {
      langSelect.innerHTML = `<option value="code">Code</option><option value="markdown">Markdown</option>`;
      langSelect.value = cell.cell_type;
      langSelect.addEventListener('change', () => {
        cell.cell_type = langSelect.value;
        markDirty(record);
        renderPane(paneId);
      });
    } else if (!isRunCell) {
      langSelect.innerHTML = CELL_LANGUAGE_OPTIONS.map((o) => `<option value="${o.value}">${escapeHtml(o.label)}</option>`).join('');
      // Cells without an explicit marker inherit the notebook default
      // language; the dropdown always shows a concrete selection (never a
      // blank "default" placeholder) by falling back to that default.
      langSelect.value = cell.language || record.defaultLang;
      langSelect.addEventListener('change', () => {
        const chosen = langSelect.value;
        // If the chosen language matches the notebook default, leave the
        // cell unmarked (implicit) so no redundant %<lang> magic is written;
        // otherwise pin the cell to its explicit language marker.
        cell.language = chosen === record.defaultLang ? '' : chosen;
        markDirty(record);
        renderPane(paneId);
      });
    }
    if (isRunCell) {
      // %run is a standalone marker, not one of the selectable Markdown/SQL/
      // Python languages, so it never gets the language dropdown - just a
      // static badge identifying the cell as a %run cell.
      const runBadge = document.createElement('span');
      runBadge.className = 'lang-badge lang-run';
      runBadge.title = '%run cell (executes another notebook)';
      runBadge.textContent = 'RUN';
      titleBar.appendChild(runBadge);
    } else {
      titleBar.appendChild(langSelect);
    }
    cellDiv.appendChild(titleBar);

    const toolbar = document.createElement('div');
    toolbar.className = 'cell-toolbar';

    const indexSpan = document.createElement('span');
    indexSpan.className = 'cell-index';
    indexSpan.textContent = String(idx + 1);
    toolbar.appendChild(indexSpan);

    // Markdown cells never get a %skip marker (spec requirement).
    if (!isMarkdown) {
      const skipLabel = document.createElement('label');
      skipLabel.className = 'cell-skip-toggle';
      skipLabel.title = 'Skip this cell (%skip)';
      const skipCheckbox = document.createElement('input');
      skipCheckbox.type = 'checkbox';
      skipCheckbox.checked = !!cell.skip;
      skipCheckbox.addEventListener('change', () => {
        cell.skip = skipCheckbox.checked;
        markDirty(record);
        renderPane(paneId);
      });
      skipLabel.appendChild(skipCheckbox);
      skipLabel.appendChild(document.createTextNode(' Skip'));
      toolbar.appendChild(skipLabel);
    }

    const spacer = document.createElement('span');
    spacer.className = 'spacer';
    toolbar.appendChild(spacer);

    if (effectiveLang === 'python' || effectiveLang === 'sql') {
      const runBtn = mkIconBtn('\u25B6 Run', 'Run this cell', () => runCell(record, cell, effectiveLang, outputDiv));
      runBtn.classList.add('cell-run-btn');
      toolbar.appendChild(runBtn);
    }

    const btnUp = mkIconBtn('\u2191', 'Move cell up', () => {
      if (idx === 0) return;
      [record.cells[idx - 1], record.cells[idx]] = [record.cells[idx], record.cells[idx - 1]];
      markDirty(record);
      renderPane(paneId);
    });
    const btnDown = mkIconBtn('\u2193', 'Move cell down', () => {
      if (idx === record.cells.length - 1) return;
      [record.cells[idx + 1], record.cells[idx]] = [record.cells[idx], record.cells[idx + 1]];
      markDirty(record);
      renderPane(paneId);
    });
    const btnAddBelow = mkIconBtn('+', 'Insert cell below', () => {
      record.cells.splice(idx + 1, 0, isIpynb ? { cell_type: 'code', title: '', language: '', skip: false, source: '', metadata: {}, outputs: [], execution_count: null } : { title: '', language: '', skip: false, source: '' });
      markDirty(record);
      renderPane(paneId);
    });
    const btnDelete = mkIconBtn('\u00D7', 'Delete cell', () => {
      if (record.cells.length === 1) { setStatus('A notebook needs at least one cell', true); return; }
      record.cells.splice(idx, 1);
      markDirty(record);
      renderPane(paneId);
    });
    toolbar.appendChild(btnUp);
    toolbar.appendChild(btnDown);
    toolbar.appendChild(btnAddBelow);
    toolbar.appendChild(btnDelete);

    cellDiv.appendChild(toolbar);

    const body = document.createElement('div');
    body.className = 'cell-body';

    const wrap = document.createElement('div');
    wrap.className = 'cell-editor-wrap';

    const outputDiv = document.createElement('div');
    outputDiv.className = 'cell-output hidden';
    const storedOutputHtml = renderStoredOutputs(cell);
    if (storedOutputHtml) {
      outputDiv.innerHTML = storedOutputHtml;
      outputDiv.classList.remove('hidden');
    }

    if (isMarkdown) {
      const editing = record.ui.mdEditing.has(idx) || !cell.source;
      if (editing) {
        wrap.appendChild(buildCodeEditor(cell, effectiveLang, record, paneId, cellDiv, () => {
          record.ui.mdEditing.delete(idx);
          renderPane(paneId);
        }));
      } else {
        const preview = document.createElement('div');
        preview.className = 'md-preview';
        preview.innerHTML = renderMarkdownToHtml(cell.source);
        preview.title = 'Click to edit';
        preview.addEventListener('click', () => {
          record.ui.mdEditing.add(idx);
          renderPane(paneId);
        });
        wrap.appendChild(preview);
      }
    } else if (isMermaid) {
      const editing = record.ui.mermaidEditing.has(idx);
      if (editing) {
        wrap.appendChild(buildCodeEditor(cell, effectiveLang, record, paneId, cellDiv, () => {
          record.ui.mermaidEditing.delete(idx);
          renderPane(paneId);
        }));
      } else {
        const preview = document.createElement('div');
        preview.className = 'mermaid-preview';
        preview.title = 'Double-click to edit the Mermaid diagram code';
        preview.textContent = 'Rendering diagram\u2026';
        preview.addEventListener('dblclick', () => {
          record.ui.mermaidEditing.add(idx);
          renderPane(paneId);
        });
        wrap.appendChild(preview);
        renderMermaidDiagram(cell.source, preview);
      }
    } else {
      wrap.appendChild(buildCodeEditor(cell, effectiveLang, record, paneId, cellDiv, null));
    }

    body.appendChild(wrap);
    body.appendChild(outputDiv);
    cellDiv.appendChild(body);

    container.appendChild(cellDiv);
  }

  // Builds the syntax-highlighted textarea/overlay editor shared by code and
  // (in edit-mode) markdown cells.
  function buildCodeEditor(cell, effectiveLang, record, paneId, cellDiv, onBlurExtra) {
    const wrap = document.createElement('div');
    wrap.className = 'cell-editor-wrap';
    const pre = document.createElement('pre');
    pre.className = 'highlight-layer';
    const textarea = document.createElement('textarea');
    textarea.className = 'code-input';
    textarea.value = cell.source;
    textarea.rows = Math.max(3, Math.min(24, cell.source.split('\n').length + 1));

    pre.innerHTML = highlightForLanguage(cell.source, effectiveLang) + '\n';

    textarea.addEventListener('focus', () => {
      cellDiv.classList.add('focused');
      state.focusedPane = paneId;
      state.lastFocusedRecord = record;
    });
    textarea.addEventListener('blur', () => {
      cellDiv.classList.remove('focused');
      if (onBlurExtra) onBlurExtra();
    });
    textarea.addEventListener('input', () => {
      cell.source = textarea.value;
      pre.innerHTML = highlightForLanguage(cell.source, effectiveLang) + '\n';
      markDirty(record);
    });
    syncScroll(textarea, pre);

    wrap.appendChild(pre);
    wrap.appendChild(textarea);
    return wrap;
  }

  // Renders any outputs already stored in an .ipynb cell (read-only, until
  // the user presses Run again).
  function renderStoredOutputs(cell) {
    if (!cell.outputs || !cell.outputs.length) return '';
    let html = '';
    for (const out of cell.outputs) {
      if (out.output_type === 'stream') {
        html += `<pre class="output-text">${escapeHtml(Array.isArray(out.text) ? out.text.join('') : String(out.text || ''))}</pre>`;
      } else if (out.output_type === 'error') {
        const trace = Array.isArray(out.traceback) ? out.traceback.join('\n') : '';
        html += `<pre class="output-text output-error-text">${escapeHtml(`${out.ename}: ${out.evalue}\n${trace}`)}</pre>`;
      } else if (out.data && out.data['text/plain']) {
        const t = out.data['text/plain'];
        html += `<pre class="output-text">${escapeHtml(Array.isArray(t) ? t.join('') : String(t))}</pre>`;
      }
    }
    return html;
  }

  // ---------------------------------------------------------------------
  // Cell execution (Python via lazily-loaded Pyodide; SQL is informational
  // only since there is no local Databricks/Spark connection available)
  // ---------------------------------------------------------------------

  let pyodidePromise = null;
  function loadPyodideRuntime() {
    if (pyodidePromise) return pyodidePromise;
    const cdnUrl = CONFIG.pyodideCdnUrl;
    if (!cdnUrl) return Promise.reject(new Error('Python execution is disabled (no pyodideCdnUrl configured).'));
    // Pyodide fetches its sibling files (pyodide.asm.js/.wasm, python_stdlib.zip,
    // pyodide-lock.json) relative to an `indexURL`; derive it from the script
    // URL so this works whether pyodideCdnUrl points at a CDN or the locally
    // vendored copy under editor/libraries/pyodide.
    const indexURL = cdnUrl.slice(0, cdnUrl.lastIndexOf('/') + 1);
    pyodidePromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = cdnUrl;
      script.onload = async () => {
        try { resolve(await window.loadPyodide({ indexURL })); } catch (e) { reject(e); }
      };
      script.onerror = () => reject(new Error('Could not load the Python runtime (are you offline?).'));
      document.head.appendChild(script);
    });
    return pyodidePromise;
  }

  let mermaidPromise = null;
  function loadMermaidRuntime() {
    if (mermaidPromise) return mermaidPromise;
    const cdnUrl = CONFIG.mermaidCdnUrl;
    if (!cdnUrl) return Promise.reject(new Error('Mermaid rendering is disabled (no mermaidCdnUrl configured).'));
    mermaidPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = cdnUrl;
      script.onload = () => {
        try {
          window.mermaid.initialize({ startOnLoad: false, theme: state.theme === 'light' ? 'default' : 'dark' });
          resolve(window.mermaid);
        } catch (e) { reject(e); }
      };
      script.onerror = () => reject(new Error('Could not load Mermaid (are you offline?).'));
      document.head.appendChild(script);
    });
    return mermaidPromise;
  }

  let mermaidRenderSeq = 0;
  async function renderMermaidDiagram(source, container) {
    const code = stripMermaidMarker(source);
    try {
      const mermaid = await loadMermaidRuntime();
      const id = 'mermaid-diagram-' + (++mermaidRenderSeq);
      const { svg } = await mermaid.render(id, code);
      container.innerHTML = svg;
    } catch (err) {
      container.innerHTML = `<pre class="output-text output-error-text">${escapeHtml('Mermaid render failed: ' + (err && err.message ? err.message : err))}</pre>`;
    }
  }

  async function runCell(record, cell, effectiveLang, outputDiv) {
    outputDiv.classList.remove('hidden', 'output-error');
    if (effectiveLang === 'sql') {
      outputDiv.innerHTML = '<pre class="output-text output-info-text">SQL execution requires a live Databricks/Spark connection, ' +
        'which this offline local editor does not have. Use "Run" in Databricks to execute this query.</pre>';
      return;
    }
    outputDiv.innerHTML = '<pre class="output-text">Running\u2026</pre>';
    try {
      const pyodide = await loadPyodideRuntime();
      let out = '';
      pyodide.setStdout({ batched: (s) => { out += s + '\n'; } });
      pyodide.setStderr({ batched: (s) => { out += s + '\n'; } });
      const result = await pyodide.runPythonAsync(cell.source);
      if (result !== undefined && result !== null) out += String(result) + '\n';
      outputDiv.innerHTML = `<pre class="output-text">${escapeHtml(out || '(no output)')}</pre>`;
    } catch (err) {
      outputDiv.classList.add('output-error');
      outputDiv.innerHTML = `<pre class="output-text output-error-text">${escapeHtml(String(err && err.message ? err.message : err))}</pre>`;
    }
  }

  // ---------------------------------------------------------------------
  // Notebook structure panel (right-hand outline based on markdown headers
  // and cell titles)
  // ---------------------------------------------------------------------

  function buildOutline(record) {
    const root = { level: 0, children: [] };
    const stack = [root];
    const openHeadings = [];
    const ranges = new Map();

    function closeHeadingsAtOrAbove(level, beforeIdx) {
      while (openHeadings.length && openHeadings[openHeadings.length - 1].level >= level) {
        const h = openHeadings.pop();
        ranges.set(h.key, { start: h.startIdx, end: beforeIdx });
      }
    }

    record.cells.forEach((cell, idx) => {
      const lang = getCellLanguage(record, cell);
      const headings = [];
      if (lang === 'markdown') {
        (cell.source || '').split(/\r?\n/).forEach((line) => {
          const m = line.match(/^(#{1,6})\s+(.*)$/);
          if (m) headings.push({ level: m[1].length, text: m[2].trim() || `Cell ${idx + 1}` });
        });
      }
      if (headings.length) {
        headings.forEach((h) => {
          closeHeadingsAtOrAbove(h.level, idx - 1);
          while (stack.length > 1 && stack[stack.length - 1].level >= h.level) stack.pop();
          const key = `h:${idx}:${h.level}:${h.text}`;
          const node = { type: 'heading', level: h.level, text: h.text, cellIndex: idx, key, children: [] };
          stack[stack.length - 1].children.push(node);
          stack.push(node);
          openHeadings.push({ level: h.level, key, startIdx: idx + 1 });
        });
      } else {
        const label = cell.title || `cell ${idx + 1}`;
        stack[stack.length - 1].children.push({ type: 'cell', text: label, cellIndex: idx, key: `c:${idx}` });
      }
    });
    closeHeadingsAtOrAbove(0, record.cells.length - 1);
    return { tree: root.children, ranges };
  }

  function isCellHiddenBySection(record, idx, ranges) {
    if (!record.ui || !record.ui.collapsedSections.size) return false;
    for (const [key, range] of ranges) {
      if (record.ui.collapsedSections.has(key) && idx >= range.start && idx <= range.end) return true;
    }
    return false;
  }

  function renderStructurePanel() {
    const paneId = state.focusedPane;
    const path = state.panes[paneId].activePath;
    const record = path ? state.openFiles.get(path) : null;
    const isNotebook = !!record && (record.kind === 'notebook' || record.kind === 'ipynb');
    el.structurePanel.classList.toggle('hidden', !isNotebook);
    el.structureResizer.classList.toggle('hidden', !isNotebook);
    el.structureContainer.innerHTML = '';
    if (!isNotebook) return;
    record.ui = record.ui || { collapsedCells: new Set(), mdEditing: new Set(), collapsedSections: new Set(), mermaidEditing: new Set() };
    const outline = buildOutline(record);
    record.__outlineRanges = outline.ranges;
    const rootUl = document.createElement('ul');
    rootUl.className = 'structure-tree';
    renderOutlineNodes(outline.tree, rootUl, record, paneId);
    el.structureContainer.appendChild(rootUl);
  }

  function renderOutlineNodes(nodes, container, record, paneId) {
    for (const node of nodes) {
      const li = document.createElement('li');
      const row = document.createElement('div');
      row.className = 'structure-item' + (node.type === 'heading' ? ' heading level-' + node.level : ' leaf');

      const twisty = document.createElement('span');
      twisty.className = 'structure-twisty';
      if (node.type === 'heading' && node.children.length) {
        const collapsed = record.ui.collapsedSections.has(node.key);
        twisty.textContent = collapsed ? '\u25B8' : '\u25BE';
        twisty.addEventListener('click', (ev) => {
          ev.stopPropagation();
          if (collapsed) record.ui.collapsedSections.delete(node.key);
          else record.ui.collapsedSections.add(node.key);
          renderPane(paneId);
        });
      }
      row.appendChild(twisty);

      const label = document.createElement('span');
      label.className = 'structure-label';
      label.textContent = node.text;
      row.appendChild(label);
      row.addEventListener('click', () => scrollToCell(record, paneId, node.cellIndex));
      li.appendChild(row);

      if (node.type === 'heading' && node.children.length) {
        const childUl = document.createElement('ul');
        childUl.className = 'structure-tree';
        if (record.ui.collapsedSections.has(node.key)) childUl.classList.add('hidden');
        renderOutlineNodes(node.children, childUl, record, paneId);
        li.appendChild(childUl);
      }
      container.appendChild(li);
    }
  }

  function scrollToCell(record, paneId, cellIndex) {
    let changed = false;
    if (record.__outlineRanges) {
      for (const [key, range] of record.__outlineRanges) {
        if (record.ui.collapsedSections.has(key) && cellIndex >= range.start && cellIndex <= range.end) {
          record.ui.collapsedSections.delete(key);
          changed = true;
        }
      }
    }
    if (changed) renderPane(paneId);
    requestAnimationFrame(() => {
      const cellEl = document.getElementById(`cell-${paneId}-${cellIndex}`);
      if (cellEl) {
        cellEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        cellEl.classList.add('flash');
        setTimeout(() => cellEl.classList.remove('flash'), 900);
      }
    });
  }

  el.btnStructureCollapse.addEventListener('click', () => {
    const paneId = state.focusedPane;
    const path = state.panes[paneId].activePath;
    const record = path ? state.openFiles.get(path) : null;
    if (!record || !record.__outlineRanges) return;
    record.ui = record.ui || { collapsedCells: new Set(), mdEditing: new Set(), collapsedSections: new Set(), mermaidEditing: new Set() };
    const anyCollapsed = record.ui.collapsedSections.size > 0;
    if (anyCollapsed) {
      record.ui.collapsedSections.clear();
    } else {
      for (const key of record.__outlineRanges.keys()) record.ui.collapsedSections.add(key);
    }
    renderPane(paneId);
  });

  function mkIconBtn(label, title, onClick) {
    const b = document.createElement('button');
    b.className = 'icon-btn';
    b.textContent = label;
    b.title = title;
    b.addEventListener('click', onClick);
    return b;
  }

  function syncScroll(textarea, pre) {
    textarea.addEventListener('scroll', () => {
      pre.scrollTop = textarea.scrollTop;
      pre.scrollLeft = textarea.scrollLeft;
    });
  }

  ['a', 'b'].forEach((paneId) => {
    const pe = getPaneEls(paneId);
    pe.addCellBtn.addEventListener('click', () => {
      const path = state.panes[paneId].activePath;
      const record = path && state.openFiles.get(path);
      if (!record || record.kind === 'plain') return;
      record.cells.push(record.kind === 'ipynb'
        ? { cell_type: 'code', title: '', language: '', skip: false, source: '', metadata: {}, outputs: [], execution_count: null }
        : { title: '', language: '', skip: false, source: '' });
      markDirty(record);
      renderPane(paneId);
    });
    pe.saveBtn.addEventListener('click', () => {
      const path = state.panes[paneId].activePath;
      const record = path && state.openFiles.get(path);
      if (record) flushDiskSave(record);
    });
    pe.lang.addEventListener('change', async () => {
      const path = state.panes[paneId].activePath;
      const record = path && state.openFiles.get(path);
      if (!record) return;
      const oldDefaultLang = record.defaultLang;
      record.defaultLang = pe.lang.value;
      pinCellLanguagesToOldDefault(record, oldDefaultLang, record.defaultLang);
      markDirty(record);
      const newExt = DEFAULT_LANG_EXT[record.defaultLang];
      if (record.kind === 'notebook' && newExt && newExt !== record.ext) {
        const oldName = record.path.split('/').pop();
        const baseName = oldName.includes('.') ? oldName.slice(0, oldName.lastIndexOf('.')) : oldName;
        await renameOpenFile(record, `${baseName}.${newExt}`);
        return;
      }
      renderPane(paneId);
    });
    pe.root.addEventListener('mousedown', () => { state.focusedPane = paneId; });
  });

  el.btnSplitEditor.addEventListener('click', () => {
    state.splitEnabled = !state.splitEnabled;
    el.btnSplitEditor.classList.toggle('active', state.splitEnabled);
    if (state.splitEnabled && !state.panes.b.activePath) {
      state.panes.b.activePath = state.panes.a.activePath;
    }
    renderAll();
  });

  // ---------------------------------------------------------------------
  // Dirty tracking / autosave (localStorage draft + debounced disk write)
  // ---------------------------------------------------------------------

  function getDebouncers(path) {
    if (!debouncers.has(path)) {
      debouncers.set(path, {
        draft: debounce(() => saveDraft(state.openFiles.get(path)), DRAFT_SAVE_DEBOUNCE_MS),
        disk: debounce(() => flushDiskSave(state.openFiles.get(path)), DISK_SAVE_DEBOUNCE_MS),
      });
    }
    return debouncers.get(path);
  }

  function markDirty(record) {
    if (!record) return;
    record.dirty = true;
    refreshDirtyMarkers();
    refreshPanesForPath(record.path);
    const deb = getDebouncers(record.path);
    deb.draft();
    if (el.autoSaveToggle.checked) deb.disk();
  }

  function saveDraft(record) {
    if (!record) return;
    const payload = { savedAt: Date.now(), mtime: Date.now() };
    if (record.kind === 'notebook' || record.kind === 'ipynb') payload.cells = record.cells;
    else payload.content = record.content;
    try {
      localStorage.setItem(DRAFT_PREFIX + record.path, JSON.stringify(payload));
    } catch {
      // localStorage full/unavailable - ignore, disk save is primary persistence
    }
  }

  async function flushDiskSave(record) {
    if (!record) return;
    const deb = debouncers.get(record.path);
    if (deb) deb.disk.cancel();
    if (!record.dirty) return;
    try {
      let text;
      if (record.kind === 'notebook') text = serializeDatabricksNotebook(record.cells, record.token, record.defaultLang);
      else if (record.kind === 'ipynb') text = serializeIpynb(record.raw, record.cells, record.defaultLang);
      else text = record.content;

      const writable = await record.handle.createWritable();
      await writable.write(text);
      await writable.close();

      record.dirty = false;
      localStorage.removeItem(DRAFT_PREFIX + record.path);
      refreshDirtyMarkers();
      refreshPanesForPath(record.path, { cls: 'saved', text: `Saved at ${nowStr()}` });
    } catch (err) {
      refreshPanesForPath(record.path, { cls: 'error', text: 'Save failed: ' + err.message });
    }
  }

  document.addEventListener('keydown', (ev) => {
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 's') {
      ev.preventDefault();
      const activePath = state.panes[state.focusedPane].activePath;
      const record = state.lastFocusedRecord || (activePath && state.openFiles.get(activePath));
      if (record) flushDiskSave(record);
    }
  });

  // F2 renames the currently selected navigation-panel item (file or folder).
  document.addEventListener('keydown', (ev) => {
    if (ev.key !== 'F2') return;
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) return;
    if (!state.selectedNode) return;
    ev.preventDefault();
    if (state.selectedNode.isDir) promptRenameFolder(state.selectedNode.handle, state.selectedNode.path);
    else promptRenameFile(state.selectedNode.parentHandle, state.selectedNode.path);
  });

  window.addEventListener('beforeunload', (ev) => {
    for (const record of state.openFiles.values()) {
      if (record.dirty) {
        ev.preventDefault();
        ev.returnValue = '';
        return;
      }
    }
  });

  // ---------------------------------------------------------------------
  // Status helpers
  // ---------------------------------------------------------------------

  function setStatus(text, isError) {
    el.statusText.textContent = text;
    el.statusText.style.color = isError ? '#ff8a80' : '';
  }

  // ---------------------------------------------------------------------
  // Sidebar resizing
  // ---------------------------------------------------------------------

  (function setupResizer() {
    let dragging = false;
    el.resizer.addEventListener('mousedown', () => {
      dragging = true;
      el.resizer.classList.add('active');
      document.body.style.userSelect = 'none';
    });
    window.addEventListener('mousemove', (ev) => {
      if (!dragging) return;
      const rect = document.getElementById('main').getBoundingClientRect();
      const newWidth = Math.min(Math.max(ev.clientX - rect.left, 160), rect.width * 0.7);
      el.sidebar.style.width = newWidth + 'px';
    });
    window.addEventListener('mouseup', () => {
      dragging = false;
      el.resizer.classList.remove('active');
      document.body.style.userSelect = '';
    });
  })();

  (function setupStructureResizer() {
    let dragging = false;
    el.structureResizer.addEventListener('mousedown', () => {
      dragging = true;
      el.structureResizer.classList.add('active');
      document.body.style.userSelect = 'none';
    });
    window.addEventListener('mousemove', (ev) => {
      if (!dragging) return;
      const rect = document.getElementById('main').getBoundingClientRect();
      const newWidth = Math.min(Math.max(rect.right - ev.clientX, 160), rect.width * 0.5);
      el.structurePanel.style.width = newWidth + 'px';
    });
    window.addEventListener('mouseup', () => {
      dragging = false;
      el.structureResizer.classList.remove('active');
      document.body.style.userSelect = '';
    });
  })();

  // ---------------------------------------------------------------------
  // Wiring & init
  // ---------------------------------------------------------------------

  el.btnOpenRepo.addEventListener('click', openRepo);
  el.btnReconnect.addEventListener('click', reconnectRepo);
  el.btnRefreshTree.addEventListener('click', () => state.rootHandle && buildTree());
  el.btnNewNotebook.addEventListener('click', () => {
    if (!state.rootHandle) { setStatus('Open a repository first', true); return; }
    promptNewNotebook(state.rootHandle, '');
  });
  el.btnNewFile.addEventListener('click', () => {
    if (!state.rootHandle) { setStatus('Open a repository first', true); return; }
    promptNewFile(state.rootHandle, '');
  });
  el.btnNewFolder.addEventListener('click', () => {
    if (!state.rootHandle) { setStatus('Open a repository first', true); return; }
    promptNewFolder(state.rootHandle, '');
  });
  el.btnBindFolder.addEventListener('click', bindFolder);

  (async function init() {
    applyTheme(state.theme);
    applySidebarCollapsed();
    updateAutoSaveStatus();
    if (!checkSupport()) return;
    await tryRestoreRepo();
    await tryRestoreExtraRoots();
  })();
})();
