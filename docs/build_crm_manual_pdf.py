"""
Build CRM_User_Manual_Data_Entry.pdf from CRM_User_Manual_Data_Entry.md.

Requires: pip install markdown xhtml2pdf
Run from repo root: python docs/build_crm_manual_pdf.py
"""
from __future__ import annotations

import io
import sys
from pathlib import Path

import markdown
from xhtml2pdf import pisa

DOCS = Path(__file__).resolve().parent
MD_PATH = DOCS / "CRM_User_Manual_Data_Entry.md"
PDF_PATH = DOCS / "CRM_User_Manual_Data_Entry.pdf"

STYLE = """
@page { size: A4; margin: 18mm 15mm 20mm 15mm; }
body { font-family: Helvetica, Arial, sans-serif; font-size: 10pt; line-height: 1.38; color: #111; }
h1 { font-size: 17pt; border-bottom: 1px solid #bbb; padding-bottom: 6px; margin-top: 0; }
h2 { font-size: 13pt; margin-top: 16px; page-break-after: avoid; }
h3 { font-size: 11pt; margin-top: 12px; page-break-after: avoid; }
table { border-collapse: collapse; width: 100%; margin: 8px 0 12px 0; }
th, td { border: 1px solid #666; padding: 4px 5px; vertical-align: top; font-size: 8pt; }
th { background: #eaeaea; }
code { font-size: 8.5pt; }
pre { background: #f2f2f2; padding: 6px; font-size: 7.5pt; white-space: pre-wrap; word-break: break-word; }
hr { margin: 12px 0; border: none; border-top: 1px solid #ccc; }
ul, ol { margin: 6px 0 10px 16px; }
li { margin-bottom: 3px; }
a { color: #0a5; text-decoration: none; }
blockquote { margin: 8px 0; padding-left: 10px; border-left: 3px solid #ccc; color: #333; }
"""


def main() -> int:
    if not MD_PATH.is_file():
        print(f"Missing {MD_PATH}", file=sys.stderr)
        return 1
    md_text = MD_PATH.read_text(encoding="utf-8")
    body = markdown.markdown(
        md_text,
        extensions=[
            "tables",
            "fenced_code",
            "nl2br",
        ],
    )
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>Voltmate CRM User Manual</title>
<style>{STYLE}</style>
</head>
<body>
{body}
</body>
</html>"""

    pdf_bytes = io.BytesIO()
    result = pisa.CreatePDF(
        io.BytesIO(html.encode("utf-8")),
        dest=pdf_bytes,
        encoding="utf-8",
    )
    if result.err:
        print("xhtml2pdf reported errors during conversion.", file=sys.stderr)
        return 1
    PDF_PATH.write_bytes(pdf_bytes.getvalue())
    print(f"Wrote {PDF_PATH} ({PDF_PATH.stat().st_size // 1024} KB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
