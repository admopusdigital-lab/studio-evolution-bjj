"""Gera os mapas das duas faces da medalha 3D (site/medalha3d.js).

Para cada face saem três imagens, em 2048 (sufixo -2k, computador) e 1024 (celular):
- medalha-<face>-orm: R = altura do relevo, G = rugosidade (com marcas de dedo e riscos finos), B = metalicidade
- medalha-<face>-normal: normal map calculado da altura
- medalha-<face>-ao: oclusão nas cavidades do relevo

Frente: a logo da Equipe TRUE (monograma e "BJJ" recortados do PNG oficial em logo_true.png,
textos do anel compostos aqui). Verso: a logo do Studio Evolution (img/logo-evolution-refinada.png).
O fundo é ouro escovado em círculos, os elementos da logo ficam em relevo com esmalte preto por cima,
e a borda é ouro polido.

Uso: python3 tools/medalha-mapas.py <logo_true.png> <logo-evolution.png> <pasta de saída>
"""
import sys, os, math
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

TRUE_PNG, EVO_PNG, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
S = 2048                      # desenha em 2048 (sai em 2048 para o computador e 1024 para o celular)
C = S / 2
FONT_BLACK = "/usr/share/fonts/opentype/inter/Inter-Black.otf"
FONT_SEMI = "/usr/share/fonts/opentype/inter/Inter-SemiBold.otf"

# textos do anel da frente (versão da logo enviada pelo cliente)
TOP = "TRUE"
LEFT = "LEALDADE · HONRA"
RIGHT = "RESPEITO · HUMILDADE"


def blank():
    return Image.new("L", (S, S), 0)


def glyph(ch, font, track):
    """um caractere num quadrado transparente, com o centro no meio do avanço"""
    w = font.getlength(ch) + track
    asc, desc = font.getmetrics()
    size = int(max(w, asc + desc) * 1.6) + 4
    im = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(im)
    d.text((size / 2, size / 2), ch, font=font, fill=255, anchor="mm")
    return im, w


def arc_text(mask, text, font, radius, center_deg, track, outward=True):
    """escreve o texto ao longo do círculo. outward=True: sentido horário, topo para fora (lados e alto);
    outward=False: sentido anti-horário, topo para dentro (texto de baixo, lido da esquerda para a direita)"""
    widths = [font.getlength(ch) + track for ch in text]
    total = sum(widths)
    span = total / radius                      # em radianos
    sign = 1 if outward else -1
    a = math.radians(center_deg) - sign * span / 2
    for ch, w in zip(text, widths):
        mid = a + sign * (w / 2) / radius
        if ch != " ":
            g, _ = glyph(ch, font, 0)
            rot = math.degrees(mid) if outward else math.degrees(mid) - 180
            g = g.rotate(-rot, resample=Image.BICUBIC, expand=False)
            x = C + radius * math.sin(mid)
            y = C - radius * math.cos(mid)
            mask.paste(255, (int(x - g.width / 2), int(y - g.height / 2)), g)
        a += sign * w / radius


def paste_dark(mask, src, box, scale, center):
    """recorta do PNG os traços escuros (o monograma, o BJJ) e cola na escala pedida"""
    im = Image.open(src).convert("L").crop(box)
    a = 255 - np.array(im)
    a = np.clip((a.astype(np.float32) - 40) * 1.4, 0, 255).astype(np.uint8)
    m = Image.fromarray(a).resize((int(im.width * scale), int(im.height * scale)), Image.LANCZOS)
    mask.paste(255, (int(center[0] - m.width / 2), int(center[1] - m.height / 2)), m)


def alpha_logo(mask, src, width, center):
    im = Image.open(src).convert("RGBA")
    a = im.split()[3]
    h = int(im.height * width / im.width)
    a = a.resize((width, h), Image.LANCZOS)
    mask.paste(255, (int(center[0] - width / 2), int(center[1] - h / 2)), a)


yy, xx = np.mgrid[0:S, 0:S].astype(np.float32)
rr = np.hypot(xx - C + 0.5, yy - C + 0.5) / (S / 2)          # 0 no centro, 1 na borda
ang = np.arctan2(yy - C, xx - C)


def smooth(m, rad):
    return np.array(Image.fromarray(m).filter(ImageFilter.GaussianBlur(rad))).astype(np.float32) / 255


