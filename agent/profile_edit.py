"""Edits profile.yaml from the new web app's "My profile" page (through serve.py).

profile.yaml is written by hand and full of comments (the AI reads them too), so it is never
rewritten as a whole. Saving one section (e.g. `experience`) works like this:
  1. a dated backup copy goes to backup/profile/,
  2. ONLY that section's lines are replaced by the new value (written in the same style:
     short lists like skills stay on one line, long texts become "|" blocks),
  3. comments on that section's lines (e.g. `angles:  # ...`) are put back,
  4. the whole file is read again: if it does not load, or any OTHER section changed,
     the backup is put back and nothing is saved.
Every comment and section outside the edited one stays exactly as it was.
The app never adds anything itself: it only saves what you typed.
"""

import re
import shutil
from datetime import datetime
from pathlib import Path

import yaml

PROFILE = Path("profile.yaml")
BACKUPS = Path("backup/profile")
# The sections the page can save, and what kind of value each one must be
SECTIONS = {
    "name": str, "location": str, "headline": str, "contact": dict, "summary": str,
    "languages": list, "education": list, "projects": list, "experience": list,
    "skills": dict, "tools_inventory": dict, "what_i_want": str, "deal_breakers": str,
}
REQUIRED = ["name"]


def load() -> dict:
    return yaml.safe_load(PROFILE.read_text(encoding="utf-8")) or {}


class _Dumper(yaml.SafeDumper):
    """Writes YAML that looks like the hand-written file."""

    def increase_indent(self, flow=False, indentless=False):
        return super().increase_indent(flow, False)  # list items indented under their key, like the file


class _OneLine(list):
    """A list written on one line: [a, b, c] (the file writes skills and focus areas like that)"""


class _Quoted(str):
    """A text written in "double quotes" (the file quotes its angles and some highlights)"""


def _text(dumper, value: str):
    # texts with line breaks as a "|" block, like summary: |
    return dumper.represent_scalar("tag:yaml.org,2002:str", value, style="|" if "\n" in value else None)


_Dumper.add_representer(str, _text)
_Dumper.add_representer(_Quoted, lambda d, v: d.represent_scalar("tag:yaml.org,2002:str", str(v), style='"'))
_Dumper.add_representer(_OneLine, lambda d, v: d.represent_sequence("tag:yaml.org,2002:seq", list(v), flow_style=True))


def _styles(block: str) -> tuple[set, set]:
    """How the hand-written section writes things: which keys have one-line lists (`key: [`),
    and which texts are in double quotes."""
    one_line = set(re.findall(r"^\s*(?:- )?([A-Za-z_]+): \[", block, re.M))
    quoted = {yaml.safe_load(q) for q in re.findall(r'"(?:[^"\\]|\\.)*"', block)}
    return one_line, quoted


def _styled(value, one_line: set, quoted: set, key: str = ""):
    """The value with the same styles as before, so saving changes only what you changed.
    Lists under a key that was one line stay one line; texts that were quoted stay quoted;
    a NEW short list of words (no example in the file) is written on one line too."""
    if isinstance(value, dict):
        return {k: _styled(v, one_line, quoted, k) for k, v in value.items()}
    if isinstance(value, list):
        items = [_styled(v, one_line, quoted) for v in value]
        words = bool(value) and all(isinstance(v, str) and len(v) < 60 for v in value)
        return _OneLine(items) if key in one_line or (words and key not in _block_keys) else items
    if isinstance(value, str) and value in quoted:
        return _Quoted(value)
    return value


_block_keys: set = set()  # keys whose lists the file writes one item per line (filled per save)


def _clean(value):
    """The page sends text for everything; turn "2026" back into a number where the file had one,
    trim spaces and drop empty list items."""
    if isinstance(value, dict):
        return {str(k): _clean(v) for k, v in value.items()}
    if isinstance(value, list):
        items = [_clean(v) for v in value]
        return [v for v in items if v not in ("", None, {}, [])]
    if isinstance(value, str):
        text = value.strip()
        if "\n" in text:
            return text + "\n"  # a "|" block ends with a line break, like the hand-written ones
        return int(text) if re.fullmatch(r"\d{1,6}", text) else text
    return value


