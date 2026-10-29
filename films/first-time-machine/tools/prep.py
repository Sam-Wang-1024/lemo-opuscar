"""Scans (assets/raw) -> textures the page reads (assets/tex).
The Sun page stays at full resolution (its body type is small); the book pages keep their scan size.
Page 63 of El Anacronópete is split for its picture space: the time ship as its own layer (luminance + alpha),
and the background with the ship's spot refilled from the sky hatching beside it.
usage: python -I tools/prep.py <film_dir>"""
import sys, os
import numpy as np
from PIL import Image, ImageFilter
D = sys.argv[1]; R = os.path.join(D, 'assets/raw'); T = os.path.join(D, 'assets/tex')
os.makedirs(T, exist_ok=True)
def save(im, name, q=90):
    p = os.path.join(T, name)
    im.save(p, quality=q) if name.endswith('.jpg') else im.save(p)
    print(name, im.size, im.mode)

save(Image.open(os.path.join(R, 'sun_1881-09-18_p2.png')).convert('L'), 'sun.jpg', 88)
save(Image.open(os.path.join(R, 'wells_1895_djvu7.jpg')).convert('RGB'), 'wells_title.jpg')
save(Image.open(os.path.join(R, 'wells_1895_djvu15.jpg')).convert('RGB'), 'wells_p3.jpg')
wc = Image.open(os.path.join(R, 'wells_1895_djvu1.jpg')).convert('RGB'); save(wc.resize((1280, round(wc.height * 1280 / wc.width)), Image.LANCZOS), 'wells_cover.jpg')
save(Image.open(os.path.join(R, 'gaspar_1887_ia0006.png')).convert('RGB'), 'gaspar_title.jpg')
gc = Image.open(os.path.join(R, 'gaspar_1887_ia0000.png')).convert('RGB'); save(gc.resize((1420, round(gc.height * 1420 / gc.width)), Image.LANCZOS), 'gaspar_cover.jpg')

# page 63: the ship layer and the refilled background
g = np.asarray(Image.open(os.path.join(R, 'gaspar_1887_ia0066.png')).convert('L')).astype(np.float32) / 255
SX0, SY0, SX1, SY1 = 1262, 2248, 1418, 2368                   # the ship and its horns, with a margin
box = g[SY0:SY1, SX0:SX1]
dark = (box < 0.55).astype(np.float32)
m = Image.fromarray((dark * 255).astype(np.uint8))
m = m.filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.MinFilter(5))   # close the hull, keep the horns
mk = np.asarray(m).astype(np.float32) / 255
# keep only the connected blob around the hull centre (drop stray hatching)
from scipy import ndimage
lab, n = ndimage.label(mk > 0.5)
keep = lab == lab[(2310 - SY0), (1340 - SX0)]
mk = ndimage.binary_dilation(keep, iterations=3).astype(np.float32)
mk = np.asarray(Image.fromarray((mk * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.5))).astype(np.float32) / 255
la = np.stack([box, mk], -1)
save(Image.fromarray((la * 255).astype(np.uint8), 'LA'), 'g63_ship.png')
bg = g.copy()
src = g[SY0:SY1, SX0 + 150:SX1 + 150]                         # hatching to the right of the ship
fm = np.asarray(Image.fromarray((mk * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(7)).filter(ImageFilter.GaussianBlur(4))).astype(np.float32) / 255
bg[SY0:SY1, SX0:SX1] = box * (1 - fm) + src * fm
save(Image.fromarray((g * 255).astype(np.uint8)), 'g63.jpg')
save(Image.fromarray((bg * 255).astype(np.uint8)), 'g63_bg.jpg')
print('ship box', (SX0, SY0, SX1, SY1), 'mask px', int(keep.sum()))
