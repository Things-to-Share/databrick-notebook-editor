---
name: "skill-3-notebook-describer"
description: "Describes a Databricks notebook, providing functional names and descriptions for the notebook itself, based on its content and purpose within Unity Catalog."
tools: [read, edit]
---


# Skill: Notebook Describer

***Behavior***: see [behavior](../../behavior.md)
***Audience***: see [audience](../../audience.md)

## Goal

The goal of this prompt is to produce a `## Documentation` section for the ***specified_notebook***-notebook, that provides a clear, function-focused description of the notebook. This description should give a compact overview of the notebook’s purpose, key features, and logical structure so that a new user can quickly understand what the notebook does and how it is organized.

## Context Setting

ONLY include information that is relevant to understanding the context and purpose of the notebook. The `## Documentation`-sec tion it self MUST be excluded! The sections under `## Initialization` and `## Code` should be included.

## Expected Notebook Structure

- `# <place-holder-for-fitting-name-for-the-notebook>`
    - `## Documentation`
        - `### AI Prompt utilized`
        - `### Introduction`
        - `### Hierarchical Structure of the Notebook`
        - `### Diagrams` <-- this is Optional
            - `#### Notebook Flow` <-- this is Optional
            - `#### Datamodel` <-- this is Optional
    
    - `## Initialization`
        - structure and setup is up to developer and SHOULD NOT be touched by the documentation process. However if this section header is missing, prompt developer to add it! and Stop the documentation process until it is added.
            - Developer should be asked to provide the cell number where the `## Initialization` section starts.

    - `## Code`
        - structure and setup is up to developer and SHOULD NOT be touched by the documentation process. However if this section header is missing, prompt developer to add it! and Stop the documentation process until it is added.
            - Developer should be asked to provide the cell number where the `## Code` section starts.

> **Cell count expectation:** `### AI Prompt utilized`, `### Introduction`, and `### Hierarchical Structure of the Notebook` together must result in exactly 3 markdown cells (one cell per section, header + text combined) — plus the optional `### Diagram` cells if triggered. Never split a section's header into its own cell.

## Constraints

- Output language must be English.
- Only notebook context from `## Initialization` and `## Code` may be used as source context; the generated `## Documentation` content itself must not be used as context input.
- Only documentation markdown (`%md`) cells may be created or updated; code cells must remain unchanged.
- Exception: spelling corrections in existing code comments are allowed.
- Exception for Mermaid support: when Mermaid is triggered under `### Diagram`, Python support cells are allowed to be created or updated to keep diagram rendering functional. Allowed titles are exactly: `install mermaid_magic extension`, `load mermaid_magic extension`, `render_mermaid`, `Structure of the Notebook`, and optional `Datamodel`.
- Ensure `## Documentation` exists directly after the notebook title; create it if missing.
- If `## Initialization` or `## Code` section headers are missing, stop and ask the developer to add the missing header and provide its start cell number before continuing, abort if NO input is provided after 10 minutes.
- `### AI Prompt utilized`, `### Introduction`, and `### Hierarchical Structure of the Notebook` must each be exactly one markdown cell containing both header and body text (exactly 3 cells in total for these sections).
- Do not split a documentation section into a header-only cell and a separate body cell.
- `### Diagram` is the only header allowed to be standalone (without body text) because it is followed by Python/Mermaid cells.
- Total documentation length must not exceed 1000 words.
- `### Introduction` must be concise and capped at 300 words (or 30% of total documentation).
- `### Hierarchical Structure of the Notebook` must be capped at 700 words (or 70% of total documentation) and must mention that Python and SQL are used.
- Mermaid diagram cells are optional and must only be added when their trigger conditions are met.
- When Mermaid is triggered, Mermaid support cells are mandatory and must be reconciled idempotently: create missing cells, update existing cells, and avoid duplicates.
- If a Structure diagram is added, use a flowchart that reflects the hierarchical-structure narrative, with logical grouping and no empty lines between Mermaid objects.
- If a Datamodel diagram is added, include only persisted schema tables/views and only PK/FK fields; use dotted lines for many-to-many bridge relationships.
- When diagrams are present, apply the prescribed classification color palette consistently so readability works in both light and dark mode.


