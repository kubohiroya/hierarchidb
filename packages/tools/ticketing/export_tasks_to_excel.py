#!/usr/bin/env python3
"""Export TASKS.md to Excel workbooks tailored for mrtask + GitHub Issue creation."""

from __future__ import annotations

import re
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple
from xml.sax.saxutils import escape
from zipfile import ZIP_DEFLATED, ZipFile

TASKS_MD = Path("TASKS.md")
DOING_FILE = Path("Doing_Tasks.xlsx")
TODO_FILE = Path("ToDo_Tasks.xlsx")

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

TASK_SLUG_PATTERN = re.compile(r"^-\s+([A-Za-z0-9_.-]+/[^\s]+)")
NUMBERED_TASK_PATTERN = re.compile(r"^(\d+)\)")
HEADING_PATTERN = re.compile(r"^### .*", re.MULTILINE)

LABEL_MAP = {
    "ブランチ": "branch",
    "branch": "branch",
    "依存": "dependencies",
    "依存関係": "dependencies",
    "依存先": "dependencies",
    "受け入れ基準": "acceptance",
    "受け入れ基準（dod）": "acceptance",
    "受け入れ基準(dod)": "acceptance",
    "チェックリスト": "checklist",
    "チェックリスト（抜粋）": "checklist",
    "サブタスク": "subtasks",
    "サブタスク（小粒pr単位）": "subtasks",
    "ロールバック手順": "rollback",
    "ロールバック": "rollback",
    "運用ログ": "operation_log",
    "運用メモ": "operation_log",
    "現状": "current_status",
    "ステータス": "current_status",
    "フラグ": "flags",
    "対象": "scope",
    "対象範囲": "scope",
    "対応範囲": "scope",
    "目的": "objective",
    "成果": "outcome",
    "成果物": "outcome",
    "後続": "follow_up",
    "メモ": "notes",
    "備考": "notes",
    "テスト": "tests",
    "試験": "tests",
    "想定工数": "estimate",
    "想定時間": "estimate",
    "優先度": "priority",
    "内容": "description",
    "背景": "background",
}

LIST_SECTIONS = {
    "acceptance",
    "checklist",
    "subtasks",
    "operation_log",
    "current_status",
    "notes",
    "follow_up",
    "tests",
    "rollback",
}

CATEGORY_RULES: List[Tuple[str, List[str]]] = [
    ("Worker & Runtime Worker", ["worker-factory", "runtime-worker", "commandprocessor", "batch ", " batch", "worker/"] ),
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
    ("App Frontend", ["/app/", " app", "app/"] ),
    ("Build & Tooling", ["tsconfig", "lint", "prebuild", "turbo", "dep-fence", "policy", "ci "] ),
    ("Common Types & Shared Models", ["common-type", "common/"] ),
    ("Documentation & Operations", ["docs/", "documentation", "ドキュメント", "運用ログ", "operations"] ),
    ("Feature Flags & Governance", ["flag", "rollout", "sunset", "既定", "段階導入"] ),
    ("Internationalization", ["i18n"]),
    ("UI Components", ["ui-core", "ui/", "ui "] ),
]

BASE_DIR = Path('.').resolve()


class Task:
    __slots__ = (
        'key', 'summary', 'branch', 'dependencies', 'acceptance', 'checklist', 'subtasks',
        'rollback', 'flags', 'scope', 'objective', 'outcome', 'follow_up', 'tests', 'notes',
        'operation_log', 'current_status', 'priority', 'description', 'background', 'estimate',
        'other_sections'
    )

    def __init__(self) -> None:
        self.key = ""
        self.summary = ""
        self.branch = ""
        self.dependencies = ""
        self.acceptance: List[str] = []
        self.checklist: List[str] = []
        self.subtasks: List[str] = []
        self.rollback: List[str] = []
        self.flags = ""
        self.scope = ""
        self.objective = ""
        self.outcome = ""
        self.follow_up: List[str] = []
        self.tests: List[str] = []
        self.notes: List[str] = []
        self.operation_log: List[str] = []
        self.current_status: List[str] = []
        self.priority = ""
        self.description = ""
        self.background = ""
        self.estimate = ""
        self.other_sections: Dict[str, List[str]] = defaultdict(list)


