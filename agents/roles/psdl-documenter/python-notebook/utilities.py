# Databricks notebook source
# DBTITLE 1,import libraries
import logging

# COMMAND ----------

# DBTITLE 1,### private helper
# !!! Function that start with "_" (underscore) are NOT ment to be used outside this notebook !!! #

# COMMAND ----------

# DBTITLE 1,Class : _CustomFormatter
class _CustomFormatter(logging.Formatter):
    grey = "\x1b[38;1m"
    green = "\x1b[32;1m"
    orange = "\x1b[33;1m"
    red = "\x1b[31;1m"
    reset = "\x1b[0m"
    msg_format = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"

    FORMATS = {
        logging.DEBUG: grey + msg_format + reset,
        logging.INFO: green + msg_format + reset,
        logging.WARNING: orange + msg_format + reset,
        logging.ERROR: red + msg_format + reset,
        logging.CRITICAL: red + msg_format + reset,
    }

    def format(self, record):
        log_fmt = self.FORMATS.get(record.levelno)
        formatter = logging.Formatter(log_fmt)
        return formatter.format(record)

# COMMAND ----------

# DBTITLE 1,Function : _apply_comment_if_changed
def _apply_comment_if_changed(
        object_label:    str,
        current_comment: str,
        new_comment:     str,
        alter_sql:       str
    ) -> bool:
    """
    
    Vergelijkt de huidige comment met de gewenste comment en voert het
    meegegeven `alter_sql` statement alleen uit wanneer er daadwerkelijk
    een wijziging is. Logt consistent voor alle drie de UC-objecttypes
    (schema, table/view, column).

    Args:
        object_label (str): Label voor in de logregel, bv.
            "schema `foo` in catalog `bar`" of
            "column `bar` in dataset `catalog.schema.table`".
        current_comment (str): The current comment as retrieved from Unity Catalog.
        new_comment (str): the new comment that should be set. If it is the same as the current comment, no update will be performed.
        alter_sql (str): The full SQL statement (as a string) that must be executed to change the comment. Differs
            per objecttype (schema/table/column), the caller is responsible for providing the correct SQL statement that matches the object.

    Returns:
        bool: True if comment is changed, False if no change was needed.
        is used to indicate whether the comment was updated or not, which
        can be useful for further logic in the calling function. Now its used for logging purposes.
    """
    if current_comment == new_comment:
        # no logger output for unchanged comments, to avoid cluttering the logs
        # logger.info(f"Geen update nodig voor comment van {object_label}")
        return False

    try:
        spark.sql(alter_sql)
        
    except Exception as e:
        logger.error(f"Failed to update comment for {object_label}: {e}")
        return False

    if new_comment == "":
        logger.warning(f"Comment van {object_label} bijgewerkt met een lege string!")
    else:
        logger.info(f"Comment van {object_label} bijgewerkt")

    return True


# COMMAND ----------

# DBTITLE 1,Function : _resolve_catalog_schema
def _resolve_catalog_schema(catalog_name: str = None, schema_name: str = None):
    """
    helper functie

    Bundelt de logica die in alle drie de set_comment_* functies terugkomt:
    het bepalen van de te gebruiken catalog/schema op basis van de meegegeven
    parameters, met terugval op de huidige sessie-context (`current_catalog()`
    / `current_schema()`).

    Returns:
        tuple[str, str] | tuple[None, None]: (catalog_name, schema_name), of
        (None, None) wanneer er geen geldige catalog/schema bepaald kan worden
        (in dat geval is er al een logger.error(...) gelogd door deze functie).
    """
    
    current = (
        spark.sql("""
            select
                    current_catalog() as catalog_name
                ,   current_schema()  as schema_name
        """).first())

    if catalog_name is None:
        if current.catalog_name != "hive_metastore":
            catalog_name = current.catalog_name
        else:
            logger.error("Local Catalog is NOT set!")
            return None, None

    if schema_name is None:
        if current.schema_name != "default":
            schema_name = current.schema_name
        else:
            logger.error("No Schema is set!")
            return None, None

    return catalog_name, schema_name


# COMMAND ----------

# DBTITLE 1,### publieke functies and variables
# !!! The functions and variable are ment to be used outside this notebook !!! #

# COMMAND ----------