## Instructions

- Treat `## Constraints` as the authoritative rule set for validation and formatting.
- Follow the notebook flow in this order: inspect source context, ensure required structure is present, then create or update documentation sections.
- Use `## Details per documentation section` as the content blueprint for each subsection.
- Keep edits limited to the minimum required to make documentation complete, consistent, and compliant.
- Preserve existing wording when it is already correct; rewrite only when clarity, completeness, or compliance requires it.

## Details per documentation section

- `### AI Prompt utilized` — 1 single `%md` cell containing the header and text together (do NOT put the header in its own cell separate from the text)
  - content instructions:

        ```markdown
        ### AI Prompt utilized

        The AI prompts below can be utilized for documentation purposes, (`ALWAYS read and validate the results yourself`). If used, utilize them in the below order.

        1. [see AI Prompt for updating `Function Description of Dataset`](https://dev.azure.com/nn-life-pension/LPDAP_Mall%20BDT/_wiki/wikis/Wiki%20BDT/2644/Functional-Description-of-Dataset)
        2. [see AI Prompt for updating `Functional Description of Schema`](https://dev.azure.com/nn-life-pension/LPDAP_Mall%20BDT/_wiki/wikis/Wiki%20BDT/2328/Functional-Description-of-Schema)
        3. [see AI Prompt for updating `Functional Description of Notebook`](https://dev.azure.com/nn-life-pension/LPDAP_Mall%20BDT/_wiki/wikis/Wiki%20BDT/2327/Functional-Description-of-Notebook)
        ```

- `### Introduction` — 1 single `%md` cell containing the header and text together (do NOT put the header in its own cell separate from the text)
  - content instructions:
    - provide a general overview for this notebook
    - max 300 words or max 30% of the total documentation, so that the total documentation is no more than 1000 words.
    - keep it to the point
    - no excessive fuss
    - example:

        ```markdown
        ### Introduction

        this text is gives a general overview of the notebook, its purpose, and its key components.
        ```

- `### Hierarchical Structure of the Notebook` — 1 single `%md` cell containing the header and text together (do NOT put the header in its own cell separate from the text)
  - content instructions:
    - provide the hierarchical structure of the notebook, with a focus on the logical flow of the notebook and its key components
    - max 700 words (70% of the total documentation, so that the total documentation is no more than 1000 words)
    - keep it to the point, no excessive fuss
    - indicate the utilized coding languages are Python and SQL
    - example:

        ```markdown
        ### Hierarchical Structure of the Notebook

        this text is gives a general overview of the notebook, its purpose, and its key components.

        ```