def load_sections(text: str) -> Dict[str, str]:
    matches = list(HEADING_PATTERN.finditer(text))
    sections: Dict[str, str] = {}
    for idx, match in enumerate(matches):
        start = match.start()
        end = matches[idx + 1].start() if idx + 1 < len(matches) else len(text)
        sections[match.group()] = text[start:end]
    return sections


def parse_section(section_text: str) -> List[List[str]]:
    lines = section_text.splitlines()[1:]
    tasks: List[List[str]] = []
    current: List[str] = []
    for raw in lines:
        stripped = raw.lstrip()
        if not stripped:
            if current:
                current.append(raw)
            continue
        is_start = False
        if stripped.startswith('- '):
            if TASK_SLUG_PATTERN.match(stripped):
                is_start = True
        elif NUMBERED_TASK_PATTERN.match(stripped):
            is_start = True
        if is_start:
            if current:
                tasks.append(current)
                current = []
            current.append(stripped)
        else:
            if current:
                current.append(raw)
    if current:
        tasks.append(current)
    return tasks


def normalize_label(label: str) -> Tuple[str, str]:
    label = label.strip().replace('（', '(').replace('）', ')').replace('：', ':').replace('　', ' ')
    if label.endswith(':'):
        label = label[:-1]
    return label, label.lower()


def parse_task(block: Iterable[str]) -> Task:
    iterator = iter(block)
    first = next(iterator).strip()
    task = Task()
    header = first[2:].strip() if first.startswith('- ') else first
    if '—' in header:
        key, summary = header.split('—', 1)
        task.key = key.strip()
        task.summary = summary.strip()
    elif NUMBERED_TASK_PATTERN.match(header):
        m = NUMBERED_TASK_PATTERN.match(header)
        task.key = header[m.end():].strip() or header
    else:
        task.key = header

    current_section: Optional[str] = None
    for raw in iterator:
        line = raw.rstrip('\n')
        if not line.strip():
            continue
        stripped = line.lstrip()
        candidate = None
        if stripped.startswith('- '):
            candidate = stripped[2:]
        elif stripped.startswith('* '):
            candidate = stripped[2:]
        if candidate is not None:
            if '：' in candidate:
                label_part, value_part = candidate.split('：', 1)
            elif ':' in candidate:
                label_part, value_part = candidate.split(':', 1)
            else:
                label_part, value_part = candidate, ''
            label_norm, label_lower = normalize_label(label_part)
            key = LABEL_MAP.get(label_lower)
            value = value_part.strip()
            if key is None:
                task.other_sections[label_norm].append(value)
                current_section = label_norm
            else:
                if key in LIST_SECTIONS:
                    if value:
                        getattr(task, key).append(value)
                    current_section = key
                else:
                    existing = getattr(task, key)
                    if isinstance(existing, list):
                        getattr(task, key).append(value)
                    else:
                        if existing:
                            setattr(task, key, f"{existing}\n{value}" if value else existing)
                        else:
                            setattr(task, key, value)
                    current_section = key if key in LIST_SECTIONS else None
            continue
        clean = stripped
        if clean.startswith('- '):
            clean = clean[2:].strip()
        if current_section:
            target = current_section
            if target in LIST_SECTIONS:
                getattr(task, target).append(clean)
            else:
                task.other_sections[target].append(clean)
        else:
            task.other_sections['(misc)'].append(clean)
    return task


def categorize(task: Task) -> str:
    text = f"{task.key} {task.summary}".lower()
    for category, keywords in CATEGORY_RULES:
        if any(keyword in text for keyword in keywords):
            return category
    return "General / Cross-cutting"


def clean_branch(branch: str, key: str) -> str:
    branch = branch.strip().strip('`')
    if branch:
        return branch
    if '/' in key:
        return key
    return branch


def suggest_worktree(branch: str) -> str:
    branch = branch.replace('`', '').strip()
    if not branch:
        return ""
    return f"../worktrees/{branch.replace('/', '-')}"


def path_exists(path: str) -> bool:
    return (BASE_DIR / path).exists()


