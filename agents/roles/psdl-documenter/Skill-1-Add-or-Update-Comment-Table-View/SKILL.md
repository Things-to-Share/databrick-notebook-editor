---
name: "psdl-add-or-update-comment-table-view"
description: Adds or updates functional descriptions (comments) in Unity Catalog for a specific dataset (table or view) and all its columns. Analyzes the full notebook context to generate concise, human-readable English names and descriptions for the table/view and each column, then writes them into a structured Metadata cell using `set_comment_table_view` and `set_comment_columns` helper functions. Enforces naming conventions, cell title/structure rules, and description length limits (max 200 words for tables, max 100 words for columns).
tools: [read, edit, search]
---

## Goal

To put functional descriptions in Unity Catalog, for a ***specific***-dataset (Table/View) and its columns. Based on what is done in the notebook in ***specified***-notebook, in which the dataset is defined. By following a specific set of rules and guidelines.

## Audience

The intended audience for this functional description includes data engineers, data analysts, and other stakeholders who need to understand the purpose, structure, and key functionalities of the dataset within Unity Catalog.

## Rules

- Analyze the specified notebook in relation to the specified dataset (table/view) and its columns.
    - Utlized the whole notebook to gather context and information relevant to the dataset.
    - Take note of any relevant context, explanations, or comments provided in the specified cell and secondary the rest of the notebook that can help in understanding the dataset.
    - Connect to unity catalog to extract the existing comments for the sources of table/view use these as context as well.

- Determine `<name-of-the-table/view>` based on the specified cell.
  - The `<name-of-the-table/view>` is the name of the table/view being created in the specified cell.
- Determine the purpose of the dataset and formulate a clear and concise functional description for the table/view. 
- Determine a clear, to the point functional name of the dataset, based on the functional description of the table/view.
- Per column
    - Determine the purpose and formulate a clear and concise functional description for each column in the dataset.
    - Determine a clear, to the point functional name for each column, based on the functional description of the column.
- Repeat this process for all columns in the dataset.
    - The order of the columns in the functional description should match the order of the columns in the dataset.
- Ensure that the functional descriptions and names are consistent and accurately reflect the purpose of the table/view and its columns.
- DO NOT reference any temporary or intermediate tables/views other than those explicitly mentioned as primary sources, possible names of these temporary tables/views could be 'get_...', 'tmp_...', or similar.
- The functional description should be concise, clear, and focused on the key aspects of the dataset, avoiding unnecessary technical details.
- Limit the use of abbreviations and jargon to ensure clarity for the intended audience.
- The functional description and names should be written in English 
- The functional descriptions and names need to be understandable by the intended audience.
- The functional descriptions and names should accurately reflect the purpose of the table/view or column.
- Ensure that the functional descriptions and names align on the column level with the table/view level.
- Cell titles and structure:
  - Titles:
    - Cell with the title `Definition : <name-of-the-table/view>` ARE NOT allowed to be changed!
    - ONLY cell with the title `Metadata : <name-of-the-table/view>` should be added or updated.
    - The `Metadata : <name-of-the-table/view>` cell should follow directly after the `Definition : <name-of-the-table/view>` cell.
    - Check if the specified cell has the title is `Definition : <name-of-the-table/view>` 
        - if not, copy the whole cell and give the new cell the title `Definition : <name-of-the-table/view>`. At the end processing of the processing plan you can delete the original cell, so there is NO duplication of the cell content.
        - if the title is already `Definition : <name-of-the-table/view>`, no action is needed.
    - Check if the next cell has the title `Metadata : <name-of-the-table/view>`
        - if not, copy the whole cell and give the new cell the title `Metadata : <name-of-the-table/view>`. At the end processing of the processing plan you can delete the original cell, so there is NO duplication of the cell content.
        - if the title is already `Metadata : <name-of-the-table/view>`, no action is needed.
  - Structure:
    - If the `Metadata : <name-of-the-table/view>`-cell already exists and if there are python-functions like `constraint_exists` or `constraint_add` DO NOT CHANGE this code. The code should be moved to the end of the `Metadata : <name-of-the-table/view>`-cell.
    - Update the `Metadata : <name-of-the-table/view>`-cell with the following content:
        - use the code snippet below to add/update the comments for the table/view and all columns in the table/view.
      
        ```python
        # Table/View - Functional Description #
        set_comment_table_view (
            table_view_name     = "<functional-name-of-the-table/view>",
            table_view_comment  = "<functional-desc-of-the-table/view>"
        )

        # Column - Functional Names | Functional Description #
        set_comment_columns (
            table_view_name = "<functional-name-of-the-table/view>",
            column_comments = {
                "<column-name-1>" : "<functional-name-column-1> | <functional-desc-column-1>",
                "<column-name-2>" : "<functional-name-column-2> | <functional-desc-column-2>",
                "<column-name-n>" : "<functional-name-column-n> | <functional-desc-column-n>"
            }
        )
        ```

- follow the rules below:

  - Add/update the dataset comment for the table/view
    - Determine `<functional-name-of-the-table/view>` as a functional name for the table/view, this should be a human-readable English label for the table/view (e.g. "Employee", "Werkgroep")
    - Determine `<functional-desc-of-the-table/view>` as a functional description for the table/view, this should be a English explanation of what the table/view contains and how it is derived; pseudo-code is allowed (e.g. MD5 hash van resource_id en meta_valid_from); also include how the table/view is used in the overall data processing flow, and any default/fallback rows; NOTE the whole notebook is inscope for this description as context, not just the SQL query in this cell.
    - Keep the description to the point, max 200 words, no excessive fuss

  - Add/update the column comments for all columns in the table/view, thus for each column
    - Determine `<functional-name-column>` as a functional name for the column, this should be a human-readable English label for the column (e.g. "Surrogate Key Employee", "Name Workgroup")
    - Determine `<functional-desc-column>` as a functional description for the column, this should be a English explanation of what the column contains and how it is derived; pseudo-code is allowed (e.g. MD5 hash of resource_id and meta_valid_from), include for the context of the description determining, how the column is used in the overall data processing flow, and any default/fallback rows; NOTE the whole notebook is inscope for this description as context, not just the SQL query in this cell.
    - keep the description to the point, max 100 words, no excessive fuss
    - Avoid using the words "this column" in the description, instead use the column name in the description
    - Avoid using quotes, single or double, in the description, unless it is part of a code snippet or example, then use "`"-characters to encapsulate the code snippet or example