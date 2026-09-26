# Local Databricks Notebook Editor

## Goal

I need a Visual Studio Code extenstion to open Databricks Notebooks locally, to edit them, to convert py and sql files to Databricks notebook format.

## Requirements

### Deployment

Here should be one single PowerShell script for deployment, named `deploy.ps1`. It must handle all necessary steps for packaging, installation, and activation of the Visual Studio Code extension.

### Project Folder

All generated / updated files should be placed within the project folder structure, maintaining a clear organization for the Visual Studio Code extension, this folder should be named `vscode-extension`

### Offline / Local Libraries

- The extension must be able to run with **no internet connection** once the extension is deployed.
- Any third-party library the editor depends on (e.g. Pyodide for in-browser Python execution, Mermaid for diagram rendering) must be **vendored locally inside the project**, not loaded from a public CDN at runtime.
    - Vendored libraries live under `vscode-extension/editor/libraries/<library-name>/`.
    - `adb.config.js` must reference these local paths (e.g. `vscode-extension/editor/libraries/pyodide/pyodide.js`, `vscode-extension/editor/libraries/mermaid/mermaid.min.js`) instead of CDN URLs.
    - Where a library fetches additional sibling files at runtime (e.g. Pyodide's `.asm.js`/`.wasm`/stdlib files), those must be resolved relative to the local vendored folder as well, so nothing is fetched externally.
    - The CDN URL should remain configurable/swappable in `adb.config.js` for users who prefer not to ship the vendored files, but the shipped default must be the local, offline-capable path.

### Features

- The extension add menu option in the file context menu named `Open as Databricks Notebook`. 
    - If file is not formatted as a Databricks notebook, a warning should be displayed to the user, indicating that the file may not be fully compatible with the notebook editor.
    - The user should have the option to convert the file to Databricks notebook format.
    - The conversion process should preserve the content and structure of the original file as much as possible, ensuring a smooth transition to the Databricks notebook format. The content should be placed in the first cell of the newly converted Databricks notebook.

- The editor should provide support for syntax highlighing based on the file type, including SQL, Python, Markdown and YAML as main languages within the Databricks environment. Utilized the visual studio code syntax highlighting capabilities for these main languages, but also css, html, js, json, xml and PowerShell, but not limited to these.

- The editor is split in 2 sections.
- The two sections are:
    1. Notebook editing panel.
    2. Notebook structure based on the Markdown headers, allowing users to quickly navigate between different sections of the notebook.

- Auto-save feature: 
    - a checkbox in the header section of application can turn on or off the auto-save feature.
    - When auto-save is turned off, changes to files and folders should only be saved when the user explicitly triggers a save action.
    - The auto-save feature should provide visual feedback indicating whether it is currently enabled or disabled.

- The Extension should follow the Visual Studio Code set color theme.
    - All text-input elements should support dark and light themes.
    - All clickable elements should support dark and light themes.

- The Notebook Structure panel should reflect the hierarchy of the notebook based on Markdown headers, allowing users to quickly navigate between different sections of the notebook.
    - The panel should update dynamically as the user adds, removes, or reorganizes sections within the notebook.
    - The panel should highlight the currently active section in the notebook, providing visual feedback to the user about their current location within the notebook.
    - The panel should allow users to collapse or expand sections to manage the visibility of notebook content efficiently.
    - The panel should provide a search functionality to quickly locate specific sections within the notebook.
    - The panel should allow users to quickly jump to a specific section by clicking on its entry in the panel.
    - The panel should remember the user's previous state, such as which sections were expanded or collapsed, when the notebook is reopened.
    - The panel should be adjustable in size, allowing users to modify its width according to their preference.
   
### Notebook Editing Panel
- Top section of the notebook editing panel should display the toolbar with common actions and options for managing the notebook.
    - The toolbar should display the current saved state of the notebook with datetime.
    - The toolbar should display the default language (sql, python, markdown) in the form of a dropdown menu.
    - A checkbox to turn on/off the auto-save feature.
        - if turned off, changes to the notebook should only be saved when the user explicitly triggers a save action. The toolbar background should provide visual feedback indicating the auto-save status, the coloring should change based on whether auto-save is enabled or disabled and should be clearly distinguishable. Dark and Light mode should be supported.

- Notebook Cells
    - Each notebook cell should support different types, such as code cells and markdown cells.
    - Code cells should allow users to write and execute code in the selected programming language.
    - Markdown cells should support rich text formatting using Markdown syntax.
    - Cells should support drag-and-drop functionality for easy reordering within the notebook.
    - Cells should provide visual feedback for the code language, indicating the type of code contained within each cell.
    - Users should be able to add, delete, and rearrange cells within the notebook.
    - The notebook should automatically adjust the layout to accommodate the content of each cell, ensuring a smooth editing experience.

    - Databricks Notebook support cell titles
        - The databricks cell tool bar should provide the number and title of the cell.
        - The databricks cell title should be displayed and editable directly within the cell toolbar. 
        - When add or changing the cell title, this should be stored without any escaping or formatting applied, and should be immediately reflected in the cell toolbar. The encapsulation by double qoutes should NOT be included in the stored title or displayed in the cell toolbar.
        - Examples
            - WRONG: -- DBTITLE 1,"double \"qoutes\" and a single 'qout'"
            - CORRECT: -- DBTITLE 1,double "qoutes" and a single 'qout'

    - The Cell Header
        - The cell header should display the code language in the form of dropdown menu, allowing users to quickly change the language for that specific cell.
        - The cell header should display the title of the cell based on the Databricks notebook conventions, providing a clear and concise description of the cell's content, by clicking on the title, users should be able to edit it directly within the header.
        - The cell header should provide checkbox to indicate if the cell should be skipped during execution, based on the Databricks notebook conventions.
        - The cell header should have a caret-button to collapse or expand the cell content, allowing users to manage the visibility of the cell's content efficiently.
        - the cell header should have buttons to add new cells above or below the current cell, these will be in de default programming language of the notebook.

    - The databricks skip marker `%skip` should be handled with a checkbox in the left corner of the cell toolbar.
    - Skipped cell should be visually be greyed out.

    - The Cell content
        - The cell content area should allow users to write and edit code or markdown text, depending on the cell type.
        - The cell content should provide syntax highlighting based on the selected programming language.
        - The cell content should support rich text formatting for markdown cells, including headings, lists, links, and code blocks.
        - The cell content should automatically adjust its height to fit the content, ensuring a smooth editing experience.
        - The cell content should width should utilized the full available space, providing an optimal editing experience for the users as they write code.
        - The cell should display visual feedback for programming language on the left side in the form of colored bar.
        - The Cell should be greyed out or visually distinguished when it is marked to be skipped during execution.
    - Default-language dropdown menu
        - should only have the options of `Markdown` (%md), `SQL` (%sql) and `Python` (%python).
        - `%run` on the first line in a cell is NOT language-specific, It indicates that the cell executes another notebook. It MUST NOT be hidden
        - cells without a language marker should be treated as belonging to the default programming language, the dropdown menu should reflect this by showing the default language.
        - changing the file extension to either `.sql` or `.py` should update the default programming language accordingly and show the default-language dropdown-menu.
        - The extension of the file is for SQL and Python files the default programming language.
        - Switching between SQL to Python changes the extension of the file accordingly
            - cells that were in the previous default language should be given the databrick markers `%sql` for SQL and `%python` for Python.
            - Cells that had the databricks markers for the new default language before being converted to the new default language should have those markers removed.           

    - Cell(s) should be collapsible, by overarching markdown headers allowing users to expand or collapse the content within each cell as needed. This should be reflected in the notebook structure panel as well.
    - Cell(s) should support toggle button to expand or collapse the content within each cell.

#### Markdown Cell(s)

- markdown cell are marked by `%md`, and should be placed at the beginning of the cell content.
- The cell block should have a #d900ff purple border or background to visually distinguish it as a markdown cell.
- The markdown cell should support basic markdown features such as headings, lists, links, images, and code blocks.
- markdown cell should display its content using proper markdown formatting, if NOT actively being edited. If the cell is being edited, it should switch to an editable text area. the content should be updated in real-time as the user types.
- Markdown cell do NOT get a skip marker `%skip`.
- The syntax highlighting should work both with darkmode and lightmode.
- ensure when rendering markdown cells the parsing of tables is done correctly and they are displayed with proper formatting.

#### SQL Cell(s)

- SQL cell are marked by `%sql`, and should be placed at the beginning of the cell content.
- The cell block should have a #2600ff yellow border or background to visually distinguish it as a SQL cell.
- In the raw text file the `%skip` marker is the first command in the cell if the cell is to be skipped, this should NOT be displayed in the editor, the status is shown as checkbox in the cell toolbar.
- The SQL cell should support writing and executing SQL queries.
- SQL cell should provide syntax highlighting for Databrick-SQL (sparksql).
- The syntax highlighting should work both with darkmode and lightmode.

#### Python Cell(s)
- Python cell are marked by `%python`, and should be placed at the beginning of the cell content.
- The cell block should have a #00ff00 green border or background to visually distinguish it as a Python cell.
- The Python cell should support writing and executing Python code.
- Python cell should provide syntax highlighting for Python.
- Python cell should allow users to view the output of the code execution below the cell.
- Python cell should support basic Python features such as variables, functions, loops, and conditionals.
- Python cell should provide error messages and debugging information when code execution fails.
- The syntax highlighting should work both with darkmode and lightmode.
- ***Mermaid***
    - Should there be python cell which contains `%%mermaid` followed by a Mermaid diagram, it should be properly formatted and rendered within the cell.
    - double-clicking the diagram should allow editing the Mermaid code directly within the cell.

#### Other extentions

- Syntax highlighting should be supported based on the file type.
- the editor should automatically detect the file type and apply the appropriate syntax highlighting.
- The editor should display the file content in ONE window/cell and NOT other cells.
- There should be NOT option to add more cells.
- The syntax highlighting should work both with darkmode and lightmode.

#### Databricks special markers

- `%skip` - Marks the cell to be skipped during execution. This marker should be placed at the beginning of the cell content in the raw text file but should not be displayed in the editor. The skip status is shown as a checkbox in the cell toolbar.
- `%run` - Executes another notebook within the current notebook. This marker should be placed at the beginning directly followed by the (relative) path to the notebook file that should be run.
- `%run` should NEVER be used in the default-language cells.