def resolve_domain_path(domain: str, rest: List[str]) -> Optional[str]:
    mapping = {
        'plugins': lambda r: f"packages/plugins/{r[0]}" if r else None,
        'runtime-ui': lambda r: f"packages/runtime-ui/{r[0]}" if r else 'packages/runtime-ui',
        'runtime-worker': lambda r: 'packages/runtime-worker',
        'worker': lambda r: 'packages/runtime-worker',
        'ui': lambda r: f"packages/ui/{r[0]}" if r else 'packages/ui',
        'ui-treeconsole': lambda r: f"packages/ui/treeconsole/{r[0]}" if r else 'packages/ui/treeconsole',
        'ui-dialog': lambda r: 'packages/ui/dialog',
        'app': lambda r: 'app',
        'common': lambda r: 'packages/common-type' if path_exists('packages/common-type') else None,
        'common-type': lambda r: 'packages/common-type',
        'build': lambda r: '.',
        'tooling': lambda r: 'tools',
    }
    resolver = mapping.get(domain)
    candidate = resolver(rest) if resolver else None
    if candidate and path_exists(candidate):
        return candidate
    if domain.startswith('ui-'):
        candidate = f"packages/ui/{domain[3:]}/{rest[0]}" if rest else f"packages/ui/{domain[3:]}"
        if candidate and path_exists(candidate):
            return candidate
    if domain.endswith('plugin'):
        candidate = f"packages/plugins/{domain}"
        if path_exists(candidate):
            return candidate
    return None


def guess_dirs(task: Task) -> str:
    branch_hint = clean_branch(task.branch, task.key)
    candidates: List[str] = []
    for hint in (branch_hint, task.key):
        hint = hint.strip('`')
        parts = hint.split('/')
        if len(parts) < 2:
            continue
        domain = parts[1]
        rest = parts[2:]
        candidate = resolve_domain_path(domain, rest)
        if candidate and candidate not in candidates:
            candidates.append(candidate)
    if not candidates:
        candidates.append('.')
    return ','.join(candidates)


def build_sheet_rows(tasks: List[Task]) -> List[Tuple[str, List[List[str]]]]:
    categories: Dict[str, List[Task]] = defaultdict(list)
    for task in tasks:
        categories[categorize(task)].append(task)
    sheets: List[Tuple[str, List[List[str]]]] = []
    for category in sorted(categories):
        rows: List[List[str]] = [HEADERS]
        for task in sorted(categories[category], key=lambda t: t.key):
            branch = clean_branch(task.branch, task.key)
            rows.append([
                task.key,
                task.summary,
                branch,
                suggest_worktree(branch),
                guess_dirs(task),
                task.dependencies,
                '\n'.join(task.acceptance),
                '\n'.join(task.checklist),
                '\n'.join(task.subtasks),
                '\n'.join(task.rollback),
                task.flags,
                task.scope,
                task.objective,
                task.outcome,
                '\n'.join(task.follow_up),
                '\n'.join(task.tests),
                '\n'.join(task.notes),
                '\n'.join(task.operation_log),
                '\n'.join(task.current_status),
                task.priority,
                task.description,
                task.background,
                task.estimate,
                '\n'.join(
                    f"{k}: {', '.join(v)}"
                    for k, v in task.other_sections.items()
                    if any(val.strip() for val in v)
                ),
            ])
        sheets.append((category, rows))
    return sheets


def ensure_sheet_name(name: str, used: set[str]) -> str:
    base = name[:31]
    candidate = base
    suffix = 1
    while candidate in used:
        suffix += 1
        candidate = f"{base[:28]}-{suffix}" if len(base) > 28 else f"{base}-{suffix}"
    used.add(candidate)
    return candidate


def column_letter(idx: int) -> str:
    result = ''
    n = idx
    while n:
        n, rem = divmod(n - 1, 26)
        result = chr(ord('A') + rem) + result
    return result


def sheet_to_xml(rows: List[List[str]]) -> str:
    lines = [
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
        '  <sheetData>',
    ]
    for r_idx, row in enumerate(rows, start=1):
        lines.append(f'    <row r="{r_idx}">')
        for c_idx, value in enumerate(row, start=1):
            if not value:
                continue
            cell_ref = f"{column_letter(c_idx)}{r_idx}"
            cell_text = escape(value).replace('\n', '&#10;')
            lines.append(
                f'      <c r="{cell_ref}" t="inlineStr"><is><t>{cell_text}</t></is></c>'
            )
        lines.append('    </row>')
    lines.append('  </sheetData>')
    lines.append('</worksheet>')
    return '\n'.join(lines)

