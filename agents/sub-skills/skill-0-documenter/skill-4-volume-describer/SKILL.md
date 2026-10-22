---
name: "skill-4-volume-describer"
description: "Describes the Unity Catalog volume used in a notebook, providing a functional name and description based on how the volume is created and used in the notebook flow."
tools: [read, edit]
---

# Skill: Volume Describer

***Behavior***: see [behavior](../../behavior.md)
***Audience***: see [audience](../../audience.md)

## Goal

To put a functional name and description in Unity Catalog for a volume utilized in a ***specific***-notebook, briefly describing its purpose and usage based on related datasets, storage usage, and how the volume is used within the notebook.

## Instructions

- Analyse the notebook and formulate a functional name and a functional description for the volume.
- The functional name should be a human-readable English label for the volume (e.g. "Raw Data Volume", "Export Files Volume").
- The functional description should be an English explanation of what the volume stores, where it points (if external), and how it is used in the overall data processing flow; include relevant context from the whole notebook, not only the selected cell.
- Keep the description to the point,
- max 300 words,
- no excessive fuss.
- After you have formulated the functional name and functional description, apply Unity Catalog documentation for `volume` of the selected cell, by following the below [Rules](#rules).

## Rules

- Determine the technical volume name for the placeholder `<name-of-the-volume>`.
- If the title of the specified cell is not `Definition : <name-of-the-volume>` then
	- copy the whole cell and give the new cell the title `Definition : <name-of-the-volume>`.
	- At the end processing of the processing plan you can delete the original cell, so there is NO duplication of the cell content.
- The `Definition : <name-of-the-volume>` cell should contain volume creation logic.
	- If the existing implementation creates an external volume, keep the external location logic intact.
	- If NOT, then copy the whole cell and give the new cell the title `Definition : <name-of-the-volume>`. At the end processing of the processing plan you can delete the original cell, so there is NO duplication of the cell content.

- The cell directly after the `Definition : <name-of-the-volume>` cell should be the `Metadata : <name-of-the-volume>` cell.
	- If NOT, then create a cell with the title `Metadata : <name-of-the-volume>`.
	- If there is one, this cell should be updated if needed.
	- The content of the `Metadata : <name-of-the-volume>` cell should be as follows:

		```python
		spark.sql(f"""
			comment on volume <name-of-the-volume> is '<functional-name-of-the-volume> | <functional-desc-of-the-volume>'
		""")
		```
