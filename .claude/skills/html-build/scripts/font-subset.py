"""Noto Sans JP（OFL-1.1）を、スライドで使っている文字だけにサブセット化し、@font-face の CSS を書き出す。

使い方：python3 font-subset.py <スライドの HTML> <書き出す CSS>
- フォントは npm の @fontsource/noto-sans-jp（registry.yaml の noto-sans-jp）。文字の範囲ごとに分かれた woff2 から、
  使う文字を含むものだけを選び、その中も使う文字だけに絞る。太さは 400（標準）と 700（太字）。
- 道具は fontTools と Brotli（registry.yaml の fonttools・brotli。ビルドの時だけ使う）。
- サブセット化はフォントの改変にあたるが、名前は「Noto Sans JP」のまま（予約フォント名「Source」を含まないので OFL 上かまわない）。
"""
import base64, html, io, os, re, sys
from fontTools import subset
from fontTools.ttLib import TTFont

SRC, DEST = sys.argv[1], sys.argv[2]
FS = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '..', 'node_modules', '@fontsource', 'noto-sans-jp')  # リポジトリの直下の node_modules
doc = open(SRC, encoding='utf-8').read()
text = html.unescape(re.sub(r'<style.*?</style>|<[^>]+>', ' ', doc, flags=re.S))
chars = {ord(c) for c in text if not c.isspace()} | set(range(0x20, 0x7f))  # ASCII は常に入れる（ページ番号など、表示時に足される文字のため）


def ranges(spec):
    for part in spec.split(','):
        a, _, b = part.strip()[2:].partition('-')
        yield int(a, 16), int(b or a, 16)


faces, size = [], 0
for weight in (400, 700):
    css = open(os.path.join(FS, f'{weight}.css'), encoding='utf-8').read()
    for m in re.finditer(r"url\(\./files/([^)]+?\.woff2)\).*?unicode-range: ([^;]+);", css, re.S):
        fname, spec = m.groups()
        rs = list(ranges(spec))
        need = {c for c in chars if any(a <= c <= b for a, b in rs)}
        if not need:
            continue
        font = TTFont(os.path.join(FS, 'files', fname), recalcTimestamp=False)  # 保存の時刻を head.modified に書かない（毎回同じバイト列にする）
        opt = subset.Options()
        opt.flavor = 'woff2'
        sub = subset.Subsetter(opt)
        sub.populate(unicodes=need)
        sub.subset(font)
        buf = io.BytesIO()
        font.flavor = 'woff2'
        font.save(buf)
        size += buf.tell()
        b64 = base64.b64encode(buf.getvalue()).decode()
        urange = ','.join(f'U+{c:X}' for c in sorted(need))
        faces.append(f'@font-face{{font-family:"Noto Sans JP";font-style:normal;font-weight:{weight};font-display:block;'
                     f'src:url(data:font/woff2;base64,{b64}) format("woff2");unicode-range:{urange}}}')

open(DEST, 'w', encoding='utf-8').write('/* Noto Sans JP（SIL Open Font License 1.1）。使っている文字だけにサブセット化 */\n' + '\n'.join(faces) + '\n')
print(f'文字 {len(chars)}、フォントの断片 {len(faces)}、{size // 1024} KB')
