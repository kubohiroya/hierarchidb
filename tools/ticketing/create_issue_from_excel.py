#!/usr/bin/env python3
"""Create GitHub issues from rows in the generated task Excel workbooks.

The script expects the workbook structure produced by the auto-exporter (inline strings,
first row header). Usage example:

    python tools/ticketing/create_issue_from_excel.py \
        --file Doing_Tasks.xlsx \
        --sheet "Worker & Runtime Worker" \
        --row 5 \
        --labels "type:feat,priority:P1" \
        --execute

Without --execute it prints the payload and gh command for review.
"""

from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from xml.etree import ElementTree
from zipfile import ZipFile

# --- helpers ---------------------------------------------------------------

# Headers expected in the Excel files (first row).
HEADERS = [
    "Task Key",
    "Summary",
    "Branch",
    "Worktree",
    "Dirs",
    "Dependencies",
    "Acceptance Criteria",
    "Checklist",
    "Subtasks",
    "Rollback Plan",
    "Flags",
    "Scope",
    "Objective",
    "Outcome",
    "Follow-up",
    "Tests",
    "Notes",
    "Operation Log",
    "Current Status",
    "Priority",
    "Description",
    "Background",
    "Estimate",
    "Other Sections",
]

COLUMN_INDEX = {name: idx for idx, name in enumerate(HEADERS)}


@dataclass
class SheetInfo:
    name: str
    path: str  # relative path inside the xlsx zip (xl/worksheets/sheetX.xml)


class WorkbookReader:
    """Minimal reader for inlineStr-only XLSX files produced by the exporter."""

    def __init__(self, filename: Path) -> None:
        self.filename = filename
        if not filename.exists():
            raise FileNotFoundError(f"Workbook not found: {filename}")
        self._zip = ZipFile(filename, "r")
        self._sheet_map = self._read_sheet_map()

    def close(self) -> None:
        self._zip.close()

    def _read_sheet_map(self) -> Dict[str, SheetInfo]:
        workbook_xml = ElementTree.fromstring(self._zip.read("xl/workbook.xml"))
        rels_xml = ElementTree.fromstring(
            self._zip.read("xl/_rels/workbook.xml.rels")
        )
        rels = {
            rel.attrib["Id"]: rel.attrib["Target"]
            for rel in rels_xml.findall("{http://schemas.openxmlformats.org/package/2006/relationships}Relationship")
        }
        sheets: Dict[str, SheetInfo] = {}
        for sheet in workbook_xml.findall(
            "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}sheets/"
            "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}sheet"
        ):
            name = sheet.attrib["name"]
            rel_id = sheet.attrib["{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"]
            target = rels[rel_id]
            if not target.startswith("worksheets/"):
                target = f"worksheets/{target}"
            sheets[name] = SheetInfo(name=name, path=f"xl/{target}")
        return sheets

    def list_sheets(self) -> List[str]:
        return sorted(self._sheet_map.keys())

    def read_sheet(self, sheet_name: str) -> List[List[str]]:
        if sheet_name not in self._sheet_map:
            raise ValueError(
                f"Sheet '{sheet_name}' not found. Available: {', '.join(self.list_sheets())}"
            )
        sheet_xml = ElementTree.fromstring(self._zip.read(self._sheet_map[sheet_name].path))
        ns = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
        rows: Dict[int, Dict[int, str]] = defaultdict(dict)
        for row_el in sheet_xml.findall(f"{ns}sheetData/{ns}row"):
            r_idx = int(row_el.attrib["r"])
            for cell in row_el.findall(f"{ns}c"):
                coord = cell.attrib["r"]
                col_idx = column_to_index(coord.rstrip("0123456789"))
                value = ""
                if cell.attrib.get("t") == "inlineStr":
                    text_el = cell.find(f"{ns}is/{ns}t")
                    if text_el is not None and text_el.text:
                        value = text_el.text
                elif cell.attrib.get("t") == "s":
                    raise ValueError(
                        "Shared strings are not supported by this lightweight reader."
                    )
                else:
                    v_el = cell.find(f"{ns}v")
                    if v_el is not None and v_el.text:
                        value = v_el.text
                rows[r_idx][col_idx] = value
        max_col = len(HEADERS)
        ordered_rows: List[List[str]] = []
        for r_idx in sorted(rows):
            row_values = ["" for _ in range(max_col)]
            for c_idx, value in rows[r_idx].items():
                if 0 <= c_idx < max_col:
                    row_values[c_idx] = value
            ordered_rows.append(row_values)
        return ordered_rows


def column_to_index(column_label: str) -> int:
    column_label = column_label.upper()
    value = 0
    for char in column_label:
        if not ("A" <= char <= "Z"):
            raise ValueError(f"Invalid column label: {column_label}")
        value = value * 26 + (ord(char) - ord("A") + 1)
    return value - 1


