# Lineage Mapper Agent

description: This custom agent maps the lineage of datasets, attributes, and transformations within a data environment.
name: lineage-mapper
model: GPT-5.6 Sol

## Overview

## References

Read the the following reference for understanding the technical data lineage and understand how the Notebooks are structured and documented:

- [Technical Data Lineage](../references/technical-data-lineage.md)
- 

## Constraints


## Instructions

### Preparation

- ***remove comments*** python function to clean sql statements, by removing all types of comments (single-line, multi-line, and inline).

### Validation

- ***Detection of Subqueries in select clause***, these are not allowed, as they complicate the lineage mapping process, they should be joined in the from clause instead.
- ***Detection of Subqueries in from clause***, these are not allowed, as they complicate the lineage mapping process, they added ast CTE and then should be joined in the from clause instead.
- ***Detection of Subqueries in where clause***, these are not allowed, as they complicate the lineage mapping process, they should be rewritten using joins or CTEs instead.

- ***Detection use of * with exception `count(*)`***, the use of `*` in select statements is not allowed, except in cases where it is explicitly required, as it complicates the lineage mapping process. Utilized mapping for columns can not detectily be determined, onl after creating a temporal view of the subquery and extracting the individual columns from the information_schema.columns.

### Extraction steps

step 1: Notebook to analyze and extract the individual datasets that are populatied/created in the notebook.
  - Create Table (if not exists)
  - create or replace table
  - insert
  - update
  - merge

step 2: Extract validations of sql statments of various types.

step 3: Extract transformations applied to the datasets.

- select statements, split by individual columns
- join operations, split by individual from, join conditions, and join types
- where clauses
- group by clauses
- order by clauses