- `### Diagrams` ***Optional mermaid diagram:***
    - **Trigger for *Mermaid Diagram*** 
        - **Trigger for *Structure of the Notebook*** : If the notebook is complex and has more than *3 multiple logical blocks*, provide a mermaid flow diagram to illustrate the structure of the notebook.
        - **Trigger for *Datamodel*** : If more then 6 table/views are defined and the the relationsship between these table/view are captured in primary and foreign keys, provide a mermaid diagram to illustrate the datamodel.
        - The trigger are independent, meaning that the presence of one does not necessitate the presence of the other.
        - If neither trigger condition is met, the mermaid diagram section can be omitted.

    - Mermaid section should be marked with section header `### Diagram` and should be placed after the `### Hierarchical Structure of the Notebook` section.
    - The diagram should be self-contained and understandable without any additional context. Notes can be added if needed.
    - Logical grouping should have different colors for each group, and the color should be consistent for all nodes in that group, color coding should follow the table provided below.
        | ***Classification*** | ***Color*** | ***SQL Border (2 tints darker)*** | ***Python Border (4 tints darker)*** |
        |:---                       |:---        |:---       |:--- |
        | Initialization            | #858688  | #6a6b6d | #505052 |
        | Helper Functions          | #5b7fa6  | #496685 | #374c64 |
        | DDL Schema, Tables & Views| #3d7a3d  | #316231 | #254925 |
        | Inbound Dataset           | #fce302  | #cab602 | #978801 |
        | Processing Group 1        | #ffa726  | #cc861e | #996417 |
        | Processing Group 2        | #ff9800  | #cc7a00 | #995b00 |
        | Processing Group 3        | #f57c00  | #c46300 | #934a00 |
        | Processing Group 4        | #e65100  | #b84100 | #8a3100 |
        | Clean up                  | #cab8b8  | #a29393 | #796e6e |

        - when utilizing the colors they should work well in both light and dark mode.

  - If the mermaid is triggered, the structure of cells is as follows, if any of these cell are missing, they should be added:
        - Required behavior when triggered:
                - enforce this exact order directly under `### Diagram`: `install mermaid_magic extension` -> `load mermaid_magic extension` -> `render_mermaid` -> `Structure of the Notebook` -> optional `Datamodel`
                - keep exactly one cell per required title; if duplicates exist, keep one canonical cell and remove duplicates
                - `Structure of the Notebook` and optional `Datamodel` must call `render_mermaid(...)`; direct `get_ipython().run_cell_magic(...)` in those cells is not allowed
    - `### Diagram` (this is only a header, NO text needed)
        - cell
            - title : `install mermaid_magic extension`
            - language : python
            - content:
                ```python
                try:
                    %load_ext mermaid_magic
                    
                except ModuleNotFoundError:
                    print("mermaid_magic is not installed, installing it now")
                    try:
                        %pip install mermaid-magic
                        dbutils.library.restartPython()
                    except:
                        print("!!! failed to load mermaid !!!")
                ```

        - cell
            - title : `load mermaid_magic extension`:
            - language : python
            - content:

                ```python
                try:
                    %load_ext mermaid_magic
                except:
                    print("!!! failed to load mermaid !!!")
                ```
        - cell
            - title : `render_mermaid`
            - language : python
            - content:

                ```python
                def render_mermaid(diagram: str):
                    try:
                        get_ipython().run_cell_magic("mermaid", "", diagram)
                    except:
                        print("!!! failed to render mermaid diagram !!!")
                ```
        - cell 
            - if `Structure of the Notebook` is triggered
                - title : `Structure of the Notebook`
                - content : here the actual FlowDiagram mermaid is created
                    - It should reflect the `text` of the `### Hierarchical Structure of the Notebook`
                    - The steps in the diagram should be logically grouped together, and the diagram should be self-contained and understandable without any additional context. Notes can be added if needed.
                    - When generating the mermaid diagram DO NOT USE empty lines to separate objects in the diagram!
                    - Logical grouping of steps should be reflected in the diagram by grouping related nodes together.
                - example :

                    ```python
                    render_mermaid("""
                    flowchart TD
                        subgraph INIT["1. Initialisation"]
                            A[Run init_catalogs] --> B[Initialize psdl catalog]
                            B --> C[Configure Azure Storage]
                            C --> D[Load libraries]
                        end
                        subgraph HELPERS["2. Helper Functions"]
                            E1[get_list_column]
                            E2[restructure_file_to_invalid]
                            E3[camel_to_snake]
                        end
                        subgraph DDL["3. DDL Schema, Tables & Views"]
                            F1[Create schema<br>base_log_azl_log_bestanden] --> F2[Create external volume<br>rawdata]
                            F2 --> F3[Create tables:<br>log_file, podlogs,<br>validationlogs, batchlogs]
                        end
                        subgraph INBOUND["4. Inbound Dataset"]
                            G[List all files<br>in blob container]
                            G --> H[Filter: .csv/.json &<br>not in log_file]
                            H --> I{Files to<br>process?}
                            I -- Yes --> J[Read file<br>CSV or JSON]
                        end
                        subgraph PGROUP1["5. Processing Group 1<br>Detect File Type"]
                            J --> K{Determine file type<br>by column presence}
                            K -- LogMessage --> L[podlogs]
                            K -- body --> M[validationlogs]
                            K -- validationErrorMessage --> N[batchlogs]
                            K -- none match --> O[invalid]
                        end
                        subgraph PGROUP2["6. Processing Group 2<br>Enrich & Rename"]
                            L & M & N --> P[Add meta_file_key<br>& meta_rowhash]
                            P --> Q[Rename columns:<br>camelCase to snake_case]
                        end
                        subgraph PGROUP3["7. Processing Group 3<br>Write to Target"]
                            Q --> R{Write to<br>target table}
                        end
                        subgraph CLEANUP["8. Clean up"]
                            R -- Success --> S[Insert into log_file]
                            R -- Failure --> T[Mark as FAILED]
                            O --> S
                            T --> S
                        end
                        I -- No --> END[Done]
                        S --"Repeat until<br>all files are<br>processed"--> I
                        INIT --> HELPERS --> DDL --> INBOUND
                        style INIT fill:#858688,stroke:#505052,color:#FFFFFF
                        style HELPERS fill:#5b7fa6,stroke:#374c64,color:#FFFFFF
                        style DDL fill:#3d7a3d,stroke:#316231,color:#FFFFFF
                        style INBOUND fill:#fce302,stroke:#978801,color:#000000
                        style PGROUP1 fill:#ffa726,stroke:#996417,color:#000000
                        style PGROUP2 fill:#ff9800,stroke:#995b00,color:#000000
                        style PGROUP3 fill:#f57c00,stroke:#c46300,color:#000000
                        style CLEANUP fill:#cab8b8,stroke:#a29393,color:#000000
                    """)
                    ```
                    
        - cell
            - if `Datamodel` is triggered
                - title : `Datamodel`
                - content : Here the actual classDiagram mermaid is created
                    - The datamodel should describe only those tables and views that persist in the schema
                    - ONLY show the Primarykey(s) and Foreignkey(s) of a table
                    - Relationship to and from a table that serves as a many-to-many should be dotted lines
                    - crossing lines should be avoided; when planning, evaluate the diagram on this aspect and if needed shift the order and/or direction of the relationships
                    - logically grouped table/view should have the same color, size, and font
                - example :

                    ```python
                    render_mermaid("""
                    classDiagram

                        %% === DIMENSION TABLES ===
                        class dim_status:::dim {
                        bigint dim_status_key PK
                        }

                        class dim_domain:::dim {
                            bigint dim_domain_key PK
                        }

                        class dim_community:::dim {
                            bigint dim_community_key PK
                        }

                        class dim_community_hierarchy:::dim {
                            bigint dim_community_hierarchy_key PK
                        }

                        class dim_business_term:::dim {
                            bigint dim_business_term_key PK
                            bigint dim_status_key FK
                            bigint dim_domain_key FK
                        }

                        class dim_data_attribute:::dim {
                            bigint dim_data_attribute_key PK
                            bigint dim_status_key FK
                            bigint dim_domain_key FK
                        }

                        class dim_column:::dim {
                            bigint dim_column_key PK
                            bigint dim_status_key FK
                            bigint dim_domain_key FK
                        }

                        %% === FACT TABLES (center) ===
                        class fact_business_term:::fct {
                            date reporting_date PK
                            bigint dim_status_key PK, FK
                            bigint dim_domain_key PK, FK
                            bigint dim_business_term_key PK, FK
                        }

                        class fact_data_attribute:::fct {
                            date reporting_date PK
                            bigint dim_status_key PK, FK
                            bigint dim_domain_key PK, FK
                            bigint dim_data_attribute_key PK, FK
                        }

                        class fact_column:::fct {
                            date   reporting_date PK
                            bigint dim_status_key PK, FK
                            bigint dim_domain_key PK, FK
                            bigint dim_column_key PK, FK
                        }

                        %% === BRIDGE TABLES (outer ring) ===
                        class bridge_business_term_represents_data_attribute:::bdg {
                            bigint business_term_head_key PK, FK
                            bigint data_attribute_tail_key PK, FK
                        }
                        
                        class bridge_data_attribute_is_represented_by_business_term:::bdg {
                            bigint data_attribute_tail_key PK, FK
                            bigint business_term_head_key PK, FK
                        }
                        
                        class bridge_column_is_represented_by_data_attribute:::bdg {
                            bigint column_tail_key PK, FK
                            bigint data_attribute_head_key PK, FK
                        }
                        
                        class bridge_data_attribute_represents_column:::bdg {
                            bigint data_attribute_head_key PK, FK
                            bigint column_tail_key PK, FK
                        }
                        
                        dim_status "1" --> "0..n" fact_business_term
                        dim_status "1" --> "0..n" fact_data_attribute
                        dim_status "1" --> "0..n" fact_column
                        
                        dim_domain "1" --> "0..n" fact_business_term
                        dim_domain "1" --> "0..n" fact_data_attribute
                        dim_domain "1" --> "0..n" fact_column

                        
                        dim_community "1" --> "0..n" fact_business_term
                        dim_community "1" --> "0..n" fact_data_attribute
                        dim_community "1" --> "0..n" fact_column
                        
                        dim_community_hierarchy "1" --> "0..n" fact_data_attribute
                        dim_community_hierarchy "1" --> "0..n" fact_column
                        
                        fact_business_term  "0..n" <-- dim_business_term
                        
                        fact_business_term                                    ..|>       bridge_business_term_represents_data_attribute
                        bridge_business_term_represents_data_attribute "0..n" <-- "1"    dim_business_term
                        bridge_business_term_represents_data_attribute "0..n" <-- "1"    dim_data_attribute
                        fact_data_attribute                                   ..|>       bridge_business_term_represents_data_attribute
                        fact_data_attribute                            "0..n" <--        dim_data_attribute
                        dim_business_term                                 "1" --> "0..n" bridge_data_attribute_is_represented_by_business_term
                        dim_data_attribute                                "1" --> "0..n" bridge_data_attribute_is_represented_by_business_term
                        
                        fact_data_attribute                            ..|>       bridge_data_attribute_represents_column
                        bridge_data_attribute_represents_column "0..n" <-- "1"    dim_data_attribute
                        bridge_data_attribute_represents_column "0..n" <-- "1"    dim_column
                        fact_column                                    ..|>       bridge_data_attribute_represents_column
                        fact_column                             "0..n" <-- "1"    dim_column
                        dim_column                                 "1" --> "0..n" bridge_column_is_represented_by_data_attribute
                        dim_data_attribute                         "1" --> "0..n" bridge_column_is_represented_by_data_attribute
                        
                        %% === STYLING ===
                        classDef fct fill:#FFBF00,stroke:#333,stroke-width:1px
                        classDef dim fill:#FFEAA3,stroke:#333,stroke-width:1px
                        classDef bdg fill:#F0F0F0,stroke:#333,stroke-width:1px
                    """)
                    ```

