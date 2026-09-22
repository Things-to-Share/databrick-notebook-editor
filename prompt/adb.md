Read this document carefully before starting the implementation, it contains the goal and requirements for the local Databricks Notebook Editor. Formulate a build plan and your approach based on the information provided. then execute the execute the plan with your approach accordingly.

# Local Databricks Notebook Editor

## Goal

I need a html page to add and edit Databricks Notebooks locally.

## Requirements

### Files to generate or update

- for HTML `adb.html`
- for JavaScript code `adb.js`
- for CSS `adb.css`
- for configuration or utility files `adb.config.js` to keep track of user settings

### Features

- The editor should be able to handle different file types commonly used in Databricks Notebooks, including SQL, Python, Markdown, and YAML.
- The editor should provide support for syntax highlighing based on the file type, including SQL, Python, Markdown, and YAML as main languages, but also css, html, js, json, xml and PowerShell, but not limited to these.
- File types for SQL and Python, should be parsed and displayed in separate cells within the notebook editing panel, utilizing the Databricks notebook format, see more requirement under [Notebook Editing Panel](#notebook-editing-panel).
- Other file types should be displayed in a single cell within the notebook editing panel.
- The editor is split in 3 sections.
- The three sections are:
    1. Navigation panel for browsing the repository-folder(s).
    2. Notebook editing panel.
    3. If Databricks notebook this panel should display the notebook structure based on the Markdown headers, allowing users to quickly navigate between different sections of the notebook.

- The application should provide a switch button to toggle between dark and light themes.
- All text-input elements should support dark and light themes.
- All clickable elements should support dark and light themes.
- The navigation panel should be resizable, allowing users to adjust its width according to their preference, and easily collapse or expand it as needed with a toggle button.
- The notebook editing panel should also be resizable, allowing users to adjust its width according to their preference.
- The state of each folder, file, and cell, section should be preserved as users navigate through the notebook and workspace.
- File and folder changes should be immediately saved, ensuring that the workspace remains consistent and up-to-date.
- Auto-save feature: 
    - a checkbox in the header section of application can turn on or off the auto-save feature.
    - When auto-save is turned off, changes to files and folders should only be saved when the user explicitly triggers a save action.
    - The auto-save feature should provide visual feedback indicating whether it is currently enabled or disabled.

### Navigation Panel

- The Navigation panel serves as workspace for browsing and managing the repository structure.
- User must be able to manage the workspace by adding, removing, and renaming files and folders.
- User must be able to bind and unbind folders to specific locations on the computer to the workspace.
- User must be able to create new files and folders within the workspace.
    - Available options should be (folder, file with extentions sql (SQL), py (Python), md (Markdown), yml (YAML))
    - The user should be able to specify the name and type of the new file or folder when creating it.
- Allow users to browse the repository structure, including folders and files
- To open a file in the notebook editing panel, the user should double click on the file.
- The navigation panel should provide visual cues for the type of each item (folder or file) and its status (e.g., bound or unbound).
    - Folder should have a closed icon when collapsed and an open icon when expanded.
    - File should have an icon representing its type (e.g., SQL, Python, Markdown, YAML).
    - other file extensions should have appropriate icons representing their types.
    - Files that are opened in the editor should have a distinct visual indicator, such as a highlighted icon or different text color.
- the cell content should be scrollable with a vertical scrollbar when the content exceeds the visible area.

### Notebook Editing Panel

- The files openend should appear als separated tabs that can be pinned and moved around on the tabs-bar.
- If there are multiple files open, users should be able to switch between them by clicking on the corresponding tabs.
- if the number of tabs exceeds the available width of the tabs-bar, a scrolling mechanism should be provided to access all open tabs.
- File name should be editable by double-clicking on the tab, this then changes the tab to an input field where the user can modify the name, this DOES NOT effect the extention of the file.
- file extension is displayed on the tab of the file and as a dropdown-menu after the file name.
- Files with other extensions will display their name + extension in the tab.
- Default-language dropdown menu
    - should only have the options of `Markdown` (%md), `SQL` (%sql) and `Python` (%python).
    - `%run` al a first line in a cell is NOT language-specific, It indicates that the cell executes another notebook. It MUST NOT be hidden
    - Changing the file name and adding a extension other then `.sql` or `.py` will must result the default-language dropdown-menu begin hidden and showing the filename+extension instead.
    - cells without a language marker should be treated as belonging to the default programming language, the dropdown menu should reflect this by showing the default language.
    - changing the file extension to either `.sql` or `.py` should update the default programming language accordingly and show the default-language dropdown-menu.
    - The extension of the file is for SQL and Python files the default programming language.
    - Switching between SQL to Python changes the extension of the file accordingly
        - cells that were in the previous default language should be given the databrick markers `%sql` for SQL `%python` for Python.
        - Cells that had the databricks markers for the new default language before being converted to the new default language should have those markers removed.
- Databricks Notebook support cell titles
    - The databricks cell tool bar should provide the number and title of the cell.
    - The databricks cell title should be displayed and editable directly within the cell toolbar. 
    - When add or changing the cell title, this should be stored without any escaping or formatting applied, and should be immediately reflected in the cell toolbar. The encapsulation by double qoutes should NOT be included in the stored title or displayed in the cell toolbar.
    - Examples
        - WRONG: -- DBTITLE 1,"double \"qoutes\" and a single 'qout'"
        - CORRECT: -- DBTITLE 1,double "qoutes" and a single 'qout'

- The databricks skip marker `%skip` should be handled with a checkbox in the left corner of the cell toolbar.
- Skipped cell should be visually be greyed out.
- Cell(s) should be collapsible, by overarching markdown headers allowing users to expand or collapse the content within each cell as needed. This should be reflected in the notebook structure panel as well.
- Cell(s) should support toggle button to expand or collapse the content within each cell.

#### Markdown Cell(s)

- markdown cell are marked by `%md`, and should be placed at the beginning of the cell content.
- The cell block should have a #d900ff purple border or background to visually distinguish it as a markdown cell.
- The markdown cell should support basic markdown features such as headings, lists, links, images, and code blocks.
- markdown cell should display its content using proper markdown formatting, if NOT actively being edited. If the cell is being edited, it should switch to an editable text area. the content should be updated in real-time as the user types.
- Markdown cell do NOT get a skip marker `%skip`.
- The syntax highlighting should work both with darkmode and lightmode.

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

### Notebook Navigation

- If the file is a Databricks Notebook, the editor should display on the right side a panel for the notebook stucture.
- The notebook structure panel should allow users to quickly navigate between different cells in the notebook.
- The stucture that is displayed is based on the markdown headers within the notebook and cell titles.
- If a cell does not have a title, it should be displayed with a default placeholder of `cell <number>`.
- Sections should be collapsible in the notebook structure panel, the state of each section (expanded or collapsed) should be preserved as users navigate through the notebook. 
- The state of each section in the notebook structure panel should reflect the state in the editor panel accurately.