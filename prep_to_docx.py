"""prep_to_docx.py - turns a prep.md file into a Word document (prep.docx, same folder).

Usage:  python prep_to_docx.py data/applications/acme_12/prep.md
Handles: # / ## headings, - bullets, numbered lines, tables, **bold** and [links](url).
"""

import re
import sys
from pathlib import Path

from docx import Document
from docx.opc.constants import RELATIONSHIP_TYPE as RT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

BLUE = RGBColor(0x1D, 0x4E, 0x6B)
FONT = "Calibri"
TOKEN = re.compile(r"(\*\*.+?\*\*|\[[^\]]+\]\([^)]+\))")


def add_link(par, text, url):
    """Add a clickable blue link to a paragraph."""
    rel_id = par.part.relate_to(url, RT.HYPERLINK, is_external=True)
    link = OxmlElement("w:hyperlink")
    link.set(qn("r:id"), rel_id)
    run = OxmlElement("w:r")
    props = OxmlElement("w:rPr")
    for tag, attrs in (("w:color", {"w:val": "1D4E6B"}), ("w:u", {"w:val": "single"})):
        el = OxmlElement(tag)
        for k, v in attrs.items():
            el.set(qn(k), v)
        props.append(el)
    run.append(props)
    t = OxmlElement("w:t")
    t.text = text
    run.append(t)
    link.append(run)
    par._p.append(link)


def add_text(par, text, bold=False, size=10.5):
    """Write text into a paragraph, turning **bold** and [links](url) into formatting."""
    for part in TOKEN.split(text):
        if not part:
            continue
        if part.startswith("**") and part.endswith("**"):
            run = par.add_run(part[2:-2])
            run.bold = True
        elif part.startswith("["):
            label, url = re.match(r"\[([^\]]+)\]\(([^)]+)\)", part).groups()
            add_link(par, label, url)
            continue
        else:
            run = par.add_run(part)
            run.bold = bold
        run.font.name, run.font.size = FONT, Pt(size)


def main():
    md = Path(sys.argv[1])
    doc = Document()
    sec = doc.sections[0]
    sec.page_width, sec.page_height = Cm(21.0), Cm(29.7)
    sec.left_margin = sec.right_margin = Cm(2.0)
    sec.top_margin = sec.bottom_margin = Cm(1.8)
    doc.styles["Normal"].font.name = FONT

    lines = md.read_text(encoding="utf-8").splitlines()
    i = 0
    while i < len(lines):
        line = lines[i]
        if line.startswith("# ") or line.startswith("## "):
            level = 1 if line.startswith("# ") else 2
            par = doc.add_paragraph()
            par.paragraph_format.space_before = Pt(14 if level == 2 else 0)
            par.paragraph_format.space_after = Pt(4)
            par.paragraph_format.keep_with_next = True
            run = par.add_run(line.lstrip("# "))
            run.bold, run.font.name = True, FONT
            run.font.size = Pt(18 if level == 1 else 13)
            run.font.color.rgb = BLUE
        elif line.startswith("|"):
            rows = []
            while i < len(lines) and lines[i].startswith("|"):
                cells = [c.strip() for c in lines[i].strip().strip("|").split("|")]
                if not all(set(c) <= set("-: ") for c in cells):  # skip the |---| line
                    rows.append(cells)
                i += 1
            table = doc.add_table(rows=len(rows), cols=len(rows[0]))
            table.style = "Table Grid"
            for r, row in enumerate(rows):
                for c, text in enumerate(row):
                    cell = table.cell(r, c)
                    add_text(cell.paragraphs[0], text, bold=(r == 0), size=10)
            doc.add_paragraph()
            continue
        elif re.match(r"\s*- ", line):
            indent = len(line) - len(line.lstrip())
            par = doc.add_paragraph(style="List Bullet")
            par.paragraph_format.left_indent = Cm(0.8 + indent * 0.2)
            par.paragraph_format.space_after = Pt(2)
            add_text(par, line.strip()[2:])
        elif line.strip():
            par = doc.add_paragraph()
            par.paragraph_format.space_after = Pt(4)
            add_text(par, line.strip())
        i += 1

    out = md.with_suffix(".docx")
    doc.save(out)
    print(f"Saved {out}")


if __name__ == "__main__":
    main()
