---
name: "psdl-add-or-update-comment-schema"
description: Add or update the Unity Catalog comment for a specific schema, providing a functional name and description that summarizes the schema's purpose and content.
tools: [read, edit, search]
---
## Goal

To put functional descriptions in Unity Catalog, for a ***specific*** schema, briefly describing its purpose and content of the dataset within the schema.

## Audience

The intended audience for this functional description includes data engineers, data analysts, and other stakeholders who need to understand the purpose and content of the schema within Unity Catalog.

## Instructions

Apply Unity Catalog documentation for the specified schema by following the rules and guidelines outlined below.

- Analyse the Notebook and create formulate a functional name for the schema and a functional description. 
- The functional name should be a human-readable English label for the schema (e.g. "Employee", "Workgroup"). 
- The functional description should be a English explanation of what the schema contains and how it is derived; pseudo-code is allowed (e.g. MD5 hash van resource_id and meta_valid_from); also include how the schema is used in the overall data processing flow, and any default/fallback rows; NOTE the whole notebook is inscope for this description as context, not just the SQL query in this cell. 
- Keep the description to the point, 
- max 200 words, 
- no excessive fuss.
- After you have formulated the functional name and functional description, apply Unity Catalog documentation for `schema` of selected cell, by following the below [Rules](#rules).

## Rules

- Determine the technical schema name for the placeholder `<name-of-the-schema>`.
- If the title of the specified cell is not `Definition : <name-of-the-schema>` then 
    - copy the whole cell and give the new cell the title `Definition : <name-of-the-schema>`. 
    - At the end processing of the processing plan you can delete the original cell, so there is NO duplication of the cell content.
- The `Definition : <name-of-the-schema>` cell should contain the following content
    - If NOT, then copy the whole cell and give the new cell the title `Definition : <name-of-the-schema>`. At the end processing of the processing plan you can delete the original cell, so there is NO duplication of the cell content.

    ```python
    # Schema of this Notebook #
    schema_name = "<name-of-the-schema>"
    
    # get storage account name to create the data store in the correct account #
    storage_account_configuration = read_yaml_configuration(config_yaml_name="storage_accounts.yaml")
    storage_account = storage_account_configuration['psdl'][environment]

    # create the schema in unity catalog and storage account #
    df = spark.sql(f"create schema if not exists {schema_name} managed location '{storage_account}/adb_{schema_name}'")

    # set default schema for the current session to the newly created schema #
    df = spark.sql(f"use schema {schema_name}")
    ```

- The cell directly after the `Definition : <name-of-the-schema>` cell should be the `Metadata : <name-of-the-schema>` cell. 
    - If NOT, then create a cell with the title `Metadata : <name-of-the-schema>`.
    - If there is one, this cell should be updated if needed.
    - The content of the `Metadata : <name-of-the-schema>` cell should be as follows:

        ```python
        set_comment_schema (
            schema_comment  = "<functional-name-of-the-schema> | <functional-desc-of-the-schema>"
        )
        ```