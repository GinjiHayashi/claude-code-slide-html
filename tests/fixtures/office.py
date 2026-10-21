"""テスト用の小さな資料（.xlsx・.docx・.pptx・.pdf）を作る。使い方：python office.py <出力先のフォルダ>

中身は最小限の XML だけ（Office で開けることまでは確かめない。to-md.py が読む部分だけ）。
"""
import os
import sys
import zipfile

out = sys.argv[1]
os.makedirs(out, exist_ok=True)
REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"


def write_zip(name, files):
    with zipfile.ZipFile(os.path.join(out, name), "w") as z:
        for k, v in files.items():
            z.writestr(k, v)


write_zip("実績.xlsx", {
    "xl/workbook.xml": f'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="{REL}"><sheets><sheet name="9月" sheetId="1" r:id="rId1"/></sheets></workbook>',
    "xl/_rels/workbook.xml.rels": '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
    "xl/worksheets/sheet1.xml": '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'
    '<row r="1"><c r="A1" t="inlineStr"><is><t>部署</t></is></c><c r="B1" t="inlineStr"><is><t>時間</t></is></c></row>'
    '<row r="2"><c r="A2" t="inlineStr"><is><t>総務</t></is></c><c r="B2"><v>6</v></c></row></sheetData></worksheet>',
})

W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
write_zip("方針.docx", {
    "word/document.xml": f'<w:document xmlns:w="{W}"><w:body>'
    '<w:p><w:pPr><w:pStyle w:val="1"/></w:pPr><w:r><w:t>背景</w:t></w:r></w:p>'
    '<w:p><w:r><w:t>月次レポートを</w:t></w:r><w:r><w:t>自動化する。</w:t></w:r></w:p>'
    '<w:tbl><w:tr><w:tc><w:p><w:r><w:t>項目</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>値</w:t></w:r></w:p></w:tc></w:tr>'
    '<w:tr><w:tc><w:p><w:r><w:t>部門数</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>6</w:t></w:r></w:p></w:tc></w:tr></w:tbl>'
    '</w:body></w:document>',
})

A = "http://schemas.openxmlformats.org/drawingml/2006/main"
P = "http://schemas.openxmlformats.org/presentationml/2006/main"
slide = lambda texts: f'<p:sld xmlns:p="{P}" xmlns:a="{A}"><p:cSld><p:spTree>' + "".join(f"<p:sp><p:txBody><a:p><a:r><a:t>{t}</a:t></a:r></a:p></p:txBody></p:sp>" for t in texts) + "</p:spTree></p:cSld></p:sld>"
write_zip("報告.pptx", {
    "ppt/slides/slide2.xml": slide(["結論", "40時間が6時間に"]),
    "ppt/slides/slide10.xml": slide(["おわり"]),
    "ppt/slides/slide1.xml": slide(["表紙"]),
    "ppt/notesSlides/notesSlide2.xml": slide(["試行の結果を話す", "2"]),
})


def pdf(name, text):
    """文字が1行だけの PDF（text が空なら、文字のない PDF）"""
    content = f"BT /F1 12 Tf 72 720 Td ({text}) Tj ET".encode() if text else b""
    objs = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
        b"<< /Length %d >>\nstream\n" % len(content) + content + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    data = b"%PDF-1.4\n"
    offsets = []
    for i, o in enumerate(objs, 1):
        offsets.append(len(data))
        data += b"%d 0 obj\n" % i + o + b"\nendobj\n"
    xref = len(data)
    data += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objs) + 1) + b"".join(b"%010d 00000 n \n" % x for x in offsets)
    data += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objs) + 1, xref)
    with open(os.path.join(out, name), "wb") as f:
        f.write(data)


pdf("text.pdf", "Monthly report: 40 hours per month across six departments")
pdf("scan.pdf", "")
