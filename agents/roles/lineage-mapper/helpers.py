"""Helper utilities for SQL lineage mapping."""

import re

def clean_sql_statement(sql: str) -> str:
	"""Remove SQL comments from a statement.

	Supported comment styles:
	- Single-line: `-- comment`
	- Multi-line / inline: `/* comment */`

	Comment markers inside quoted strings are preserved.
	"""
	if not sql:
		return sql

	result = []
	i = 0
	n = len(sql)

	in_single_quote = False
	in_double_quote = False
	in_bracket_quote = False

	while i < n:
		ch = sql[i]
		nxt = sql[i + 1] if i + 1 < n else ""

		if in_single_quote:
			result.append(ch)
			if ch == "'":
				if nxt == "'":
					result.append(nxt)
					i += 1
				else:
					in_single_quote = False
			i += 1
			continue

		if in_double_quote:
			result.append(ch)
			if ch == '"':
				if nxt == '"':
					result.append(nxt)
					i += 1
				else:
					in_double_quote = False
			i += 1
			continue

		if in_bracket_quote:
			result.append(ch)
			if ch == "]":
				in_bracket_quote = False
			i += 1
			continue

		if ch == "'":
			in_single_quote = True
			result.append(ch)
			i += 1
			continue

		if ch == '"':
			in_double_quote = True
			result.append(ch)
			i += 1
			continue

		if ch == "[":
			in_bracket_quote = True
			result.append(ch)
			i += 1
			continue

		if ch == "-" and nxt == "-":
			i += 2
			while i < n and sql[i] not in "\r\n":
				i += 1
			continue

		if ch == "/" and nxt == "*":
			i += 2
			while i + 1 < n and not (sql[i] == "*" and sql[i + 1] == "/"):
				i += 1
			i += 2 if i + 1 < n else 0
			continue

		result.append(ch)
		i += 1

	cleaned = "".join(result)
	cleaned_lines = [line.rstrip() for line in cleaned.splitlines()]
	return "\n".join(line for line in cleaned_lines if line.strip())

def detect_subqueries_used_in_from_join(sql: str) -> tuple[bool, str]:
	"""Detect subqueries in FROM/JOIN clauses.

	Returns:
	- `(True, message)` when no subqueries are found in FROM/JOIN clauses.
	- `(False, message)` when subqueries are found in FROM/JOIN clauses, with detected subquery text.
	"""
	cleaned_sql = clean_sql_statement(sql)
	lower_sql = cleaned_sql.lower()
	detected_subqueries = []

	i = 0
	n = len(cleaned_sql)
	while i < n:
		match = re.search(r"\b(from|join)\b", lower_sql[i:])
		if not match:
			break

		kw_start = i + match.start()
		j = i + match.end()

		while j < n and cleaned_sql[j].isspace():
			j += 1

		if j < n and cleaned_sql[j] == "(":
			depth = 1
			k = j + 1
			in_single = False
			in_double = False

			while k < n and depth > 0:
				ch = cleaned_sql[k]
				nxt = cleaned_sql[k + 1] if k + 1 < n else ""

				if in_single:
					if ch == "'":
						if nxt == "'":
							k += 1
						else:
							in_single = False
					k += 1
					continue

				if in_double:
					if ch == '"':
						if nxt == '"':
							k += 1
						else:
							in_double = False
					k += 1
					continue

				if ch == "'":
					in_single = True
				elif ch == '"':
					in_double = True
				elif ch == "(":
					depth += 1
				elif ch == ")":
					depth -= 1

				k += 1

			if depth == 0:
				inner_sql = cleaned_sql[j + 1 : k - 1].strip()
				if re.search(r"\bselect\b", inner_sql, flags=re.IGNORECASE):
					detected_subqueries.append(inner_sql)
				i = k
				continue

		i = kw_start + 1

	if detected_subqueries:
		display = [f"[{idx}] {subq}" for idx, subq in enumerate(detected_subqueries, start=1)]
		return False, "Detected subqueries in FROM/JOIN clause: " + " | ".join(display)

	return True, "No subqueries detected in FROM/JOIN clause."