def build(elements, enamel_on):
    E = np.array(elements)
    # relevo dos elementos com chanfro arredondado
    eb = smooth(E, 5.0)
    hE = np.clip((eb - 0.08) / 0.84, 0, 1)
    hE = hE * hE * (3 - 2 * hE)
    inner = np.clip((smooth(E, 3.0) - 0.62) / 0.16, 0, 1) * np.clip((hE - 0.85) / 0.1, 0, 1) if enamel_on else np.zeros_like(hE)
    # borda polida: um aro alto e uma linha fina por dentro
    rim = np.clip((rr - 0.925) / 0.02, 0, 1) * np.clip((1.0 - rr) / 0.012, 0, 1)
    rim = rim * rim * (3 - 2 * rim)
    line = np.exp(-((rr - 0.885) / 0.0045) ** 2)
    # campo de ouro escovado em círculos (torneado), com um pouco de irregularidade
    rng = np.random.default_rng(3)
    jitter = np.array(Image.fromarray((rng.random((S // 8, S // 8)) * 255).astype(np.uint8)).resize((S, S), Image.BICUBIC)).astype(np.float32) / 255
    brush = 0.5 + 0.5 * np.sin(rr * S * 1.9 + jitter * 6.0)
    field = 1 - np.maximum(np.maximum(hE, rim), line * 0.8)
    height = np.maximum.reduce([0.62 * hE, 1.0 * rim, 0.42 * line]) + 0.012 * brush * field
    height = np.where(rr > 1.0, 0, height)
    rough = 0.38 * field + 0.17 * (1 - field)
    rough = rough * (1 - inner) + 0.1 * inner
    metal = 1 - inner
    return height, rough, metal


def wear(seed):
    """marcas de uso: manchas suaves de dedo e riscos finos, que mudam a rugosidade e um pouco o relevo"""
    rng = np.random.default_rng(seed)
    smear = np.array(Image.fromarray((rng.random((24, 24)) * 255).astype(np.uint8)).resize((S, S), Image.BICUBIC)).astype(np.float32) / 255
    sc = Image.new("L", (S, S), 0)
    d = ImageDraw.Draw(sc)
    for _ in range(140):
        x0, y0 = rng.uniform(0, S, 2)
        a = rng.uniform(0, math.pi)
        ln = rng.uniform(20, 260)
        d.line([(x0, y0), (x0 + math.cos(a) * ln, y0 + math.sin(a) * ln)], fill=int(rng.uniform(60, 200)), width=1)
    scr = np.array(sc).astype(np.float32) / 255
    return smear, scr


def save(name, height, rough, metal, seed=5):
    smear, scr = wear(seed)
    rough = np.clip(rough + (smear - 0.5) * 0.025 - scr * 0.06, 0.04, 1)
    height = np.clip(height - scr * 0.002, 0, 1)
    # oclusão nas cavidades: onde o entorno é mais alto que o ponto, escurece
    blur = smooth((np.clip(height, 0, 1) * 255).astype(np.uint8), 10.0)
    ao = np.clip(1 - np.clip(blur - height, 0, 1) * 3.2, 0.35, 1)
    for size, suf in ((2048, "-2k"), (1024, "")):
        rs = lambda a: np.array(Image.fromarray(np.clip(a * 255, 0, 255).astype(np.uint8)).resize((size, size), Image.LANCZOS)).astype(np.float32) / 255
        h, r, m, o = rs(height), rs(rough), rs(metal), rs(ao)
        orm = np.stack([h, r, m], -1)
        Image.fromarray((orm * 255).astype(np.uint8)).save(os.path.join(OUT, f"medalha-{name}-orm{suf}.webp"), lossless=True, quality=100, method=6)
        Image.fromarray((o * 255).astype(np.uint8), "L").save(os.path.join(OUT, f"medalha-{name}-ao{suf}.webp"), quality=88, method=6)
        k = 9.0 * size / 1024
        hx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * 0.5
        hy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * 0.5
        nx, ny, nz = -hx * k, hy * k, np.ones_like(h)
        l = np.sqrt(nx * nx + ny * ny + nz * nz)
        nm = np.stack([nx / l * 0.5 + 0.5, ny / l * 0.5 + 0.5, nz / l * 0.5 + 0.5], -1)
        Image.fromarray((nm * 255).astype(np.uint8)).save(os.path.join(OUT, f"medalha-{name}-normal{suf}.webp"), quality=92, method=6)


# ---------- frente: Equipe TRUE ----------
front = blank()
arc_text(front, TOP, ImageFont.truetype(FONT_BLACK, 250), 0.735 * C, 0, 26)
side = ImageFont.truetype(FONT_SEMI, 84)
arc_text(front, LEFT, side, 0.8 * C, 270, 16)
arc_text(front, RIGHT, side, 0.8 * C, 90, 16)
mono_scale = (0.84 * C) / 545
paste_dark(front, TRUE_PNG, (370, 335, 780, 880), mono_scale, (C, C + 0.03 * C))
paste_dark(front, TRUE_PNG, (380, 895, 770, 1035), mono_scale * 0.92, (C, C + 0.595 * C))
save("frente", *build(front, True))

# ---------- verso: Studio Evolution ----------
back = blank()
alpha_logo(back, EVO_PNG, int(1.42 * C), (C, C))
arc_text(back, "EQUIPE TRUE", ImageFont.truetype(FONT_SEMI, 92), 0.78 * C, 0, 22)
arc_text(back, "JARDIM SÃO PAULO · SOROCABA", ImageFont.truetype(FONT_SEMI, 76), 0.8 * C, 180, 14, outward=False)
save("verso", *build(back, False), seed=9)
print("ok")
