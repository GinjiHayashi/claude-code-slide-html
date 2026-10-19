"""Noto Sans JP と Roboto Mono（どちらも OFL-1.1）を、スライドで使っている文字だけにサブセット化し、@font-face の CSS を書き出す。

使い方：.venv/bin/python font-subset.py <スライドの HTML> <書き出す CSS>
- フォントは npm の @fontsource/noto-sans-jp と @fontsource/roboto-mono（registry.yaml の noto-sans-jp・roboto-mono）。
  文字の範囲ごとに分かれた woff2 から、使う文字を含むものだけを選び、その中も使う文字だけに絞る。
- Noto Sans JP はすべての文字が対象で、太さは 400（標準）と 700（太字）。Roboto Mono は <code> の中と font-mono のクラスの要素の文字だけで、太さは 400。
  コードがなければ Roboto Mono は入れない。
- 道具は fontTools と Brotli（registry.yaml の fonttools・brotli。ビルドの時だけ使う）。
- サブセット化はフォントの改変にあたるが、名前はそのまま（どちらも予約フォント名を持たない、または含まないので OFL 上かまわない）。
"""
import base64, html, io, os, re, sys
from fontTools import subset
from fontTools.ttLib import TTFont

SRC, DEST = sys.argv[1], sys.argv[2]
FS = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '..', 'node_modules', '@fontsource')  # リポジトリの直下の node_modules
doc = open(SRC, encoding='utf-8').read()


def used(part):
    text = html.unescape(re.sub(r'<style.*?</style>|<[^>]+>', ' ', part, flags=re.S))
    return {ord(c) for c in text if not c.isspace()}


chars = used(doc) | set(range(0x20, 0x7f))  # ASCII は常に入れる（ページ番号など、表示時に足される文字のため）
# <code> の中と、font-mono のクラスの要素（dirtree の名前、canvas の cubes の番号など。タグは問わない）のすぐ中の文字
mono = re.findall(r'<code\b.*?</code>', doc, flags=re.S) + re.findall(r'<\w+\b[^>]*\bfont-mono\b[^>]*>([^<]*)', doc)
code = used(' '.join(mono))
# (フォント名, @fontsource のフォルダ, 太さ, 対象の文字)
ascii = set(range(0x20, 0x7f))  # コードの空白（字下げ）も Roboto Mono の幅にするため、コードがあれば ASCII も入れる
FONTS = [('Noto Sans JP', 'noto-sans-jp', w, chars) for w in (400, 700)] + ([('Roboto Mono', 'roboto-mono', 400, code | ascii)] if code else [])


def ranges(spec):
    for part in spec.split(','):
        a, _, b = part.strip()[2:].partition('-')
        yield int(a, 16), int(b or a, 16)


faces, size = [], 0
for family, folder, weight, want in FONTS:
    css = open(os.path.join(FS, folder, f'{weight}.css'), encoding='utf-8').read()
    for m in re.finditer(r"url\(\./files/([^)]+?\.woff2)\).*?unicode-range: ([^;]+);", css, re.S):
        fname, spec = m.groups()
        rs = list(ranges(spec))
        need = {c for c in want if any(a <= c <= b for a, b in rs)}
        if not need:
            continue
        font = TTFont(os.path.join(FS, folder, 'files', fname), recalcTimestamp=False)  # 保存の時刻を head.modified に書かない（毎回同じバイト列にする）
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
        faces.append(f'@font-face{{font-family:"{family}";font-style:normal;font-weight:{weight};font-display:block;'
                     f'src:url(data:font/woff2;base64,{b64}) format("woff2");unicode-range:{urange}}}')

open(DEST, 'w', encoding='utf-8').write('/* Noto Sans JP・Roboto Mono（SIL Open Font License 1.1）。使っている文字だけにサブセット化 */\n' + '\n'.join(faces) + '\n')
print(f'文字 {len(chars)}（コード {len(code)}）、フォントの断片 {len(faces)}、{size // 1024} KB')
