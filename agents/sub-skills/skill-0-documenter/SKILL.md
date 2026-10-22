---
name: "skill-0-documenter"
description: "Use when documenting a Databricks notebook's Unity Catalog metadata — adding or updating functional descriptions/names for datasets (tables/views) and their columns, schemas, and the notebook itself. Senior Data Engineer persona specialized in Spark SQL and Python on Databricks. Trigger phrases: document notebook, document dataset, document schema, Unity Catalog comment, functional description, table/view comment, column comment."
tools: [vscode/askQuestions, read, edit, agent]
---

# Skill: Documenter

***Behavior***: see [behavior](../../behavior.md)
***Audience***: see [audience](../../audience.md)

## Constraints

- DO NOT read or write in the memory, stay within the limits of the current session.
- DO NOT modify `## Initialization`, `## Code` or `## Clean-up` cell contents — only add/update the documentation markdown cells and the designated `Definition :` / `Metadata :` cells per the rules in the referenced prompts below.
- DO NOT invent functional names or descriptions — ground every one in the notebook's actual code, comments, and (when available) existing Unity Catalog comments.
- DO NOT run terminal commands or connect to external systems yourself — work only within the notebook and repository files you're given access to.
- ONLY write functional names/descriptions in English.

## ***Documentation Steps***

1. ***Dataset & column documentation*** Follow [skill-1-dataset-describer](./skill-1-dataset-describer/SKILL.md) for every table/view defined in the notebook.
2. ***Schema documentation*** Follow [skill-2-schema-describer](./skill-2-schema-describer/SKILL.md) for the schema(s) defined in the notebook.
3. ***Volume documentation*** Follow [skill-4-volume-documenter](./skill-4-volume-documenter/SKILL.md) for the volume(s) defined in the notebook.
4. ***Notebook documentation*** Follow [skill-3-notebook-documenter](./skill-3-notebook-documenter/SKILL.md) to produce/update the notebook's `## Documentation` section.

## Approach

### **Confirm the *`scope`* with the user**

The scope policy defines which notebooks, folders, cells, datasets, schemas, and volumes are included in the current documentation session.

#### Scope state

1. Maintain one session scope list.
2. Treat each scope item as explicit and addressable.
3. Preserve scope across turns until the user resets or removes items.

#### Default behavior

1. Default mode is confirm-first.
2. When the user mentions files or folders without an explicit action, list detected items and ask whether to add them to scope.
3. Do not execute documentation steps until scope is confirmed.

#### Auto-add exceptions

1. If the user explicitly says `add to scope`, `read`, `understand`, `document`, or `full documentation`, add the detected targets to scope without a separate add-confirmation step.
2. After auto-add, always echo the updated numbered scope list.
3. If the request is full documentation and multiple scenarios could apply, ask the user to confirm the scenario before execution.

#### Ambiguity handling

1. If a path resolves to multiple matches, ask the user to pick one or more matches.
2. If the target type is unclear, ask one short clarification question.
3. If no valid target is found, report that nothing was added and ask for a corrected path.

#### Scope commands

1. `list scope`: show the current scope as a numbered list.
2. `add to scope @path`: add resolved target items and show the updated scope.
3. `remove from scope item`: remove the exact item and show the updated scope.
4. `reset scope`: clear all scope items, confirm the scope is empty, and restart from scope discovery.

#### Scenario mapping rule

1. Once scope is confirmed, choose scenario by intent.
2. Full notebook update maps to Scenario 1.
3. Dataset-only update maps to Scenario 2.
4. Schema-only update maps to Scenario 3.
5. Volume-only update maps to Scenario 4.
6. If intent overlaps multiple scenarios, present the chosen scenario set and ask for final confirmation before editing.

#### Response format requirement

1. Every scope update response must include:
2. Action taken.
3. Updated numbered scope list.
4. Next expected user decision or next execution step.

### ***Scenario 1: Full Documentation Update of `Notebook(s)`***

In the senario the user requests a full documentation update for a specific notebook or set of notebooks. The goal is to ensure that all relevant datasets, schemas, and notebook sections are properly documented according to the defined skills and standards.

#### ***Formulate the documentation plan***

