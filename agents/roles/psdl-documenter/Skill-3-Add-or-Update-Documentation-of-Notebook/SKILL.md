---
name: "psdl-add-or-update-documentation-notebook"
description: Add or update the documentation section of a Databricks notebook with a structured functional description, including an introduction, hierarchical structure overview, and optional mermaid diagrams, targeted at junior-to-medior data engineers.
---
## Goal

The goal of this prompt is to provide a documentation section that includes a detailedfunctional description of a ***specified_notebook*** notebook. The functional description is intended to give a compact overview of the notebook's purpose and functionality, with emphasis on its key features and logical structure, so that if a new user is assigned to the notebook, they can quickly understand its purpose and functionality.

## Audience

The audience for this documentation is primarily other data engineers with the experience level between junior and medior, with experience in T-SQL and SAP Hana SQL. Less experienced in Python, basic level of understanding of Databricks and Spark. The documentation should be written in a way that is accessible to this audience, with clear explanations of the notebook's purpose and functionality.

## Context Setting

ONLY include information that is relevant to understanding the context and purpose of the notebook. The `## Documentation`-sec tion it self MUST be excluded! The sections under `## Initialization` and `## Code` should be included.

## Expected Notebook Structure

- `# <place-holder-for-fitting-name-for-the-notebook>`
    - `## Documentation`
        - `### AI Prompt utilized`
        - `### Introduction`
        - `### Hierarchical Structure of the Notebook`
        - `### Dependencies`
        - `### Diagrams` <-- this is Optional
            - `#### Notebook Flow` <-- this is Optional
            - `#### Datamodel` <-- this is Optional
            - `#### Job Flow` <-- this is Optional
    
    - `## Initialization`
        - structure and setup is up to developer and SHOULD NOT be touched by the documentation process. However if this section header is missing, prompt developer to add it! and Stop the documentation process until it is added.
            - Developer should be asked to provide the cell number where the `## Initialization` section starts.

    - `## Code`
        - structure and setup is up to developer and SHOULD NOT be touched by the documentation process. However if this section header is missing, prompt developer to add it! and Stop the documentation process until it is added.
            - Developer should be asked to provide the cell number where the `## Code` section starts.

> **Cell count expectation:** `### AI Prompt utilized`, `### Introduction`, and `### Hierarchical Structure of the Notebook` together must result in exactly 3 markdown cells (one cell per section, header + text combined) — plus the optional `### Diagram` cells if triggered. Never split a section's header into its own cell.

## Instructions

### Documentation Overarching Guidelines

- Documentation must be in English-language
- All the documentation sections should always be created or updated if needed
- and should be written in a clear and concise manner
- avoiding excessive technical jargon or unnecessary complexity.
- Totally, the documentation should be no more than 1000 words, and should focus on the key features and functionality of the notebook.
- All Initialization and coding cells should be left untouched, and only the documentation cells (markdown; %md) should be added or updated.
- Cells that are markdown (i.e., `%md`) DO NOT get a title!
- Expected cell structure for this documentation section of the notebook: 
- First, ensure that the `## Documentation` section exists in the notebook. this must directly after the notebook title markdown header. If it does not, create it before proceeding with the documentation process.
- Every section should have a ***header*** + text, sub-sections get their OWN cell. EXCEPTIONs are the `## Documentation`, `## Initialization`and `## Code` sections, these are part of the overall notebook structure.
- The ***header*** and its accompanying text MUST be placed together in the SAME markdown (`%md`) cell — do NOT split a section into a header-only cell followed by a separate `# COMMAND ----------` cell that contains only the body text. The only header that is allowed to stand alone without text in its own cell is `### Diagram` (see below), since it is immediately followed by python/mermaid code cells rather than body text.

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

- `### Dependencies` — 1 single `%md` cell containing the header and text together
  - Discovery (read-only, NEVER modify yaml files, NEVER run bundle CLI commands):
    1. Determine the bundle root: walk up from the folder of the notebook until a folder containing `databricks.yml` is found (the `src`- and `resources`-folder are at the same level as `databricks.yml`).
    2. Read `databricks.yml`; use its `include:` paths (e.g. `resources/*.yml`) to determine which resource files to read. If `include:` is absent, read all `*.yml` files in the `resources`-folder.
    3. In every resource file, search `resources.jobs.*.tasks` (including nested `for_each_task.task`) for a `notebook_task.notebook_path` that resolves to the documented notebook. Resolve paths relative to the folder of the yaml file and ignore the file extension (`.py`, `.sql`, `.ipynb`).
    4. Resolve `${var.<name>}` using the `variables:` section (and the default target in `databricks.yml`); if it is a `lookup`, show the lookup name (e.g. cluster `psdl-small-18-lts`).
  - Content to document per job that references the notebook:
    - Job name, schedule (`quartz_cron_expression` + `timezone_id`) in plain English, and the task key of the notebook.
    - Upstream dependencies: the tasks in `depends_on` and the notebooks they run, recursively up to the first task.
    - Downstream dependencies: tasks that list this task in their `depends_on`.
    - Parameters: map `base_parameters` to the notebook widgets (e.g. `table_local`), and explain dynamic values: `{{input.<x>}}` comes from `for_each_task.inputs`, `{{tasks.<task>.values.<key>}}` is a task value set by an upstream notebook (name that notebook and, if found in its code, the `dbutils.jobs.taskValues.set` call).
    - Execution: `for_each_task` concurrency, compute (`existing_cluster_id` / job cluster / serverless), queueing.
  - Present the dependencies as a markdown table: | Job | Task | Upstream | Downstream | Parameters |
  - If no job references the notebook, state that the notebook is not orchestrated by the bundle and is run manually or as a helper.
  - max 200 words; reduce the `### Hierarchical Structure of the Notebook` budget to 500 words so the total stays within 1000 words.        

