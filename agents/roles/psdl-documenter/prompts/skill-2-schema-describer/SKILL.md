---
name: "skill-2-schema-describer"
description: "Describes the schema within Unity Catalog, providing functional names and descriptions for the schema, based on the content and purpose of the dataset utilized in the notebook within."
tools: [read, edit]
---

# Skill: Schema Describer 

***Behavior***: see [behavior](../behavior.md)
***Audience***: see [audience](../audience.md)

## Goal

To put functional name and descriptions in Unity Catalog, for a schema utilized in ***specific***-notebook, briefly describing its purpose and content of the schema, based on the related datasets, volumes, and their usage within the notebook.

## Instructions

- Analyse the Notebook and formulate a functional name for the schema and a functional description. 
- The functional name should be a human-readable English label for the schema (e.g. "Employee", "Workgroup"). 
- The functional description should be a English explanation of what the schema contains and how it is derived; pseudo-code is allowed (e.g. MD5 hash van resource_id and meta_valid_from); also include how the schema is used in the overall data processing flow, and any default/fallback rows; NOTE the whole notebook is inscope for this description as context, not just the SQL query in this cell. 
- Keep the description to the point, 
- max 300 words, 
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