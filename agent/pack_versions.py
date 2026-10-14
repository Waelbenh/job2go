"""Remaking a pack (the web app's "Remake pack" button, through serve.py).

serve.py runs `tailor.py <number> --suffix remake`, so the new pack is written NEXT to the old one
(..._CV_remake.pdf, prep_remake.md ...). Only when it is complete:
  swap_in()  moves the old files into old/<date-time>/ (just in case) and renames the new
             files to the normal names, so the new pack replaces the old one.
If tailor.py stopped half-way:
  discard()  deletes the unfinished "_remake" files; the old pack stays as it was.
polished() tells if the pack got its recruiter-review "polish" step (it is skipped when no AI
was available for it, e.g. Claude had reached its limit).
"""

import shutil
from datetime import datetime
from pathlib import Path

SUFFIX = "remake"
# Files that belong to one version of a pack (the learning guide and old/ are left alone)
PACK_PATTERNS = ["*_CV*.docx", "*_CV*.pdf", "*_Letter*.docx", "*_Letter*.pdf", "content*.json", "prep*.md", "prep*.html"]
# What tailor.py writes into prep.md when the polish step could not run
NOT_POLISHED = ["The review step could not run", "The improved version could not be scored"]


def _new_files(folder: Path) -> list[Path]:
    return [f for f in folder.iterdir() if f.is_file() and f.stem.endswith(f"_{SUFFIX}")]


def complete(folder: Path) -> bool:
    """The new version has its CV, letter and prep sheet."""
    names = [f.name for f in _new_files(folder)]
    return all(any(part in n and n.endswith(ext) for n in names)
               for part, ext in (("_CV_", ".pdf"), ("_Letter_", ".pdf"), ("prep_", ".html")))


def swap_in(folder: Path) -> Path:
    """New version in, old version to old/<date-time>/. Returns where the old files went."""
    old = folder / "old" / f"{datetime.now():%Y-%m-%d_%H%M%S}"
    old.mkdir(parents=True)
    new = set(_new_files(folder))
    for pattern in PACK_PATTERNS:
        for f in folder.glob(pattern):
            if f.is_file() and f not in new:
                shutil.move(str(f), old / f.name)
    for f in new:  # Name_Company_CV_remake.pdf -> Name_Company_CV.pdf, prep_remake.md -> prep.md
        f.rename(f.with_name(f.stem[: -len(SUFFIX) - 1] + f.suffix))
    return old


def discard(folder: Path) -> None:
    for f in _new_files(folder):
        f.unlink()


def polished(folder: str) -> bool:
    """False when the newest prep sheet says the polish (recruiter review) step was skipped."""
    preps = sorted(Path(folder).glob("prep*.md"), key=lambda p: p.stat().st_mtime) if folder else []
    if not preps:
        return True
    text = preps[-1].read_text(encoding="utf-8", errors="ignore")
    return not any(phrase in text for phrase in NOT_POLISHED)