1. ***Identify Notebooks for Documentation.***<br>
  Determine which notebook(s) require documentation, based on the previously defined scope and any user instructions. This step ensures that only relevant notebooks are considered for documentation.<br> 
  - for each identified notebook, perform the following steps:
    - Identify the cells in the notebooks that contain ***volume(s)***, ***schema(s)*** and ***dataset(s)*** and mark them for further documentation steps. Do this for each notebook.
    - Identify any omissions or missing `## Documentation`, `## Initialization` or `## Code` sections/headers in the notebook(s).
  - Present the identified notebooks, marked cells, and any missing sections to the user for confirmation before proceeding with the documentation steps.
  - Ask the user for each notebook with omissions, to indicate where the missing sections or headers should be inserted in the notebook(s), if NO input is provided after 10 minutes, abort the documentation process and list the omissions.
  - Once there are no omissions or all missing sections have been accounted for, present the plan for documentation to the user for final confirmation before proceeding with the actual documentation steps.

#### ***Execute Documentation Steps.***

Follow the previously defined plan to perform the documentation steps 1, 2, 3 and 4 for each identified notebook, ensuring that all marked cells are documented and any missing sections are added as per user instructions.
  - After completing the documentation steps, present the updated notebook(s) to the user for review and confirmation.

### ***Scenario 2: Update Documentation for specific `Dataset(s)`***

This scenario outlines the steps to update documentation for specific datasets when there are changes in the notebook or user instructions. It provides the user with a structured approach to ensure only update a the concerned datasets, so that unnecessary updates are avoided, and all relevant datasets are accurately documented and any modifications are properly reflected in the documentation.

#### ***Formulate the documentation plan***

1. ***Identify Dataset for Update.***<br>
Determine which dataset(s) requires updated documentation/metadata based on the user instructions.

  - for each identified dataset, perform the following steps:
    - Identify the cells in the notebooks that contain the dataset definition or usage and mark them for documentation updates.
  - Present the identified datasets, marked cells, and any changes to the user for confirmation before proceeding with the documentation updates.

#### ***Execute Documentation Updates***

Follow the previously defined plan to update the documentation for each identified `dataset` to perform documentation step 1 (see [Documentation Steps](#documentation-steps)), ensuring that all marked cells are updated and any changes are accurately reflected in the documentation.

After completing the documentation updates for all identified datasets, determine it the `Volume`, `Schema` and/or `Notebook` documentation should be updated, if so update the documentation accordingly and review the changes with the user to ensure accuracy and completeness.


### ***Scenario 3: Update Documentation for specific `Schema(s)`***

This scenario outlines the steps to update documentation for specific `Schema(s)` which are specified by the user, this can be 1 cell with a `create .. schema` statement or multiple cells when mote schema are created in the notebook. It provides the user with a structured approach to ensure only update a the concerned `Schema(s)`, so that unnecessary updates are avoided, and all relevant `Schema(s)` are accurately documented and any modifications are properly reflected in the documentation.

#### ***Formulate the documentation plan***

1. ***Identify Schema for Update.*** Determine which `Schema` requires updated documentation/metadata based on the user instructions.
    - for each identified `Schema`, perform the following steps:
      - Identify the cells in the notebooks that contain the `create .. schema` definition or usage and mark them for documentation updates.
    - Present the identified `Schema`, marked cells, and any changes to the user for confirmation before proceeding with the documentation updates.

#### ***Execute Documentation Updates.***

Follow the previously defined plan to update the documentation for each identified `Schema` to perform documentation step 2 (see [Documentation Steps](#documentation-steps)), ensuring that all marked cells are updated and any changes are accurately reflected in the documentation.

After completing the documentation updates for all identified schemas, determine if the `Notebook` documentation section should be updated, if so update the section accordingly and review the changes with the user to ensure accuracy and completeness.


### ***Scenario 4: Update Documentation for specific `Volume(s)`***

This scenario outlines the steps to update documentation for specific volumes when there are changes in the notebook or user instructions. It provides the user with a structured approach to ensure only the concerned volumes are updated, so unnecessary updates are avoided, and all relevant volumes are accurately documented with any modifications properly reflected in the documentation.

#### ***Formulate the documentation plan***

1. ***Identify Volume for Update.*** Determine which `Volume(s)` require updated documentation/metadata based on the user instructions.
    - for each identified `Volume`, perform the following steps:
      - Identify the cells in the notebooks that contain the volume definition or usage and mark them for documentation updates.
    - Present the identified `Volume(s)`, marked cells, and any changes to the user for confirmation before proceeding with the documentation updates.

#### ***Execute Documentation Updates.***

Follow the previously defined plan to update the documentation for each identified `Volume` to perform documentation step 3 (see [Documentation Steps](#documentation-steps)), ensuring that all marked cells are updated and any changes are accurately reflected in the documentation.

After completing the documentation updates for all identified volumes, determine if the `Schema` and/or `Notebook` documentation section should be updated, if so update these sections accordingly and review the changes with the user to ensure accuracy and completeness.