- `## Initialization`
    - All coding cells should be left untouched, and only the documentation cells (markdown; %md) should be added or updated.
    - cells with code should not be modified, and the code should be left as is.
    - Exception: Spelling in in comments is allowed to be corrected.

- `## Code`
    - All coding cells should be left untouched, and only the documentation cells (markdown; %md) should be added or updated.
    - cells with code should not be modified, and the code should be left as is.
    - Exception: Spelling in in comments is allowed to be corrected.


## Review

- Ensure that all logical steps of the notebook are correctly documented and that the schema definitions and metadata are properly applied.
- Verify that the `Definition : <name-of-the-schema>` and `Metadata : <name-of-the-schema>` cells exist and are correctly formatted.
- Confirm that the schema name and metadata comments accurately reflect the functional purpose and description of the schema.
- If Mermaid is triggered, verify that all Mermaid initialization cells are present in the required order and that missing cells were added or outdated cells were updated.
- Verify `render_mermaid` exists exactly once and that `Structure of the Notebook` and optional `Datamodel` call `render_mermaid(...)`.

## Feedback

Should the limits `documentation`-section be reached, provide a concise summary and refer to additional documentation or context if necessary. Provide an analysis on the complexity for the transformations involved in deriving the data, highlighting any intricate logic or dependencies. Provide suggestions to spliting up de transformations involved into smaller notebooks for more manageable, clarity and maintainability.