- `### Diagrams` ***Optional mermaid diagram:***
    - **Trigger for *Mermaid Diagram*** 
        - **Trigger for *Structure of the Notebook*** : If the notebook is complex and has more than *3 multiple logical blocks*, provide a mermaid flow diagram to illustrate the structure of the notebook.
        - **Trigger for *Datamodel*** : If more then 6 table/views are defined and the the relationsship between these table/view are captured in primary and foreign keys, provide a mermaid diagram to illustrate the datamodel.
        - **Trigger for *Job Flow*** : If the `### Dependencies` discovery found a job in the bundle `resources`-folder that references the notebook, AND that job has more than 3 tasks (count nested `for_each_task.task` as part of its parent task), provide a mermaid flow diagram of the job tasks, highlighting the documented notebook.
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

  - If the mermaid is triggered, the structure of cells is as follows:
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
                    try: get_ipython().run_cell_magic("mermaid", "", """
                    flowchart TD
                        A[Start] --> B[Process]
                        B --> C[End]
                    """)
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
        - cell
            - if `Job Flow` is triggered
                - title : `Job Flow`
                - content : here the actual job FlowDiagram mermaid is created
                    - It should reflect the content of the `### Dependencies` section; it MUST be derived only from the resource yaml files read during the `### Dependencies` discovery (read-only, NEVER run bundle CLI commands).
                    - One diagram per job that references the notebook; if more than one job is found, put one `render_mermaid` call per job in the same cell.
                    - Start with one node for the trigger: the schedule in plain English (from `quartz_cron_expression` + `timezone_id`), or `Manual / triggered externally` if no schedule is defined.
                    - One node per task: `<task_key><br><notebook name>`; the notebook name is the file name of `notebook_path` without folder and extension.
                    - Draw edges from every `depends_on` entry to the task; add the `run_if` value as edge label when it is not `ALL_SUCCESS`.
                    - A `for_each_task` is drawn as a subgraph named `<task_key> (for each, concurrency <n>)`, holding the nested task node; label the edge into the subgraph with the input source (e.g. `tasks.preparation.values.facts`).
                    - A `condition_task` is drawn as a diamond `{ }` with its `true` / `false` outgoing edges labelled.
                    - Pipeline, SQL or other non-notebook tasks are drawn as a node with the task type in the label (e.g. `pipeline_task`).
                    - Color coding (reuse the classification colors table above):
                        | ***Role in the job*** | ***Classification color*** | ***Fill*** | ***Border*** | ***Font*** |
                        |:---                       |:---                     |:---      |:---      |:--- |
                        | Trigger / schedule        | Initialization          | #858688  | #505052  | #FFFFFF |
                        | Upstream task             | Helper Functions        | #5b7fa6  | #374c64  | #FFFFFF |
                        | Documented notebook       | Processing Group 4      | #e65100  | #8a3100  | #FFFFFF |
                        | Downstream task           | DDL Schema, Tables & Views | #3d7a3d | #254925 | #FFFFFF |
                        | Unrelated / parallel task | Clean up                | #cab8b8  | #796e6e  | #000000 |
                    - The documented notebook node gets `stroke-width:4px` so it stands out in both light and dark mode.
                    - When generating the mermaid diagram DO NOT USE empty lines to separate objects in the diagram!
                    - Keep the diagram readable: max 15 nodes; if the job is larger, collapse tasks that are neither upstream nor downstream of the documented notebook into a single node `other tasks (<n>)`.
                - example :

                    ```python
                    render_mermaid("""
                    flowchart LR
                        TRG([Schedule:<br>weekdays 12:00<br>Europe/Amsterdam])
                        PREP[preparation<br>01_preparation]
                        subgraph DIMS["dimensions (for each, concurrency 5)"]
                            DIM[dimension<br>02_dimensions]
                        end
                        subgraph FACTS["facts (for each, concurrency 5)"]
                            FCT[fact<br>03_facts]
                        end
                        subgraph BRDS["bridges (for each, concurrency 5)"]
                            BRD[bridge<br>04_bridges]
                        end
                        CLN[cleanup<br>09_cleanup]
                        TRG --> PREP
                        PREP -- "tasks.preparation.values.dimensions" --> DIMS
                        DIMS -- "tasks.preparation.values.facts" --> FACTS
                        FACTS -- "tasks.preparation.values.bridges" --> BRDS
                        BRDS --> CLN
                        style TRG fill:#858688,stroke:#505052,color:#FFFFFF
                        style PREP fill:#5b7fa6,stroke:#374c64,color:#FFFFFF
                        style DIMS fill:#5b7fa6,stroke:#374c64,color:#FFFFFF
                        style DIM fill:#5b7fa6,stroke:#374c64,color:#FFFFFF
                        style FACTS fill:#e65100,stroke:#8a3100,color:#FFFFFF,stroke-width:4px
                        style FCT fill:#e65100,stroke:#8a3100,color:#FFFFFF,stroke-width:4px
                        style BRDS fill:#3d7a3d,stroke:#254925,color:#FFFFFF
                        style BRD fill:#3d7a3d,stroke:#254925,color:#FFFFFF
                        style CLN fill:#3d7a3d,stroke:#254925,color:#FFFFFF
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