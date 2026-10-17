"""Gera as texturas da faixa a partir de um mapa de altura do tecido:
- faixa-normal.png: normal map (tileável no comprimento) para o 3D
- faixa-detalhe.webp: luminância (sombra das costuras e da trama) para o 3D
- faixa-preta.webp: tecido da faixa preta já iluminado, para as fitas em CSS
O tecido tem trama de lona, fileiras de costura afundadas com o fio em relevo
e o algodão estufado entre uma fileira e outra, como numa faixa de verdade."""
import numpy as np
from PIL import Image
import sys, os

out = sys.argv[1]
rng = np.random.default_rng(7)
W, H = 1024, 192          # comprimento x largura da faixa (tile)
ROWS = 10                 # fileiras de costura
x = np.arange(W)[None, :].repeat(H, 0).astype(np.float64)
y = np.arange(H)[:, None].repeat(W, 1).astype(np.float64)

def tile_noise(scale, octaves=4):
    """ruído suave e periódico no x (tile), por soma de senos com fases aleatórias"""
    acc = np.zeros((H, W))
    amp = 1.0
    for o in range(octaves):
        kx = int(W / scale) * (2 ** o)
        for _ in range(6):
            fx = rng.integers(1, max(2, kx)) * 2 * np.pi / W
            fy = rng.uniform(0.5, 2.0) * (2 ** o) * 2 * np.pi / (scale)
            acc += amp * np.sin(fx * x + rng.uniform(0, 6.28)) * np.sin(fy * y + rng.uniform(0, 6.28))
        amp *= 0.5
    acc -= acc.min(); acc /= acc.max()
    return acc

# 1) trama de lona: fios no comprimento cruzando fios na largura, em xadrez
p = 4.0
warp = 0.5 + 0.5 * np.cos(2 * np.pi * y / p)
weft = 0.5 + 0.5 * np.cos(2 * np.pi * x / p)
check = ((np.floor(x / p) + np.floor(y / p)) % 2)
weave = np.where(check > 0, warp ** 0.7, weft ** 0.7) * 0.5 + 0.25 * (warp + weft) * 0.5

# 2) fileiras de costura e o algodão estufado entre elas
margin = 10.0
usable = H - 2 * margin
rowpos = margin + np.arange(1, ROWS) * usable / ROWS
puff = np.zeros((H, W))
t = np.clip((y - margin) / usable, 0, 1) * ROWS
puff = np.sin(np.pi * (t - np.floor(t))) ** 0.6           # estufa entre as costuras
groove = np.zeros((H, W))
thread = np.zeros((H, W))
dash, gap = 9.0, 3.0
for i, ry in enumerate(rowpos):
    d = np.abs(y - ry)
    groove += np.exp(-(d / 2.2) ** 2)
    ph = (x + (i % 2) * 5.0) % (dash + gap)
    on = (ph < dash).astype(np.float64)
    # o ponto do fio: um grão alongado, mais alto no meio
    along = np.sin(np.pi * np.clip(ph / dash, 0, 1))
    thread += on * along ** 0.5 * np.exp(-(d / 1.1) ** 2)
# a borda dobrada da faixa, mais firme
edge = np.exp(-((y - 3) / 4.0) ** 2) + np.exp(-((y - (H - 4)) / 4.0) ** 2)

fuzz = tile_noise(64.0, 4)
height = 0.55 * puff + 0.12 * weave - 0.55 * groove + 0.42 * thread + 0.25 * edge + 0.06 * fuzz
height += 0.025 * rng.standard_normal((H, W))
height -= height.min(); height /= height.max()

# normal map a partir da altura (Sobel), periódico no x
def normals(h, strength):
    hx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * 0.5
    hy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * 0.5
    hy[0, :] = hy[1, :]; hy[-1, :] = hy[-2, :]
    nx, ny, nz = -hx * strength, hy * strength, np.ones_like(h)
    l = np.sqrt(nx * nx + ny * ny + nz * nz)
    return nx / l, ny / l, nz / l

nx, ny, nz = normals(height, 7.0)
nm = np.stack([(nx * 0.5 + 0.5), (ny * 0.5 + 0.5), (nz * 0.5 + 0.5)], -1)
Image.fromarray((nm * 255).astype(np.uint8)).save(os.path.join(out, "faixa-normal.webp"), quality=92, method=6)

# luminância de detalhe: costura e fundo da trama mais escuros (oclusão), fio e estufado mais claros
detail = 0.86 + 0.14 * height - 0.16 * groove * (1 - thread) + 0.06 * thread
detail = np.clip(detail, 0, 1)
Image.fromarray((detail * 255).astype(np.uint8), "L").save(os.path.join(out, "faixa-detalhe.webp"), quality=90)

# tecido da faixa preta já iluminado (para as fitas em CSS): luz de cima, um pouco à esquerda
L = np.array([-0.35, 0.55, 0.76]); L /= np.linalg.norm(L)
lam = np.clip(nx * L[0] + ny * L[1] + nz * L[2], 0, 1)
Hh = np.array([-0.2, 0.35, 1.0]); Hh /= np.linalg.norm(Hh)
spec = np.clip(nx * Hh[0] + ny * Hh[1] + nz * Hh[2], 0, 1) ** 30
base = np.array([0.018, 0.0175, 0.02])                      # preto de algodão tingido (linear)
col = base[None, None, :] * (0.25 + 0.95 * lam[..., None]) * detail[..., None]
col += (0.10 * spec * (0.4 + thread))[..., None] * np.array([1.0, 0.97, 0.92])
col += (0.05 * thread)[..., None] * np.array([0.9, 0.9, 0.95])  # o fio da costura brilha um pouco mais
srgb = np.clip(col, 0, 1) ** (1 / 2.2)
Image.fromarray((srgb * 255).astype(np.uint8)).save(os.path.join(out, "faixa-preta.webp"), quality=88)
print("ok", height.shape)
