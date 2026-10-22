---
name: "skill-1-dataset-describer"
description: "Use when documenting a specific dataset (table/view) and its columns in Unity Catalog based on the specified notebook. Senior Data Engineer persona specialized in Spark SQL and Python on Databricks. Trigger phrases: document dataset, document table, document view, column comment, functional description."
tools: [read, edit]
---

# Skill: Dataset Describer

***Behavior***: see [behavior](../../behavior.md)
***Audience***: see [audience](../../audience.md)

## Goal

To put functional names and descriptions in Unity Catalog, for a ***specific***-dataset (Table/View) and its columns. Based on what is done in the ***specified***-notebook, in which the dataset is defined. By following a specific set of rules and guidelines.

## Constraints

- DO NOT invent functional names or descriptions — ground every one in the notebook's actual code, comments, and (when available) existing Unity Catalog comments.
- DO NOT modify the dataset or its columns — only document them.
- DO NOT reference any temporary or intermediate tables/views other than those explicitly mentioned as primary sources.
- ONLY write functional names/descriptions in English.
- DO NOT connect to external systems yourself — work only within the scope of the current session.

## Rules

- Analyze the specified notebook in relation to the specified dataset (table/view) and its columns.
    - Utlized the whole notebook to gather context and information relevant to the dataset.
    - Any other Notebooks or files are of secondary importance and should only be referenced if they provide additional context relevant to the specified dataset.
    - Pay attention to any relevant context, explanations, or comments provided in the specified cell and throughout the rest of the notebook that can help in understanding the dataset.
    - Connect to unity catalog to extract the existing comments for the sources of table/view use these as context as well. Use the value stored in Spark.SQL variable like `${psdl.cataloge_name_env}` to determine the appropriate catalog and environment context.

- Determine `<name-of-the-table/view>` based on the identified cell for the `Dataset`.
    - The `<name-of-the-table/view>` is the name of the table/view being created in the specified cell.
- Determine the purpose of the dataset and formulate a clear and concise functional description for the table/view. 
- Determine a clear, to the point functional name of the dataset, based on the functional description of the table/view.

- Per column
    - Determine the purpose and formulate a clear and concise functional description for each column in the dataset.
    - Determine a clear, to the point functional name for each column, based on the functional description of the column.
    - Repeat this process for all columns in the dataset, the order of the columns in the functional description should match the order of the columns in the dataset.

- Ensure that the functional descriptions and names are consistent and accurately reflect the purpose of the table/view and its columns.
- DO NOT reference any temporary or intermediate tables/views other than those explicitly mentioned as primary sources, possible names of these temporary tables/views could be 'get_...', 'tmp_...', or similar.
- The functional description should be concise, clear, and focused on the key aspects of the dataset, avoiding unnecessary technical details.
- Limit the use of abbreviations and jargon to ensure clarity for the intended audience.
- The functional descriptions and names should be written in English 
- The functional descriptions and names need to be understandable by the intended audience.
- The functional descriptions and names should accurately reflect the purpose of the table/view or column.
- Ensure that the functional descriptions and names align on the column level with the table/view level.

- Cell titles and structure:
    - Titles:
        - Cell with the title `Definition : <name-of-the-table/view>` ARE NOT allowed to be changed!
        - ONLY cell with the title `Metadata : <name-of-the-table/view>` should be added or updated.
        - The `Metadata : <name-of-the-table/view>` cell should follow directly after the `Definition : <name-of-the-table/view>` cell.
        - Check if the specified cell has the title is `Definition : <name-of-the-table/view>` 
            - if not, copy the entire cell and assign the new cell the title `Definition : <name-of-the-table/view>`. At the end of the processing plan, add a task to delete the original cell to avoid duplicating cell content.
            - if the title is already `Definition : <name-of-the-table/view>`, no action is needed.
        - Check if the next cell has the title `Metadata : <name-of-the-table/view>`
            - if not, copy the entire cell and assign the new cell the title `Metadata : <name-of-the-table/view>`. At the end of the processing plan, add a task to delete the original cell to avoid duplicating cell content.
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


    - Add/update the dataset comment for the table/view
        - Determine `<functional-name-of-the-table/view>` as a functional name for the table/view, this should be a human-readable English label for the table/view (e.g. "Employee", "Workgroup")
        - Determine `<functional-desc-of-the-table/view>` as a functional description for the table/view, this should be a English explanation of what the table/view contains and how it is derived; pseudo-code is allowed (e.g. MD5 hash van resource_id en meta_valid_from); also include how the table/view is used in the overall data processing flow, and any default/fallback rows; NOTE the whole notebook is inscope for this description as context, not just the SQL query in this cell.
        - Keep the description to the point, max 200 words, no excessive fuss

    - Add/update the column comments for all columns in the table/view, thus for each column
        - Determine `<functional-name-column>` as a functional name for the column, this should be a human-readable English label for the column (e.g. "Surrogate Key Employee", "Name Workgroup")
        - Determine `<functional-desc-column>` as a functional description for the column, this should be a English explanation of what the column contains and how it is derived; pseudo-code is allowed (e.g. MD5 hash of resource_id and meta_valid_from), include for the context of the description determining, how the column is used in the overall data processing flow, and any default/fallback rows; NOTE the whole notebook is inscope for this description as context, not just the SQL query in this cell.
        - keep the description to the point, max 100 words, no excessive fuss
        - Avoid using the words "this column" in the description, instead use the column name in the description
        - Avoid using quotes, single or double, in the description, unless it is part of a code snippet or example, then use "`"-characters to encapsulate the code snippet or example

## Review

- Ensure that all tables/views have functional names and descriptions.
- Ensure that all columns have functional names and descriptions.
- Verify that descriptions are concise and within the word limits (200 words for tables/views, 100 words for columns).
- Check that descriptions are human-readable and provide context for how the data is used and derived.
- Confirm that no quotes are used unnecessarily and that code snippets are properly encapsulated with "`" characters.

## Feedback

Should the limits for the functional descriptions be be reached, provide a concise summary and refer to additional documentation or context if necessary. Provide an analysis on the complexity for the transformations involved in deriving the data, highlighting any intricate logic or dependencies. Provide suggestions to spliting up de transformations involved into smaller, more manageable steps for clarity and maintainability.