CONTENT_TYPES_XML = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>'''

ROOT_RELS_XML = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdWorkbook" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rIdApp" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
  <Relationship Id="rIdCore" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>'''

STYLES_XML = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>
  <fills count="1"><fill><patternFill patternType="none"/></fill></fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>'''


def workbook_xml(sheet_names: List[str]) -> str:
    sheets_xml = '\n'.join(
        f'    <sheet name="{escape(name)}" sheetId="{idx}" r:id="rId{idx}"/>'
        for idx, name in enumerate(sheet_names, start=1)
    )
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">\n'
        '  <sheets>\n'
        f'{sheets_xml}\n'
        '  </sheets>\n'
        '</workbook>'
    )


def workbook_rels(sheet_count: int) -> str:
    relationships = '\n'.join(
        f'  <Relationship Id="rId{idx}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet{idx}.xml"/>'
        for idx in range(1, sheet_count + 1)
    )
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n'
        f'{relationships}\n'
        '  <Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>\n'
        '</Relationships>'
    )


def app_xml(sheet_count: int) -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" '
        'xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">\n'
        '  <Application>codex-export</Application>\n'
        '  <DocSecurity>0</DocSecurity>\n'
        '  <SharedDoc>False</SharedDoc>\n'
        f'  <Sheets>{sheet_count}</Sheets>\n'
        '</Properties>'
    )


def core_xml() -> str:
    now = datetime.utcnow().isoformat() + 'Z'
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" '
        'xmlns:dc="http://purl.org/dc/elements/1.1/" '
        'xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" '
        'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">\n'
        '  <dc:creator>codex</dc:creator>\n'
        '  <cp:lastModifiedBy>codex</cp:lastModifiedBy>\n'
        f'  <dcterms:created xsi:type="dcterms:W3CDTF">{now}</dcterms:created>\n'
        f'  <dcterms:modified xsi:type="dcterms:W3CDTF">{now}</dcterms:modified>\n'
        '</cp:coreProperties>'
    )


def write_workbook(path: Path, sheets: List[Tuple[str, List[List[str]]]]) -> None:
    used_names: set[str] = set()
    sheet_entries: List[Tuple[str, str]] = []
    if not sheets:
        sheets = [("Empty", [HEADERS])]
    for idx, (name, rows) in enumerate(sheets, start=1):
        sheet_name = ensure_sheet_name(name, used_names)
        sheet_xml = sheet_to_xml(rows)
        sheet_entries.append((sheet_name, sheet_xml))
    with ZipFile(path, 'w', ZIP_DEFLATED) as zf:
        zf.writestr('[Content_Types].xml', CONTENT_TYPES_XML)
        zf.writestr('_rels/.rels', ROOT_RELS_XML)
        zf.writestr('xl/styles.xml', STYLES_XML)
        zf.writestr('docProps/app.xml', app_xml(len(sheet_entries)))
        zf.writestr('docProps/core.xml', core_xml())
        zf.writestr('xl/workbook.xml', workbook_xml([name for name, _ in sheet_entries]))
        zf.writestr('xl/_rels/workbook.xml.rels', workbook_rels(len(sheet_entries)))
        for idx, (_, xml) in enumerate(sheet_entries, start=1):
            zf.writestr(f'xl/worksheets/sheet{idx}.xml', xml)


def main() -> None:
    text = TASKS_MD.read_text()
    sections = load_sections(text)
    doing_section = sections.get('### Doing（進行中） <a id="kanban-doing"></a>')
    if not doing_section:
        raise SystemExit('Doing section not found in TASKS.md')
    doing_tasks = [parse_task(block) for block in parse_section(doing_section)]

    todo_tasks: List[Task] = []
    for heading, section in sections.items():
        if 'ToDo' in heading:
            todo_tasks.extend(parse_task(block) for block in parse_section(section))

    write_workbook(DOING_FILE, build_sheet_rows(doing_tasks))
    write_workbook(TODO_FILE, build_sheet_rows(todo_tasks))
    print('Export complete:', DOING_FILE, TODO_FILE)


if __name__ == '__main__':
    main()
