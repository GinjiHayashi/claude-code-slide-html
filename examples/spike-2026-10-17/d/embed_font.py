"""方式B の deck.html に、使っている文字だけに絞った Noto Sans JP（OFL-1.1）を埋め込む"""
import base64, io, re, sys, html
from fontTools import subset
from fontTools.ttLib import TTFont

SRC, DEST = sys.argv[1], sys.argv[2]
FS = 'node_modules/@fontsource/noto-sans-jp/'
doc = open(SRC, encoding='utf-8').read()
text = html.unescape(re.sub(r'<style.*?</style>|<[^>]+>', ' ', doc, flags=re.S))
chars = {ord(c) for c in text if not c.isspace()} | set(range(0x20, 0x7f))

def ranges(spec):
    for part in spec.split(','):
        a, _, b = part.strip()[2:].partition('-')
        yield int(a, 16), int(b or a, 16)

faces = []
for weight in (400, 700):
    css = open(f'{FS}{weight}.css', encoding='utf-8').read()
    for m in re.finditer(r"url\(\./files/([^)]+?\.woff2)\).*?unicode-range: ([^;]+);", css, re.S):
        fname, spec = m.groups()
        rs = list(ranges(spec))
        need = {c for c in chars if any(a <= c <= b for a, b in rs)}
        if not need:
            continue
        font = TTFont(f'{FS}files/{fname}')
        opt = subset.Options(); opt.flavor = 'woff2'
        sub = subset.Subsetter(opt); sub.populate(unicodes=need); sub.subset(font)
        buf = io.BytesIO(); font.flavor = 'woff2'; font.save(buf)
        b64 = base64.b64encode(buf.getvalue()).decode()
        urange = ','.join(f'U+{c:X}' for c in sorted(need))
        faces.append(f"@font-face{{font-family:'Noto Sans JP';font-weight:{weight};"
                     f"src:url(data:font/woff2;base64,{b64}) format('woff2');unicode-range:{urange};}}")

style = '<style data-asset-id="font:noto-sans-jp">\n/* Noto Sans JP, SIL Open Font License 1.1 */\n' + '\n'.join(faces) + '\n</style>\n'
out = doc.replace('<style>', style + '<style>', 1).replace('（スパイク：方式B）', '（スパイク：方式B＋フォント埋め込み）')
open(DEST, 'w', encoding='utf-8').write(out)
print(f'chars={len(chars)} faces={len(faces)} font_css_bytes={len(style)} total_bytes={len(out.encode())}')
