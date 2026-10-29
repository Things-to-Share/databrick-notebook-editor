---
name: "psdl-add-or-update-comment-volume"
description: Add or update the Unity Catalog comment for a specific volume, providing a functional name and description that summarizes the volume's purpose and content.
tools: [read, edit, search]
---
## Goal

To put functional descriptions in Unity Catalog, for a ***specific*** volume, briefly describing its purpose and content of the dataset within the volume.

## Audience

The intended audience for this functional description includes data engineers, data analysts, and other stakeholders who need to understand the purpose and content of the volume within Unity Catalog.

## Instructions

Apply Unity Catalog documentation for the specified volume by following the rules and guidelines outlined below.

- Analyse the Notebook and create formulate a functional name for the volume and a functional description. 
- The functional name should be a human-readable English label for the volume (e.g. "Employee", "Workgroup"). 
- The functional description should be a English explanation of what the volume contains and how it is derived; pseudo-code is allowed (e.g. MD5 hash van resource_id and meta_valid_from); also include how the volume is used in the overall data processing flow, and any default/fallback rows; NOTE the whole notebook is inscope for this description as context, not just the SQL query in this cell. 
- Keep the description to the point, 
- max 200 words, 
- no excessive fuss.
- After you have formulated the functional name and functional description, apply Unity Catalog documentation for `volume` of selected cell, by following the below [Rules](#rules).

## Rules

- Determine the technical volume name for the placeholder `<name-of-the-volume>`.
- If the title of the specified cell is not `Definition : <name-of-the-volume>` then 
    - copy the whole cell and give the new cell the title `Definition : <name-of-the-volume>`. 
    - At the end processing of the processing plan you can delete the original cell, so there is NO duplication of the cell content.
- The `Definition : <name-of-the-volume>` cell should contain the following content
    - If NOT, then copy the whole cell and give the new cell the title `Definition : <name-of-the-volume>`. At the end processing of the processing plan you can delete the original cell, so there is NO duplication of the cell content.

    ```python
    # Fetch storage account configuration for the specified environment #
    storage_account_for_volume = read_yaml_configuration(config_yaml_name="storage_accounts.yaml")['your-target-storage-account'][environment]
    df = spark.sql(f"create external volume if not exists rawdata LOCATION '{storage_account_for_volume}'")
    ```

- The cell directly after the `Definition : <name-of-the-volume>` cell should be the `Metadata : <name-of-the-volume>` cell. 
    - If NOT, then create a cell with the title `Metadata : <name-of-the-volume>`.
    - If there is one, this cell should be updated if needed.
    - The content of the `Metadata : <name-of-the-volume>` cell should be as follows:

        ```python
		spark.sql(f"""
			comment on volume <name-of-the-volume> is '<functional-name-of-the-volume> | <functional-desc-of-the-volume>'
		""")
        ```