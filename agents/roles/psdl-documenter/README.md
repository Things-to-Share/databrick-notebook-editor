# Genie Code Documentation Skills

This folder holds a set of Genie Code skills that document Databricks notebooks and their Unity Catalog objects: tables/views, columns, schemas, and the notebook itself.

## What is a skill?

A skill is a folder with a `SKILL.md` file inside it. The file starts with YAML frontmatter (`name`, `description`) followed by Markdown instructions. Genie Code reads the `description` of every skill and loads a skill **automatically** when your request matches it. You can also start a skill **manually** by `@`-mentioning it in the Genie Code chat.

Reference: [Extend Genie Code with agent skills](https://learn.microsoft.com/en-us/azure/databricks/genie-code/skills/)

## Installation

This repo holds the folder-structure for the skills, plus a README.md (this file).

```
git-repository
├── .attachments
│   └── various images
├── Skill-0-Documenter/
│   └── SKILL.md
├── Skill-1-Add-or-Update-Comment-Table-View/
│   └── SKILL.md
├── Skill-2-Add-or-Update-Comment-for-Schema/
│   └── SKILL.md
├── Skill-3-Add-or-Update-Documentation-of-Notebook/
│   └── SKILL.md
├── python-notebook
│   └── utilities.py
├── .gitignore
└── README.md
```

Following the steps below will install the skills, so that Genie Code will automatically pick them up if the prompt of the user can be match to one or more of the skill described.

***Step 1*** : create `.assistant`-folder, as stated before Genie Code skills can apply to the user self or for everyone who has access to the workspace. By creating the `.assistant`-folder directly under the `WORKSPACE`, the skills will be available for all users who have access to the workspace. If created under the user's home directory, the skills will only be available to that user.

***Step 2*** : create `skills`-folder inside the `.assistant`-folder. However by creating a `git`-folder instead of a regular folder, you can version control your skills and easily share them with others. Whatever the name of the git-repository is, the name of the `git-folder must be named `skills` and be placed inside the `.assistant`-folder.

***Step 3*** : Validating the installation, after the `git`-folder was created(cloned), ensure that all the skill folders (`Skill-0-Documenter`, `Skill-1-Add-or-Update-Comment-Table-View`, etc.) are present inside the `skills`-folder and are picked up by Genie Code. To check this open Genie Code, go to **Customizations**, and verify that the skill folders are listed there. You should see something like the images below, which shows the skills aviable to everyone.

![validating installation](./.attachments/check-result-after-creation-of-git-folder.png)


### Prerequisites before using the skills

The skills write code that calls helper functions and variables. The Skills do not define those functions. In the folder `python-notebook`, you should have a file named `utilities.py` that contains the definitions of these helper functions and variables.

You should implement this notebook in to your solution by either referencing it via the `%run`-command or copy the the notebook into your own solution to have access and then referencing it by the `%run`-command.

#### Example 1: Referencing the utilities.py via the `%run`-command:
```python
%run WORKSPACE/.assistant/skills/python-notebook/utilities.py
```

#### Example 2: Copying the utilities.py into your solution and referencing it via the `%run`-command:
```python
%run ./relative-path-to/utilities.py
```
what ever your implementation is, the functions and variables defined in `utilities.py` should be available, and you should be able to call them from your `target`-notebook, which your want to document.

### Notebook structure

The Skills expect then notebook to have a specific structure, with clearly defined sections for documentation, initialization, and code. If this does not exist, Genie Code will likely ask for you to add or indicate them, or the results may not be as expected.

The notebook should also follow this structure:

* `# <Notebook title>` (genie code will likely add it our ask your to add it)
* `## Documentation` (works best if it is already present in the notebook, genie code will update it, if it does not exist it will be added of the documentation will end up in unexpected places, in shot unexpected behavior may occur)
* `## Initialization` (required; the skills never change it, the skills will use it as context for the documentation)
* `## Code` (required; the skills never change it, the skills will use it as context for the documentation)

If `## Initialization` or `## Code` is missing, the skill stops and asks you to add it, however this is not garanteed and unexpected behavior may occur if they are not present.

## How to use

Open the notebook you want to document, then open the Genie Code pane (Agent mode).

### Option A: Document the whole notebook

```
@Skill-0-Documenter document @this-notebook
```

Genie Code confirms which notebook to work on. It then runs the three steps in order and gives a short summary after each one.

### Option B: Run one step

| Goal | Example Skill |
| --- | --- |
| Comment one table/view and its columns | `@Skill-1-Add-or-Update-Comment-Table-View add the Unity Catalog comment for the dataset in cell 12` |
| Comment the schema | `@Skill-2-Add-or-Update-Comment-for-Schema update the schema comment for this notebook` |
| Write the notebook documentation | `@Skill-3-Add-or-Update-Documentation-of-Notebook update the documentation section` |

### Option C: Let Genie Code choose

If you don't `@`-mention a skill, phrases such as *document notebook*, *Unity Catalog comment*, *table/view comment*, *column comment* or *functional description* usually load the right skill automatically. An `@`-mention is more reliable.

## What the skills change

* **Skill-1**: Renames or creates the `Definition : <table/view>` cell, and adds or updates the `Metadata : <table/view>` cell right after it. Existing `constraint_exists` / `constraint_add` code is kept and moved to the end of that cell.
* **Skill-2**: Makes sure the `Definition : <schema>` cell exists and adds or updates the `Metadata : <schema>` cell.
* **Skill-3**: Adds or updates only the markdown cells under `## Documentation`, up to 1000 words in total.

Code in `## Initialization` and `## Code` is never rewritten, apart from the `Definition` / `Metadata` cells listed above.

After the edits, **run the Metadata cells** to write the comments to Unity Catalog. Editing the cells alone does not apply them.

## Review checklist

AI-generated text must be checked by a person before you commit it:

* Names and descriptions match what the code really does.
* Descriptions are in English and within the limits: 200 words per table/schema, 100 words per column.
* Columns are listed in the same order as in the dataset.
* No `tmp_...` or `get_...` intermediate views are mentioned as sources.
* The Metadata cells run without errors and the comments appear in Catalog Explorer.

## Editing or adding skills

* Keep the frontmatter at the top of `SKILL.md` with `name` and `description`. The `description` decides when Genie Code loads the skill automatically, so list clear trigger phrases.
* The `tools:` line in the frontmatter is left over from other agent tools. Genie Code ignores it.
* After you edit a skill, **start a new chat**. Active chats keep the old version. If the old behavior still shows, hard-refresh the browser tab.
* To test a change, use it as a user skill first, then promote it to `/Workspace/.assistant/skills/`.
