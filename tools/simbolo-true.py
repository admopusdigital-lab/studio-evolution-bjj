"""Vetoriza o símbolo (o monograma) da Equipe TRUE a partir da logo oficial em PNG.

Recorta o monograma de tools/fontes/logo-true.png, amplia, acha o contorno com marching squares
(no nível de 50% de tinta), liga os segmentos em laços fechados e simplifica com Ramer-Douglas-Peucker.
Sai um SVG com um único path (fill-rule evenodd), pronto para animar traço e preenchimento.

Uso: python3 tools/simbolo-true.py tools/fontes/logo-true.png site/img/true-simbolo.svg
"""
import sys
import numpy as np
from PIL import Image

SRC, OUT = sys.argv[1], sys.argv[2]
BOX = (370, 335, 780, 880)       # o monograma dentro da logo oficial (1138x1150)
UP = 3                           # amplia antes de achar o contorno, para as curvas ficarem lisas
EPS = 0.9                        # tolerância da simplificação, em pixels ampliados

im = Image.open(SRC).convert("L").crop(BOX)
W0, H0 = im.size
big = im.resize((W0 * UP, H0 * UP), Image.LANCZOS)
f = 1 - np.asarray(big, dtype=np.float64) / 255          # 1 = tinta
f = np.pad(f, 2)                                          # borda vazia: todo contorno fecha
H, W = f.shape

# ---------- marching squares ----------
# cada ponto do contorno fica numa aresta da grade; a aresta é a chave que liga um segmento ao próximo
def edge_point(key):
    kind, i, j = key
    if kind == "h":                                       # aresta horizontal (i,j)-(i,j+1)
        a, b = f[i, j], f[i, j + 1]
        t = (0.5 - a) / (b - a)
        return (j + t, i)
    a, b = f[i, j], f[i + 1, j]                           # aresta vertical (i,j)-(i+1,j)
    t = (0.5 - a) / (b - a)
    return (j, i + t)

ins = f >= 0.5
c = (ins[:-1, :-1] * 8) | (ins[:-1, 1:] * 4) | (ins[1:, 1:] * 2) | (ins[1:, :-1] * 1)
nxt = {}
ii, jj = np.nonzero((c > 0) & (c < 15))
for i, j in zip(ii, jj):
    k = c[i, j]
    top, right, bottom, left = ("h", i, j), ("v", i, j + 1), ("h", i + 1, j), ("v", i, j)
    # segmentos orientados com a tinta à direita de quem anda (sentido consistente para o evenodd)
    table = {
        1: [(bottom, left)], 2: [(right, bottom)], 3: [(right, left)], 4: [(top, right)],
        5: [(top, left), (bottom, right)], 6: [(top, bottom)], 7: [(top, left)], 8: [(left, top)],
        9: [(bottom, top)], 10: [(left, bottom), (right, top)], 11: [(right, top)], 12: [(left, right)],
        13: [(bottom, right)], 14: [(left, bottom)],
    }
    for a, b in table[int(k)]:
        nxt[a] = b

# ---------- liga os segmentos em laços ----------
loops, seen = [], set()
for start in list(nxt.keys()):
    if start in seen:
        continue
    loop, k = [], start
    while k not in seen and k in nxt:
        seen.add(k)
        loop.append(edge_point(k))
        k = nxt[k]
    if len(loop) > 8:
        loops.append(np.array(loop))

# ---------- simplificação (Ramer-Douglas-Peucker) ----------
def rdp(pts, eps):
    if len(pts) < 3:
        return pts
    a, b = pts[0], pts[-1]
    ab = b - a
    n = np.hypot(*ab)
    v = pts - a
    d = np.abs(ab[0] * v[:, 1] - ab[1] * v[:, 0]) / n if n else np.hypot(v[:, 0], v[:, 1])
    k = int(np.argmax(d))
    if d[k] > eps:
        return np.vstack([rdp(pts[: k + 1], eps)[:-1], rdp(pts[k:], eps)])
    return np.vstack([a, b])

def simplify_loop(p):
    # parte o laço no ponto mais distante do primeiro, simplifica as duas metades e junta
    k = int(np.argmax(np.hypot(*(p - p[0]).T)))
    a = rdp(np.vstack([p[: k + 1]]), EPS)
    b = rdp(np.vstack([p[k:], p[:1]]), EPS)
    return np.vstack([a[:-1], b[:-1]])

paths = []
for p in loops:
    q = simplify_loop(p)
    q = (q - 2) / UP                                       # volta à escala do recorte (tira o pad)
    paths.append("M" + " L".join(f"{x:.2f} {y:.2f}" for x, y in q) + " Z")

d = " ".join(paths)
svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W0} {H0}" width="{W0}" height="{H0}">'
       f'<path fill-rule="evenodd" d="{d}"/></svg>\n')
open(OUT, "w").write(svg)
print("laços:", len(paths), "pontos:", sum(p.count(" L") + 1 for p in paths), "bytes:", len(svg))
