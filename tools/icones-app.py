"""Ícones do app (PWA) a partir da logo do Studio: o "EVO" serifado de EVOLUTION (na logo, as três letras se tocam
e saem juntas no recorte), em ouro, sobre o preto do site, com os dois fios da logo acima e abaixo.

Uso: python3 tools/icones-app.py site/img/logo-evolution-mask.webp site/img/app
Sai: icone-192.png, icone-512.png, icone-maskable-512.png (desenho dentro da zona segura de 80%),
     apple-touch-icon.png (180) e favicon-32.png.
"""
import sys, os
import numpy as np
from PIL import Image, ImageDraw

SRC, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
FUNDO = (20, 17, 13)                  # o preto quente do site (--cine-bg)
OURO_CLARO, OURO_ESCURO = (240, 208, 130), (176, 128, 52)

alfa = np.array(Image.open(SRC).split()[-1])
# a linha do EVOLUTION fica entre os fios: y 115-355 na logo de 1600x500
faixa = alfa[115:356]
cols = np.where(faixa.max(0) > 100)[0]
# o primeiro bloco de colunas com tinta, até a primeira coluna vazia: "EVO", que se tocam na logo
x0 = cols[0]
x1 = x0
while x1 + 1 < faixa.shape[1] and faixa[:, x1 + 1].max() > 100:
    x1 += 1
ys = np.where(faixa[:, x0:x1 + 1].max(1) > 100)[0]
e = Image.fromarray(faixa[ys[0]:ys[-1] + 1, x0:x1 + 1])

def icone(lado, ocupa):
    """ocupa: largura do EVO em fração do lado (o maskable usa menos, para caber na zona segura de 80%)"""
    escala = 4                            # desenha grande e reduz: bordas lisas
    L = lado * escala
    img = Image.new("RGB", (L, L), FUNDO)
    w = int(L * ocupa)
    h = int(e.height * w / e.width)
    m = e.resize((w, h), Image.LANCZOS)
    # degradê de ouro de cima para baixo, como o metal da logo
    t = np.linspace(0, 1, h)[:, None, None]
    cor = (np.array(OURO_CLARO) * (1 - t) + np.array(OURO_ESCURO) * t).astype(np.uint8)
    ouro = Image.fromarray(np.repeat(cor, w, axis=1))
    x, y = (L - w) // 2, (L - h) // 2
    img.paste(ouro, (x, y), m)
    # os dois fios da logo, acima e abaixo do E
    d = ImageDraw.Draw(img)
    fio = max(2, int(L * 0.012))
    meia = w // 2
    for yy in (y - int(L * 0.07), y + h + int(L * 0.07) - fio):
        d.rectangle([L // 2 - meia, yy, L // 2 + meia, yy + fio], fill=(214, 174, 92))
    return img.resize((lado, lado), Image.LANCZOS)

icone(192, 0.74).save(os.path.join(OUT, "icone-192.png"), optimize=True)
icone(512, 0.74).save(os.path.join(OUT, "icone-512.png"), optimize=True)
icone(512, 0.6).save(os.path.join(OUT, "icone-maskable-512.png"), optimize=True)
icone(180, 0.74).save(os.path.join(OUT, "apple-touch-icon.png"), optimize=True)
icone(32, 0.86).save(os.path.join(OUT, "favicon-32.png"), optimize=True)
print("EVO:", e.size, "->", OUT)