def parse_row_spec(spec: str, min_row: int, max_row: int) -> List[int]:
    """Parse comma/range row specification (e.g., "2,4,10-12")."""

    rows: List[int] = []
    for part in spec.split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            start_str, end_str = part.split("-", 1)
            try:
                start = int(start_str)
                end = int(end_str)
            except ValueError:
                raise SystemExit(f"Invalid row range: {part}")
            if start > end:
                start, end = end, start
            for value in range(start, end + 1):
                if value < min_row or value > max_row:
                    raise SystemExit(f"Row {value} out of range ({min_row}..{max_row})")
                rows.append(value)
        else:
            try:
                value = int(part)
            except ValueError:
                raise SystemExit(f"Invalid row number: {part}")
            if value < min_row or value > max_row:
                raise SystemExit(f"Row {value} out of range ({min_row}..{max_row})")
            rows.append(value)
    deduped = sorted(dict.fromkeys(rows))
    return deduped


def row_to_yaml(row: List[str]) -> str:
    lines: List[str] = []
    for header in HEADERS:
        value = row[COLUMN_INDEX[header]].rstrip()
        if value == "":
            lines.append(f"{header}: ''")
            continue
        if "\n" in value:
            block = "\n".join(f"  {line}" for line in value.splitlines())
            lines.append(f"{header}: |\n{block}")
            continue
        if needs_quoting(value):
            safe = value.replace("'", "''")
            lines.append(f"{header}: '{safe}'")
        else:
            lines.append(f"{header}: {value}")
    return "\n".join(lines)


def needs_quoting(value: str) -> bool:
    if value.lower() in {"true", "false", "null"}:
        return True
    if value and value[0] in "@!&*#?%" or value[-1] == ':':
        return True
    return not bool(re.fullmatch(r"[A-Za-z0-9._/\-]+", value))


CATEGORY_RULES: List[Tuple[str, List[str]]] = [
    ("Worker & Runtime Worker", ["worker-factory", "runtime-worker", "commandprocessor", "batch ", " batch", "worker/"]),
    ("Runtime UI", ["runtime-ui"]),
    ("UI TreeConsole", ["treeconsole"]),
    ("UI Dialog & Shell", ["ui-dialog", "dialog-state", "plugin-dialog"]),
    ("Plugins - Basemap", ["basemap"]),
    ("Plugins - Location", ["location"]),
    ("Plugins - Route", ["route"]),
    ("Plugins - Shape", ["shape"]),
    ("Plugins - Spreadsheet", ["spreadsheet"]),
    ("Plugins - Styler", ["styler"]),
    ("Plugins - Resolver", ["resolver"]),
    ("Plugins - Timeline", ["timeline"]),
    ("Plugins - Folder/Dialog Extensions", ["folder", "dialogextension", "dialog-extension", "extensiblefolder"]),
    ("App Frontend", ["/app/", " app", "app/"]),
    ("Build & Tooling", ["tsconfig", "lint", "prebuild", "turbo", "dep-fence", "policy", "ci "]),
    ("Common Types & Shared Models", ["common-type", "common/"]),
    ("Documentation & Operations", ["docs/", "documentation", "ドキュメント", "運用ログ", "operations"]),
    ("Feature Flags & Governance", ["flag", "rollout", "sunset", "既定", "段階導入"]),
    ("Internationalization", ["i18n"]),
    ("UI Components", ["ui-core", "ui/", "ui "]),
]


def categorize_task(key: str, summary: str) -> str:
    text = f"{key} {summary}".lower()
    for category, keywords in CATEGORY_RULES:
        if any(keyword in text for keyword in keywords):
            return category
    return "General / Cross-cutting"


def build_issue_payload(row: List[str]) -> Tuple[str, str, List[str]]:
    def get(column: str) -> str:
        return row[COLUMN_INDEX[column]].strip()

    key = get("Task Key")
    summary = get("Summary")
    title = f"{key} — {summary}" if summary else key
    lines: List[str] = []

    meta_lines = [f"- Task Key: {key}"]
    if summary:
        meta_lines.append(f"- Summary: {summary}")
    if get("Branch"):
        meta_lines.append(f"- Branch: {get('Branch')}")
    if get("Worktree"):
        meta_lines.append(f"- Worktree: {get('Worktree')}")
    if get("Dirs"):
        meta_lines.append(f"- Dirs: {get('Dirs')}")
    if get("Dependencies"):
        meta_lines.append(f"- Dependencies: {get('Dependencies')}")
    if get("Priority"):
        meta_lines.append(f"- Priority: {get('Priority')}")
    if get("Estimate"):
        meta_lines.append(f"- Estimate: {get('Estimate')}")
    lines.append("### Summary")
    lines.append("\n".join(meta_lines))

    def append_section(title: str, column: str) -> None:
        value = get(column)
        if not value:
            return
        lines.append(f"\n### {title}")
        lines.append(value)

    lines.append("\n### Description")
    lines.append("```yaml")
    lines.append(row_to_yaml(row))
    lines.append("```")
    append_section("Background", "Background")
    append_section("Scope", "Scope")
    append_section("Objective", "Objective")
    append_section("Outcome", "Outcome")
    append_section("Acceptance Criteria", "Acceptance Criteria")
    append_section("Checklist", "Checklist")
    append_section("Subtasks", "Subtasks")
    append_section("Tests", "Tests")
    append_section("Operation Log", "Operation Log")
    append_section("Current Status", "Current Status")
    append_section("Follow-up", "Follow-up")
    append_section("Rollback Plan", "Rollback Plan")
    append_section("Notes", "Notes")
    append_section("Other", "Other Sections")

    body = "\n".join(lines)

    category = categorize_task(key, summary)
    auto_labels: List[str] = []
    if category != "General / Cross-cutting":
        auto_labels.append(f"category:{category}")
    if key.startswith("feat/"):
        auto_labels.append("type:feat")
    elif key.startswith("fix/"):
        auto_labels.append("type:fix")
    elif key.startswith("chore/"):
        auto_labels.append("type:chore")
    elif key.startswith("refactor/"):
        auto_labels.append("type:refactor")
    elif key.startswith("test/"):
        auto_labels.append("type:test")
    elif key.startswith("docs/"):
        auto_labels.append("type:docs")

    return title, body, auto_labels


