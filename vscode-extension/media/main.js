// Databricks Notebook Editor - webview UI logic.
//
// This is a trimmed port of the standalone web-editor's cell engine
// (../web-editor/adb.js): the Databricks .py/.sql and .ipynb parsing /
// serialization, syntax highlighting and cell rendering are functionally
// the same. Everything specific to running as a full standalone app - the
// File System Access API, the file/folder navigation tree, multi-tab /
// split-pane editing, theming toggle, autosave-to-disk debouncing, Pyodide
// execution and Mermaid rendering - is intentionally left out: a VS Code
// custom editor already gets file I/O, dirty tracking, undo/redo and save
// for free from the extension host (see ../extension.js), and only ever
// shows exactly one already-open file, so none of that is needed here.
(() => {
  'use strict';

  const vscodeApi = acquireVsCodeApi();

  const COMMENT_TOKEN = { py: '#', sql: '--' };

  const CELL_LANGUAGE_OPTIONS = [
    { value: 'markdown', label: 'Markdown' },
    { value: 'sql', label: 'SQL' },
    { value: 'python', label: 'Python' },
  ];

  const DEFAULT_LANG_OPTIONS = [
    { value: 'markdown', label: 'Markdown' },
    { value: 'sql', label: 'SQL' },
    { value: 'python', label: 'Python' },
  ];

  const PY_KEYWORDS = ['False','None','True','and','as','assert','async','await','break','class',
    'continue','def','del','elif','else','except','finally','for','from','global','if','import',
    'in','is','lambda','nonlocal','not','or','pass','raise','return','try','while','with','yield'];

  const SQL_KEYWORDS = ['SELECT','FROM','WHERE','JOIN','INNER','LEFT','RIGHT','FULL','OUTER','ON',
    'GROUP','BY','ORDER','HAVING','INSERT','INTO','VALUES','UPDATE','SET','DELETE','CREATE','TABLE',
    'VIEW','DROP','ALTER','AS','AND','OR','NOT','NULL','IS','IN','LIKE','BETWEEN','LIMIT','DISTINCT',
    'UNION','ALL','CASE','WHEN','THEN','ELSE','END','WITH','USING','PARTITION','OVER','DESC','ASC',
    'CAST','EXISTS','MERGE','USE','SCHEMA','DATABASE','DATABRICKS','DELTA','OPTIMIZE','VACUUM',
    'ZORDER','CLONE','STREAM'];

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
    wrapped.cancel = () => clearTimeout(t);
    return wrapped;
  }

  // -----------------------------------------------------------------------
  // Databricks notebook (.py/.sql) parsing & serialization
  // (ported verbatim from web-editor/adb.js)
  // -----------------------------------------------------------------------

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
        language = 'run';
      } else {
        language = key === 'md' ? 'markdown' : key;
        full = full.slice(m[0].length);
      }
    }
    return { title, language, skip, source: full };
  }

  function languageToMagicKeyword(lang) {
    return lang === 'markdown' ? 'md' : lang;
  }

  function serializeCellBlock(cell, token, defaultLang) {
    const lang = cell.language || '';
    const isRun = lang === 'run';
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

  // -----------------------------------------------------------------------
  // .ipynb parsing & serialization (ported verbatim from web-editor/adb.js)
  // -----------------------------------------------------------------------

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

  // -----------------------------------------------------------------------
  // Syntax highlighting (python / sql / markdown only - the notebook cell
  // languages this editor deals with)
  // -----------------------------------------------------------------------

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

  function highlightPlain(src) {
    return escapeHtml(src);
  }

  function highlightForLanguage(source, language) {
    if (language === 'sql') return highlightSql(source);
    if (language === 'python') return highlightPython(source);
    if (language === 'markdown') return highlightMarkdown(source);
    return highlightPlain(source);
  }

  // Lightweight markdown -> HTML renderer for the read-only preview shown
  // for markdown cells (ported verbatim from web-editor/adb.js, minus
  // nothing - tables/headings/lists/links/quotes/code all included).
  function renderMarkdownToHtml(src) {
    const lines = (src || '').split(/\r?\n/);
    let html = '';
    let inCode = false;
    let codeBuf = [];
    let listMode = null;
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
      t = t.replace(/\[([^\]]*)\]\(([^)]*)\)/g, '<a href="$2">$1</a>');
      t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
      t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      t = t.replace(/\*([^*]+)\*/g, '<em>$1</em>');
      return t;
    }

    function splitTableRow(line) {
      let trimmed = line.trim();
      if (trimmed.startsWith('|')) trimmed = trimmed.slice(1);
      if (trimmed.endsWith('|') && !trimmed.endsWith('\\|')) trimmed = trimmed.slice(0, -1);
      return trimmed.split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'));
    }
    function isTableRow(line) { return /\|/.test(line); }
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
    function alignAttr(align) { return align ? ` style="text-align:${align}"` : ''; }
    function buildTableHtml(headerCells, aligns, bodyRows) {
      let out = '<table class="md-table"><thead><tr>';
      headerCells.forEach((cell, i) => { out += `<th${alignAttr(aligns[i])}>${inline(cell)}</th>`; });
      out += '</tr></thead><tbody>';
      for (const row of bodyRows) {
        out += '<tr>';
        headerCells.forEach((_, i) => { out += `<td${alignAttr(aligns[i])}>${inline(row[i] || '')}</td>`; });
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

  function pinCellLanguagesToOldDefault(record, oldDefaultLang, newDefaultLang) {
    if (!record || !Array.isArray(record.cells) || oldDefaultLang === newDefaultLang) return;
    for (const cell of record.cells) {
      if (record.kind === 'ipynb' && cell.cell_type === 'markdown') continue;
      if (!cell.language) cell.language = oldDefaultLang;
    }
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

  // Lazily loads the Mermaid runtime vendored under media/libraries/mermaid
  // (its webview URI is injected as window.__mermaidUri by extension.js).
  // The CSP's script-src allows the webview's own resource origin
  // (webview.cspSource), so this plain <script src> load is permitted
  // without needing a nonce.
  let mermaidPromise = null;
  function loadMermaidRuntime() {
    if (mermaidPromise) return mermaidPromise;
    if (!window.__mermaidUri) return Promise.reject(new Error('Mermaid runtime URI is not available.'));
    mermaidPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = window.__mermaidUri;
      script.onload = () => {
        try {
          const isDark = document.body.classList.contains('vscode-dark') || document.body.classList.contains('vscode-high-contrast');
          window.mermaid.initialize({ startOnLoad: false, theme: isDark ? 'dark' : 'default' });
          resolve(window.mermaid);
        } catch (e) { reject(e); }
      };
      script.onerror = () => reject(new Error('Could not load the Mermaid runtime.'));
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

  // -----------------------------------------------------------------------
  // State
  // -----------------------------------------------------------------------

  const state = {
    record: null,
    fileName: '',
    ui: { collapsedCells: new Set(), mdEditing: new Set(), collapsedSections: new Set(), mermaidEditing: new Set() },
    lastSentText: null,
    outlineRanges: new Map(),
  };

  const el = {
    toolbar: document.getElementById('toolbar'),
    addCellBtn: document.getElementById('btn-add-cell'),
    defaultLangSelect: document.getElementById('default-lang'),
    statusText: document.getElementById('status-text'),
    cellsContainer: document.getElementById('cells'),
    plainEmpty: document.getElementById('plain-empty'),
    structurePanel: document.getElementById('structure-panel'),
    structureContainer: document.getElementById('structure-container'),
    btnStructureCollapse: document.getElementById('btn-structure-collapse'),
  };

  function setStatus(text) {
    el.statusText.textContent = text;
  }

  function buildRecordFromText(text, ext) {
    if (ext === 'ipynb') {
      const { raw, cells } = parseIpynb(text && text.trim() ? text : '{"cells":[],"metadata":{},"nbformat":4,"nbformat_minor":5}');
      const lang = (raw && raw.metadata && raw.metadata.language_info && raw.metadata.language_info.name) || 'python';
      return { kind: 'ipynb', ext, raw, cells: cells.length ? cells : [{ cell_type: 'code', title: '', language: '', skip: false, source: '', metadata: {}, outputs: [], execution_count: null }], defaultLang: lang };
    }
    const token = COMMENT_TOKEN[ext] || '#';
    const defaultLang = ext === 'sql' ? 'sql' : 'python';
    if (isDatabricksSource(text, token)) {
      return { kind: 'notebook', ext, token, cells: parseDatabricksNotebook(text, token), defaultLang };
    }
    return { kind: 'plain', ext, content: text };
  }

  function serializeRecord(record) {
    if (record.kind === 'notebook') return serializeDatabricksNotebook(record.cells, record.token, record.defaultLang);
    if (record.kind === 'ipynb') return serializeIpynb(record.raw, record.cells, record.defaultLang);
    return record.content;
  }

  const sendEditDebounced = debounce(() => {
    const text = serializeRecord(state.record);
    state.lastSentText = text;
    vscodeApi.postMessage({ type: 'edit', text });
  }, 400);

  function markChanged() {
    sendEditDebounced();
  }

  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (msg.type !== 'init') return;
    if (msg.text === state.lastSentText) return; // echo of our own edit - UI is already correct
    state.fileName = msg.fileName;
    state.lastSentText = msg.text;
    state.record = buildRecordFromText(msg.text, msg.ext);
    render();
  });

  vscodeApi.postMessage({ type: 'ready' });

  // -----------------------------------------------------------------------
  // Rendering
  // -----------------------------------------------------------------------

  function mkIconBtn(label, title, onClick) {
    const b = document.createElement('button');
    b.className = 'icon-btn';
    b.textContent = label;
    b.title = title;
    b.addEventListener('click', onClick);
    return b;
  }

  function syncScroll(textarea, pre, gutter) {
    textarea.addEventListener('scroll', () => {
      pre.scrollTop = textarea.scrollTop;
      pre.scrollLeft = textarea.scrollLeft;
      if (gutter) gutter.scrollTop = textarea.scrollTop;
    });
  }

  function updateLineNumbers(gutter, source) {
    const count = source.split('\n').length;
    let out = '';
    for (let i = 1; i <= count; i++) out += i + '\n';
    gutter.textContent = out;
  }

  function render() {
    const record = state.record;
    if (!record) return;

    if (record.kind === 'plain') {
      el.addCellBtn.classList.add('hidden');
      el.defaultLangSelect.classList.add('hidden');
      el.structurePanel.classList.add('hidden');
      el.plainEmpty.classList.remove('hidden');
      el.plainEmpty.textContent = `"${state.fileName}" is not a Databricks notebook source file (missing the ` +
        '"Databricks notebook source" header) - open it in a regular text editor instead.';
      el.cellsContainer.innerHTML = '';
      setStatus(state.fileName);
      return;
    }

    el.plainEmpty.classList.add('hidden');
    el.addCellBtn.classList.remove('hidden');
    el.defaultLangSelect.classList.remove('hidden');
    setStatus(state.fileName);

    el.defaultLangSelect.innerHTML = DEFAULT_LANG_OPTIONS.map((o) =>
      `<option value="${o.value}" ${o.value === record.defaultLang ? 'selected' : ''}>${o.label}</option>`
    ).join('');

    el.cellsContainer.innerHTML = '';
    const outline = buildOutline(record);
    state.outlineRanges = outline.ranges;
    record.cells.forEach((cell, idx) => {
      if (isCellHiddenBySection(idx, outline.ranges)) return;
      renderCell(record, cell, idx, el.cellsContainer);
    });

    renderStructurePanel(record, outline);
  }

  function renderCell(record, cell, idx, container) {
    const isIpynb = record.kind === 'ipynb';
    const effectiveLang = getCellLanguage(record, cell);
    const isMarkdown = effectiveLang === 'markdown';
    const isMermaid = effectiveLang === 'python' && isMermaidCell(cell.source);
    const isCollapsed = state.ui.collapsedCells.has(idx);

    const cellDiv = document.createElement('div');
    cellDiv.className = 'cell cell-lang-' + cellLangCssKey(effectiveLang) + (cell.skip ? ' cell-skipped' : '') + (isCollapsed ? ' cell-collapsed' : '');
    cellDiv.id = `cell-${idx}`;

    const titleBar = document.createElement('div');
    titleBar.className = 'cell-title-bar';

    const collapseBtn = mkIconBtn(isCollapsed ? '\u25B8' : '\u25BE', isCollapsed ? 'Expand cell' : 'Collapse cell', () => {
      if (state.ui.collapsedCells.has(idx)) state.ui.collapsedCells.delete(idx);
      else state.ui.collapsedCells.add(idx);
      render();
    });
    collapseBtn.classList.add('cell-collapse-toggle');
    titleBar.appendChild(collapseBtn);

    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.className = 'cell-title-input';
    titleInput.placeholder = `Cell ${idx + 1} \u2013 untitled`;
    titleInput.value = cell.title || '';
    titleInput.addEventListener('input', () => {
      cell.title = titleInput.value;
      markChanged();
    });
    titleBar.appendChild(titleInput);

    const isRunCell = !isIpynb && cell.language === 'run';
    if (isIpynb) {
      const langSelect = document.createElement('select');
      langSelect.className = 'lang-select lang-' + cellLangCssKey(effectiveLang);
      langSelect.innerHTML = '<option value="code">Code</option><option value="markdown">Markdown</option>';
      langSelect.value = cell.cell_type;
      langSelect.addEventListener('change', () => {
        cell.cell_type = langSelect.value;
        markChanged();
        render();
      });
      titleBar.appendChild(langSelect);
    } else if (isRunCell) {
      const runBadge = document.createElement('span');
      runBadge.className = 'lang-badge lang-run';
      runBadge.title = '%run cell (executes another notebook)';
      runBadge.textContent = 'RUN';
      titleBar.appendChild(runBadge);
    } else {
      const langSelect = document.createElement('select');
      langSelect.className = 'lang-select lang-' + cellLangCssKey(effectiveLang);
      langSelect.title = 'Cell language';
      langSelect.innerHTML = CELL_LANGUAGE_OPTIONS.map((o) => `<option value="${o.value}">${escapeHtml(o.label)}</option>`).join('');
      langSelect.value = cell.language || record.defaultLang;
      langSelect.addEventListener('change', () => {
        const chosen = langSelect.value;
        cell.language = chosen === record.defaultLang ? '' : chosen;
        markChanged();
        render();
      });
      titleBar.appendChild(langSelect);
    }
    cellDiv.appendChild(titleBar);

    const toolbar = document.createElement('div');
    toolbar.className = 'cell-toolbar';

    const indexSpan = document.createElement('span');
    indexSpan.className = 'cell-index';
    indexSpan.textContent = String(idx + 1);
    toolbar.appendChild(indexSpan);

    if (!isMarkdown) {
      const skipLabel = document.createElement('label');
      skipLabel.className = 'cell-skip-toggle';
      skipLabel.title = 'Skip this cell (%skip)';
      const skipCheckbox = document.createElement('input');
      skipCheckbox.type = 'checkbox';
      skipCheckbox.checked = !!cell.skip;
      skipCheckbox.addEventListener('change', () => {
        cell.skip = skipCheckbox.checked;
        markChanged();
        render();
      });
      skipLabel.appendChild(skipCheckbox);
      skipLabel.appendChild(document.createTextNode(' Skip'));
      toolbar.appendChild(skipLabel);
    }

    const spacer = document.createElement('span');
    spacer.className = 'spacer';
    toolbar.appendChild(spacer);

    const btnUp = mkIconBtn('\u2191', 'Move cell up', () => {
      if (idx === 0) return;
      [record.cells[idx - 1], record.cells[idx]] = [record.cells[idx], record.cells[idx - 1]];
      markChanged();
      render();
    });
    const btnDown = mkIconBtn('\u2193', 'Move cell down', () => {
      if (idx === record.cells.length - 1) return;
      [record.cells[idx + 1], record.cells[idx]] = [record.cells[idx], record.cells[idx + 1]];
      markChanged();
      render();
    });
    const btnAddBelow = mkIconBtn('+', 'Insert cell below', () => {
      record.cells.splice(idx + 1, 0, isIpynb
        ? { cell_type: 'code', title: '', language: '', skip: false, source: '', metadata: {}, outputs: [], execution_count: null }
        : { title: '', language: '', skip: false, source: '' });
      markChanged();
      render();
    });
    const btnDelete = mkIconBtn('\u00D7', 'Delete cell', () => {
      if (record.cells.length === 1) { setStatus('A notebook needs at least one cell'); return; }
      record.cells.splice(idx, 1);
      markChanged();
      render();
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

    if (isMarkdown) {
      const editing = state.ui.mdEditing.has(idx) || !cell.source;
      if (editing) {
        wrap.appendChild(buildCodeEditor(cell, effectiveLang, cellDiv, () => {
          state.ui.mdEditing.delete(idx);
          render();
        }));
      } else {
        const preview = document.createElement('div');
        preview.className = 'md-preview';
        preview.innerHTML = renderMarkdownToHtml(cell.source);
        preview.title = 'Click to edit';
        preview.addEventListener('click', () => {
          state.ui.mdEditing.add(idx);
          render();
        });
        wrap.appendChild(preview);
      }
    } else if (isMermaid) {
      const editing = state.ui.mermaidEditing.has(idx);
      if (editing) {
        wrap.appendChild(buildCodeEditor(cell, effectiveLang, cellDiv, () => {
          state.ui.mermaidEditing.delete(idx);
          render();
        }));
      } else {
        const preview = document.createElement('div');
        preview.className = 'mermaid-preview';
        preview.title = 'Double-click to edit the Mermaid diagram code';
        preview.textContent = 'Rendering diagram\u2026';
        preview.addEventListener('dblclick', () => {
          state.ui.mermaidEditing.add(idx);
          render();
        });
        wrap.appendChild(preview);
        renderMermaidDiagram(cell.source, preview);
      }
    } else {
      wrap.appendChild(buildCodeEditor(cell, effectiveLang, cellDiv, null));
    }

    body.appendChild(wrap);
    cellDiv.appendChild(body);
    container.appendChild(cellDiv);
  }

  function buildCodeEditor(cell, effectiveLang, cellDiv, onBlurExtra) {
    const wrap = document.createElement('div');
    wrap.className = 'cell-editor-wrap';
    const gutter = document.createElement('div');
    gutter.className = 'cell-line-numbers';
    const inner = document.createElement('div');
    inner.className = 'cell-editor-inner';
    const pre = document.createElement('pre');
    pre.className = 'highlight-layer';
    const textarea = document.createElement('textarea');
    textarea.className = 'code-input';
    textarea.value = cell.source;
    textarea.rows = Math.max(3, Math.min(24, cell.source.split('\n').length + 1));

    pre.innerHTML = highlightForLanguage(cell.source, effectiveLang) + '\n';
    updateLineNumbers(gutter, cell.source);

    textarea.addEventListener('focus', () => cellDiv.classList.add('focused'));
    textarea.addEventListener('blur', () => {
      cellDiv.classList.remove('focused');
      if (onBlurExtra) onBlurExtra();
    });
    textarea.addEventListener('input', () => {
      cell.source = textarea.value;
      pre.innerHTML = highlightForLanguage(cell.source, effectiveLang) + '\n';
      updateLineNumbers(gutter, cell.source);
      markChanged();
    });
    syncScroll(textarea, pre, gutter);

    inner.appendChild(pre);
    inner.appendChild(textarea);
    wrap.appendChild(gutter);
    wrap.appendChild(inner);
    return wrap;
  }

  // -----------------------------------------------------------------------
  // Structure / outline panel
  // -----------------------------------------------------------------------

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

  function isCellHiddenBySection(idx, ranges) {
    if (!state.ui.collapsedSections.size) return false;
    for (const [key, range] of ranges) {
      if (state.ui.collapsedSections.has(key) && idx >= range.start && idx <= range.end) return true;
    }
    return false;
  }

  function renderStructurePanel(record, outline) {
    el.structurePanel.classList.remove('hidden');
    el.structureContainer.innerHTML = '';
    const rootUl = document.createElement('ul');
    rootUl.className = 'structure-tree';
    renderOutlineNodes(outline.tree, rootUl);
    el.structureContainer.appendChild(rootUl);
  }

  function renderOutlineNodes(nodes, container) {
    for (const node of nodes) {
      const li = document.createElement('li');
      const row = document.createElement('div');
      row.className = 'structure-item' + (node.type === 'heading' ? ' heading level-' + node.level : ' leaf');

      const twisty = document.createElement('span');
      twisty.className = 'structure-twisty';
      if (node.type === 'heading' && node.children.length) {
        const collapsed = state.ui.collapsedSections.has(node.key);
        twisty.textContent = collapsed ? '\u25B8' : '\u25BE';
        twisty.addEventListener('click', (ev) => {
          ev.stopPropagation();
          if (collapsed) state.ui.collapsedSections.delete(node.key);
          else state.ui.collapsedSections.add(node.key);
          render();
        });
      }
      row.appendChild(twisty);

      const label = document.createElement('span');
      label.className = 'structure-label';
      label.textContent = node.text;
      row.appendChild(label);
      row.addEventListener('click', () => scrollToCell(node.cellIndex));
      li.appendChild(row);

      if (node.type === 'heading' && node.children.length) {
        const childUl = document.createElement('ul');
        childUl.className = 'structure-tree';
        if (state.ui.collapsedSections.has(node.key)) childUl.classList.add('hidden');
        renderOutlineNodes(node.children, childUl);
        li.appendChild(childUl);
      }
      container.appendChild(li);
    }
  }

  function scrollToCell(cellIndex) {
    let changed = false;
    for (const [key, range] of state.outlineRanges) {
      if (state.ui.collapsedSections.has(key) && cellIndex >= range.start && cellIndex <= range.end) {
        state.ui.collapsedSections.delete(key);
        changed = true;
      }
    }
    if (changed) render();
    requestAnimationFrame(() => {
      const cellEl = document.getElementById(`cell-${cellIndex}`);
      if (cellEl) {
        cellEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        cellEl.classList.add('flash');
        setTimeout(() => cellEl.classList.remove('flash'), 900);
      }
    });
  }

  el.btnStructureCollapse.addEventListener('click', () => {
    if (!state.outlineRanges.size) return;
    const anyCollapsed = state.ui.collapsedSections.size > 0;
    if (anyCollapsed) state.ui.collapsedSections.clear();
    else for (const key of state.outlineRanges.keys()) state.ui.collapsedSections.add(key);
    render();
  });

  // -----------------------------------------------------------------------
  // Toolbar wiring
  // -----------------------------------------------------------------------

  el.addCellBtn.addEventListener('click', () => {
    if (!state.record || state.record.kind === 'plain') return;
    state.record.cells.push(state.record.kind === 'ipynb'
      ? { cell_type: 'code', title: '', language: '', skip: false, source: '', metadata: {}, outputs: [], execution_count: null }
      : { title: '', language: '', skip: false, source: '' });
    markChanged();
    render();
  });

  el.defaultLangSelect.addEventListener('change', () => {
    if (!state.record) return;
    const oldDefaultLang = state.record.defaultLang;
    state.record.defaultLang = el.defaultLangSelect.value;
    pinCellLanguagesToOldDefault(state.record, oldDefaultLang, state.record.defaultLang);
    markChanged();
    render();
  });
})();
