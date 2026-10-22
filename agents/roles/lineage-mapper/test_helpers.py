"""Tests for SQL helper utilities in lineage-mapper."""

from __future__ import annotations

import importlib.util
from pathlib import Path


MODULE_PATH = Path(__file__).with_name("helpers.py")
SPEC = importlib.util.spec_from_file_location("lineage_mapper_helpers", MODULE_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError(f"Unable to load module from {MODULE_PATH}")

helpers = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(helpers)


def test_clean_sql_statement_removes_single_line_and_block_comments() -> None:
    sql = """
    SELECT col1, /* inline block */ col2
    FROM table_a -- trailing comment
    WHERE id = 42
    """

    cleaned = helpers.clean_sql_statement(sql)

    assert "/*" not in cleaned
    assert "--" not in cleaned
    assert cleaned == "SELECT col1,  col2\nFROM table_a\nWHERE id = 42"


def test_clean_sql_statement_preserves_comment_markers_inside_quotes() -> None:
    sql = """
    SELECT '-- not a comment' AS txt,
           '/* still text */' AS txt2,
           "-- still text" AS txt3
    FROM t
    """

    cleaned = helpers.clean_sql_statement(sql)

    assert "'-- not a comment'" in cleaned
    assert "'/* still text */'" in cleaned
    assert '"-- still text"' in cleaned


def test_detect_subqueries_used_in_from_join_no_subquery() -> None:
    sql = "SELECT a.id FROM accounts a JOIN regions r ON a.region_id = r.id"

    is_valid, message = helpers.detect_subqueries_used_in_from_join(sql)

    assert is_valid is True
    assert message == "No subqueries detected in FROM/JOIN clause."


def test_detect_subqueries_used_in_from_join_from_subquery() -> None:
    sql = "SELECT x.id FROM (SELECT id FROM src_table) x"

    is_valid, message = helpers.detect_subqueries_used_in_from_join(sql)

    assert is_valid is False
    assert "Detected subqueries in FROM/JOIN clause:" in message
    assert "SELECT id FROM src_table" in message


def test_detect_subqueries_used_in_from_join_join_subquery() -> None:
    sql = """
    SELECT a.id
    FROM accounts a
    JOIN (SELECT account_id FROM latest_events) e ON e.account_id = a.id
    """

    is_valid, message = helpers.detect_subqueries_used_in_from_join(sql)

    assert is_valid is False
    assert "SELECT account_id FROM latest_events" in message


def test_detect_subqueries_used_in_from_join_multiple_subqueries() -> None:
    sql = """
    SELECT *
    FROM (SELECT id FROM t1) a
    JOIN (SELECT id FROM t2) b ON a.id = b.id
    """

    is_valid, message = helpers.detect_subqueries_used_in_from_join(sql)

    assert is_valid is False
    assert "[1] SELECT id FROM t1" in message
    assert "[2] SELECT id FROM t2" in message
