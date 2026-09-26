// Databricks Notebook Editor - extension host entry point.
//
// Registers a CustomTextEditorProvider so VS Code's own text document /
// file-system APIs handle reading, writing, dirty-tracking, undo/redo and
// save - there is no File System Access API involved (unlike the standalone
// web-editor), so there is nothing for a browser to prompt permission for,
// and it works identically whether the editor tab is focused inside the
// full VS Code window or any embedded panel.
'use strict';

const vscode = require('vscode');

const VIEW_TYPE = 'databricksNotebookEditor.notebook';

class DatabricksNotebookEditorProvider {
  constructor(context) {
    this.context = context;
  }

  static register(context) {
    const provider = new DatabricksNotebookEditorProvider(context);
    return vscode.window.registerCustomEditorProvider(VIEW_TYPE, provider, {
      webviewOptions: { retainContextWhenHidden: true },
      supportsMultipleEditorsPerDocument: false,
    });
  }

  async resolveCustomTextEditor(document, webviewPanel, _token) {
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'media')],
    };
    webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

    const postDocument = () => {
      const fileName = document.uri.path.split('/').pop() || '';
      const dot = fileName.lastIndexOf('.');
      const ext = dot === -1 ? '' : fileName.slice(dot + 1).toLowerCase();
      webviewPanel.webview.postMessage({
        type: 'init',
        fileName,
        ext,
        text: document.getText(),
      });
    };

    const changeSub = vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.uri.toString() === document.uri.toString()) postDocument();
    });
    webviewPanel.onDidDispose(() => changeSub.dispose());

    webviewPanel.webview.onDidReceiveMessage(async (message) => {
      if (message.type === 'ready') {
        postDocument();
      } else if (message.type === 'edit') {
        await this.applyFullTextEdit(document, message.text);
      } else if (message.type === 'status' && message.text) {
        vscode.window.setStatusBarMessage(message.text, 4000);
      }
    });
  }

  async applyFullTextEdit(document, newText) {
    if (newText === document.getText()) return true;
    const edit = new vscode.WorkspaceEdit();
    // Matches the pattern used by VS Code's own custom-editor samples: replace
    // the whole document range rather than diffing, since notebook cell edits
    // are re-serialized as a full file each time.
    edit.replace(document.uri, new vscode.Range(0, 0, document.lineCount, 0), newText);
    return vscode.workspace.applyEdit(edit);
  }

  getHtmlForWebview(webview) {
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'main.js'));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'main.css'));
    const mermaidUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'libraries', 'mermaid', 'mermaid.min.js')
    );
    const nonce = getNonce();
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data:; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'nonce-${nonce}';" />
<link rel="stylesheet" href="${styleUri}" />
<title>Databricks Notebook Editor</title>
</head>
<body>
  <div id="toolbar">
    <button id="btn-add-cell" title="Insert a new cell at the end">+ Cell</button>
    <select id="default-lang" class="hidden" title="Notebook default language"></select>
    <span class="spacer"></span>
    <span id="status-text"></span>
  </div>
  <div id="main">
    <div id="cells-container">
      <div id="plain-empty" class="hidden"></div>
      <div id="cells"></div>
    </div>
    <aside id="structure-panel" class="hidden">
      <div id="structure-toolbar">
        <span>Notebook Structure</span>
        <button id="btn-structure-collapse" title="Collapse / expand all sections">&#8801;</button>
      </div>
      <div id="structure-container"></div>
    </aside>
  </div>
  <script nonce="${nonce}">window.__mermaidUri = ${JSON.stringify(mermaidUri.toString())};</script>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) text += possible.charAt(Math.floor(Math.random() * possible.length));
  return text;
}

function activate(context) {
  context.subscriptions.push(DatabricksNotebookEditorProvider.register(context));
  context.subscriptions.push(
    vscode.commands.registerCommand('databricksNotebookEditor.openAsNotebook', async (uri) => {
      const target = uri || vscode.window.activeTextEditor?.document.uri;
      if (!target) return;
      await vscode.commands.executeCommand('vscode.openWith', target, VIEW_TYPE);
    })
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