def run_gh_issue_create(title: str, body: str, labels: List[str], assignees: List[str], dry_run: bool) -> None:
    cmd = ["gh", "issue", "create", "--title", title, "--body", body]
    if labels:
        cmd.extend(["--label", ",".join(labels)])
    if assignees:
        cmd.extend(["--assignee", ",".join(assignees)])

    if dry_run:
        print("[DRY-RUN] gh command:")
        print(" ".join(shlex_quote(part) for part in cmd))
    else:
        subprocess.run(cmd, check=True)


def shlex_quote(arg: str) -> str:
    if re.fullmatch(r"[A-Za-z0-9@%_=+:,./-]+", arg):
        return arg
    return "'" + arg.replace("'", "'\\''") + "'"


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Create GitHub issues from rows exported to Doing/ToDo Excel files.\n"
            "Rows are 1-based (row 1 is the header)."
        ),
        formatter_class=argparse.RawTextHelpFormatter,
        epilog=(
            "Examples:\n"
            "  python tools/ticketing/create_issue_from_excel.py \\\n      --file Doing_Tasks.xlsx \\\n      --sheet \"Worker & Runtime Worker\" \\\n      --rows 2,5,10-12 \\\n      --labels \"priority:P1,type:feat\" \\\n      --assignees octocat\n\n"
            "  python tools/ticketing/create_issue_from_excel.py \\\n      --file ToDo_Tasks.xlsx \\\n      --sheet \"Plugins - Route\" \\\n      --rows 3-6"
        ),

    )
    parser.add_argument("--file", required=True, help="Path to Excel workbook")
    parser.add_argument("--sheet", required=True, help="Sheet name (category)")
    parser.add_argument(
        "--rows",
        required=True,
        help="Row specification (e.g. 2,4,10-12). Header is row 1; each task is 2+.",
    )
    parser.add_argument("--labels", default="", help="Additional comma-separated labels")
    parser.add_argument("--assignees", default="", help="Comma-separated GitHub usernames")
    parser.add_argument("--execute", action="store_true", help="Run gh issue create (default prints payload)")

    args = parser.parse_args()

    workbook_path = Path(args.file)
    reader = WorkbookReader(workbook_path)
    try:
        if args.sheet not in reader.list_sheets():
            print("Available sheets:", ", ".join(reader.list_sheets()))
            raise SystemExit(f"Sheet '{args.sheet}' not found")
        rows = reader.read_sheet(args.sheet)
    finally:
        reader.close()

    header = rows[0]
    if header != HEADERS:
        raise SystemExit("Unexpected header row. Ensure the workbook was generated by the exporter.")

    targets = parse_row_spec(args.rows, min_row=2, max_row=len(rows))
    multi = len(targets) > 1

    for idx, row_number in enumerate(targets, start=1):
        row = rows[row_number - 1]
        title, body, auto_labels = build_issue_payload(row)

        extra_labels = [label.strip() for label in args.labels.split(",") if label.strip()]
        labels = auto_labels + extra_labels
        assignees = [assignee.strip() for assignee in args.assignees.split(",") if assignee.strip()]

        print("=== Issue Preview ===")
        print(f"Row: {row_number}")
        print(f"Title: {title}")
        if labels:
            print("Labels:", labels)
        if assignees:
            print("Assignees:", assignees)
        print("Body:\n" + body)
        print("=====================")

        if not args.execute:
            run_gh_issue_create(title, body, labels, assignees, dry_run=True)
        else:
            run_gh_issue_create(title, body, labels, assignees, dry_run=False)
            if multi and idx < len(targets):
                print("---")


if __name__ == "__main__":
    main()
