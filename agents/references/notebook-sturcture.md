# Notebook Structure

## Docementation

## Initialization

### Shared

### Set Default Catalog

### Set Default Schema

### Helper Functions

## Inbound

### <Source>
- Set Spark.Sql Variable for the source catalog, `init_catalog("<source-catalog>")`
- per source dataset (view or table) create (temporal) view, `get_<blo/slo/glo>_<source-code>_<schema_name_or_abbreviation>_<name-of-table-or_view>`

## Code

### per dataset (view or table) for incremental loading or separate logic

The cell in the notebook can have a section header, which helps in organizing and documenting the code effectively. this will group the cell related to the dataset (table/view) together under a clear and descriptive heading.

```markdown
### <name-of-table-or-view> 
here the developer can provide a description or what the dataset use is and how it is constructed or any other relevant information.
independent or in collaboration with the other comments of other cells related to this dataset.
```

cell title: `Definition : <name-of-table>`
```sql
create table if not exists `<table_name>` (
    `<column_name>` `<data_type>`,
    ...
)
```

***optional*** one or more temporal views for the table

cell title: `Temporal : <name-of-temporal-view>`
```sql
create temporal view or replace `<temporal_view_name>` as
select *
from `<table_name>`
```

cell title: `Temporal : <name-of-temporal-table>`
```sql
create table or replace `<temporal_table_name>` as
select *
from `<table_name>`
```

***if append only use insert***

cell title: `Append : <name-of-table>`
```sql
insert into `<table_name>` (`<column_name>`, ...)
select `<column_name>`, ...
from `<source_table_name>` 
where `<condition>`
```

***if incremental loading use merge***

cell title: `Merge : <name-of-table>`
```sql
merge into `<table_name>` as target
using `<source_table_name>` as source
on `<condition>`
when matched then
    update set target.`<column_name>` = source.`<column_name>`, ...
when not matched then
    insert (`<column_name>`, ...)
    values (source.`<column_name>`, ...)
```

***if overriding specific records use update***

cell title: `Update : <name-of-table>`
```sql
update `<table_name>`
set `<column_name>` = `<value>`, ...
where `<condition>`
```

***documentation***

cell title: `Metadata : <name-of-table-or-view>`
```python
# Table Definition
set_comments_table_or_view(
    table_or_view_name="<name-of-table-or-view>",
    comments = "<Functional Name of Table or View> | <Functional Description>"
)

# Column Definitions
set_comments_column(
    table_or_view_name="<name-of-table-or-view>",
    comments = {
        "<Column Name>": "<Column Description>"
    }
)