# DBTITLE 1,Set : notebook_name
notebook_name = (
    dbutils.notebook.entry_point.getDbutils()
    .notebook()
    .getContext()
    .notebookPath()
    .get()
    .split("/")[-1]
)

# COMMAND ----------

# DBTITLE 1,initialize_logger
logger = logging.getLogger(notebook_name)
logger.setLevel(logging.INFO)

console_handler = logging.StreamHandler()
console_handler.setLevel(logging.INFO)
formatter = logging.Formatter(
    "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
console_handler.setFormatter(_CustomFormatter())

logger.propagate = False
if not logger.hasHandlers():
    logger.addHandler(console_handler)

logger_py4j = logging.getLogger("py4j")
logger_py4j.setLevel(logging.ERROR)

logger.info("Initialized logger for: %s", notebook_name)

# COMMAND ----------

# DBTITLE 1,set_comment_schema
def set_comment_schema(
        catalog_name:   str = None,
        schema_name:    str = None,
        schema_comment: str = ""
    ):
    """
    Add or update a comment on a schema in Unity Catalog.

    Args:
        catalog_name (str, optional): The name of the catalog. If None, uses the current catalog if set.
        schema_name (str, optional): The name of the schema to comment on. If None, uses the current schema if set.
        schema_comment (str): The comment to set on the schema.

    Notebook path:
        00_shared/utilities.py

    Examples:
        # Example 1: catalog_name left None, schema_name filled, schema_comment filled
        set_comment_schema(schema_name="my_schema", schema_comment="This is a test schema comment.")

        # Example 2: schema_name left None, schema_comment filled
        set_comment_schema(catalog_name="my_catalog", schema_comment="Default schema comment.")

        # Example 3: schema_comment left empty
        set_comment_schema(catalog_name="my_catalog", schema_name="my_schema")
    """

    # zetten en checken of catalog/schema mee gegeven zijn en/of leeg gelaten en zodoende de default waarde overnemen
    catalog_name, schema_name = _resolve_catalog_schema(catalog_name, schema_name)

    # afbreken als catalog leeg is, en afbreken als schema leeg is    
    if catalog_name is None: return None
    if schema_name  is None: return None

    # zetten volledige naam voor table/view
    full_name = f"{catalog_name}.{schema_name}"

    # ophalen van current comment op table/view niveau
    if not spark.catalog.databaseExists(full_name):
        logger.error(f"The schema `{schema_name}` in catalog `{catalog_name}` does NOT exists!")
        return None

    current_schema_comment = (
        spark.sql(f"describe schema extended {full_name}")
            .filter("database_description_item = 'Comment'")
            .select("database_description_value")
            .first()[0]
    )

    _apply_comment_if_changed(
        object_label    = f"schema `{schema_name}` in catalog `{catalog_name}`",
        current_comment = current_schema_comment,
        new_comment     = schema_comment,
        alter_sql       = f"comment on schema {full_name} is '{schema_comment}'"
    )
    logger.info(f"The schema `{schema_name}` in catalog `{catalog_name}` comment is succesfully set!")
    return None



# COMMAND ----------

# DBTITLE 1,set_comment_table_view
def set_comment_table_view(
        catalog_name:       str = None,
        schema_name:        str = None,
        table_view_name:    str = None,
        table_view_comment: str = ""
    ):
    """
    Add or update a comment on a table or view in Unity Catalog.

    Args:
        catalog_name (str, optional): The name of the catalog. If None, uses the current catalog if set.
        schema_name (str, optional): The name of the schema. If None, uses the current schema if set.
        table_view_name (str): The name of the table or view to comment on.
        table_view_comment (str): The comment to set on the table or view.

    Notebook path:
        00_shared/utilities.py

    Examples:
        set_comment_table_view(schema_name="my_schema", table_view_name="my_table", table_view_comment="This is a test table comment.")
        set_comment_table_view(catalog_name="my_catalog", schema_name="my_schema", table_view_name="my_view", table_view_comment="This is a test view comment.")
    """

    # zetten en checken of catalog/schema mee gegeven zijn en/of leeg gelaten en zodoende de default waarde overnemen
    catalog_name, schema_name = _resolve_catalog_schema(catalog_name, schema_name)

    # afbreken als catalog leeg is, en afbreken als schema leeg is    
    if catalog_name is None: return None
    if schema_name  is None: return None

    # Table/View moet mee gegeven worden
    if table_view_name is None:
        logger.error("Table/View name must be provided!")
        return None

    # zetten volledige naam voor table/view
    full_name = f"{catalog_name}.{schema_name}.{table_view_name}"

    # ophalen van current comment op table/view niveau
    try: 
        desc = spark.sql(f"describe table extended {full_name}")
    except Exception as e:
        logger.error(f"The table/view `{full_name}` does not exist or cannot be described")
        return None
    row = desc.filter("col_name = 'Comment'").select("data_type").first()
    current_table_view_comment = row.data_type if row is not None else ""

    _apply_comment_if_changed(
        object_label    = f"table/view `{table_view_name}` in schema `{schema_name}` (catalog `{catalog_name}`)",
        current_comment = current_table_view_comment,
        new_comment     = table_view_comment,
        alter_sql       = f"comment on table {full_name} is '{table_view_comment}'"
    )
    logger.info(f"The table/view `{table_view_name}` in schema `{schema_name}` (catalog `{catalog_name}`) comment is succesfully set!")
    return None


# COMMAND ----------

# DBTITLE 1,set_comment_column
def set_comment_columns(
        catalog_name:       str = None,
        schema_name:        str = None,
        table_view_name:    str = None,
        column_comments:    dict = None
    ):
    """
    Add or update comments on the columns of a table or view in Unity Catalog.

    Args:
        catalog_name (str, optional): The name of the catalog. If None, uses the current catalog if set.
        schema_name (str, optional): The name of the schema. If None, uses the current schema if set.
        table_view_name (str): The name of the table or view whose columns should be commented.
        column_comments (dict): Mapping of column name to comment, e.g.
            {"my_column_1": "comment 1", "my_column_2": "comment 2"}.

    Notebook path:
        00_shared/utilities.py

    Examples:
        set_comment_column(
            schema_name="my_schema",
            table_view_name="my_table",
            column_comments={
                "my_column_1": "comment 1",
                "my_column_2": "comment 2",
            }
        )
        set_comment_column(
            catalog_name="my_catalog",
            schema_name="my_schema",
            table_view_name="my_view",
            column_comments={
                "my_column_1": "comment 1",
                "my_column_2": "comment 2",
            }
        )
    """
    
    column_comments = column_comments or {}

    # zetten en checken of catalog/schema mee gegeven zijn en/of leeg gelaten en zodoende de default waarde overnemen
    catalog_name, schema_name = _resolve_catalog_schema(catalog_name, schema_name)

    # afbreken als catalog leeg is, en afbreken als schema leeg is    
    if catalog_name is None: return None
    if schema_name  is None: return None

    # Table/View moet mee gegeven worden
    if table_view_name is None:
        logger.error("Dataset name must be provided!")
        return None

    # zetten volledige naam voor table/view
    full_name = f"{catalog_name}.{schema_name}.{table_view_name}"

    # ophalen van current comment op column niveau
    try:
        spark.sql(f"describe table extended {full_name}")
    except Exception as e:
        logger.error(f"Table/View `{full_name}` does not exist or cannot be described: {e}")
        return None
    current_column_comments = {
        row["col_name"]: (row["comment"] if row["comment"] is not None else "")
        for row in spark.sql(f"describe {full_name}").collect()
    }

    updated_count   = 0
    unchanged_count = 0

    for column_name, column_comment in column_comments.items():
        current_column_comment = current_column_comments.get(column_name)

        if current_column_comment is None:
            logger.error(f"Provided column `{column_name}` does NOT exist in dataset `{full_name}`!")
            return None

        was_updated = _apply_comment_if_changed(
            object_label    = f"column `{column_name}` in dataset `{full_name}`",
            current_comment = current_column_comment,
            new_comment     = column_comment,
            alter_sql       = f"alter table {full_name} alter column `{column_name}` comment '{column_comment}'"
        )

        if was_updated:
            updated_count += 1
        else:
            unchanged_count += 1

    logger.info(
        f"Column comments in table/view `{table_view_name}` in schema `{schema_name}` "
        f"processed: {updated_count} updated, {unchanged_count} unchanged."
    )
    return None