def _section_lines(lines: list[str], key: str) -> tuple[int, int]:
    """(first, end) line numbers of a top-level section: its `key:` line up to the next top-level
    key. Comment lines and blank lines just before the next key belong to that next key."""
    start = next(i for i, line in enumerate(lines) if re.match(rf"{re.escape(key)}:(\s|$)", line))
    end = start + 1
    while end < len(lines) and not re.match(r"[A-Za-z_]", lines[end]):
        end += 1
    while end - 1 > start and (not lines[end - 1].strip() or lines[end - 1].lstrip().startswith("#")):
        end -= 1  # leave comments / blank lines that sit above the next section
    return start, end


def _inline_comments(block: list[str]) -> dict[str, list[str]]:
    """`angles:  # other wordings ...` -> {"angles": ["  # other wordings ...", ...]}, one per line,
    in order (each project has its own `angles:` line). Key lines only."""
    found: dict[str, list[str]] = {}
    for line in block:
        match = re.match(r"\s*(?:- )?([A-Za-z_]+):(?:\s*)(\s#.*)$", line)
        if match:
            found.setdefault(match.group(1), []).append("  " + match.group(2).strip())
    return found


def save_section(key: str, value) -> tuple[bool, str]:
    if key not in SECTIONS:
        return False, f"Unknown section: {key}."
    value = _clean(value)
    if key in REQUIRED and not value:
        return False, f"{key.capitalize()} can't be empty."
    if not isinstance(value, SECTIONS[key]) and not (SECTIONS[key] is str and isinstance(value, int)):
        return False, f"{key} has the wrong shape."

    original = PROFILE.read_text(encoding="utf-8")
    before = yaml.safe_load(original) or {}
    if before.get(key) == value:
        return True, "Nothing changed."

    lines = original.splitlines(keepends=True)
    dump = lambda v: yaml.dump(v, Dumper=_Dumper, sort_keys=False, allow_unicode=True, width=10_000)
    if key in before:
        start, end = _section_lines(lines, key)
        block = "".join(lines[start:end])
        one_line, quoted = _styles(block)
        # keys whose lists are written one item per line (a "key:" line followed by "- ...")
        _block_keys.clear()
        _block_keys.update(re.findall(r"^\s*(?:- )?([A-Za-z_]+):\s*(?:#.*)?\n\s*- ", block, re.M))
        new_lines = dump({key: _styled(value, one_line, quoted, key)}).splitlines(keepends=True)
        comments = _inline_comments(lines[start:end])
        for i, line in enumerate(new_lines):  # put the inline comments back on their key lines
            match = re.match(r"(\s*(?:- )?)([A-Za-z_]+):\s*$", line)
            if match and comments.get(match.group(2)) and i > 0:
                note = comments[match.group(2)]
                new_lines[i] = line.rstrip("\n") + (note.pop(0) if len(note) > 1 else note[0]) + "\n"
        lines[start:end] = new_lines
    else:  # a new section: at the end
        _block_keys.clear()
        lines += ["\n", dump({key: _styled(value, set(), set(), key)})]
    updated = "".join(lines)

    # Check before writing: it must load, this section must be the new value, the rest unchanged
    try:
        after = yaml.safe_load(updated) or {}
    except yaml.YAMLError as error:
        return False, f"Not saved: the result was not valid ({error})."
    others_same = all(after.get(k) == v for k, v in before.items() if k != key)
    if after.get(key) != value or not others_same:
        return False, "Not saved: the change would have touched other parts of profile.yaml."

    BACKUPS.mkdir(parents=True, exist_ok=True)
    backup = BACKUPS / f"profile_{datetime.now():%Y-%m-%d_%H%M%S}.yaml"
    shutil.copy2(PROFILE, backup)
    PROFILE.write_text(updated, encoding="utf-8")
    return True, f"Saved. The old version is in {backup.as_posix()}."
