"""Render the primary CareerSaathi mark (concept A) to PNG/ICO favicons.

Geometry mirrors brand/mark-a-companion.svg (64-unit viewBox), drawn at 8x and downsampled.
Run:  python brand/make_icons.py   (from the client folder)
"""
import math
from pathlib import Path
from PIL import Image, ImageDraw

NAVY, ORANGE, WHITE = (21, 52, 115), (255, 106, 0), (255, 255, 255)
OUT = Path(__file__).resolve().parent.parent / "public"
SS = 8  # supersampling


def render(size, rounded=True, scale=1.0):
    """scale<1 shrinks the glyph inside the tile (for maskable safe zone)."""
    n = size * SS
    u = n / 64
    img = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if rounded:
        d.rounded_rectangle([0, 0, n - 1, n - 1], radius=15 * u, fill=NAVY)
    else:
        d.rectangle([0, 0, n, n], fill=NAVY)

    def p(x, y):  # map SVG coords, with optional shrink around centre
        return (32 + (x - 32) * scale) * u, (32 + (y - 32) * scale) * u

    cx, cy = p(32, 32)
    r = 15.5 * scale * u
    w = 8 * scale * u
    # C arc: SVG sweeps the big arc from (42.6,21.4) round the left to (42.6,42.6) -> 45deg..315deg
    ro = r + w / 2  # PIL strokes inward from the box edge; SVG strokes centred on r
    box = [cx - ro, cy - ro, cx + ro, cy + ro]
    d.arc(box, 45, 315, fill=WHITE, width=round(w))
    for a in (45, 315):  # round caps
        ex, ey = cx + r * math.cos(math.radians(a)), cy + r * math.sin(math.radians(a))
        d.ellipse([ex - w / 2, ey - w / 2, ex + w / 2, ey + w / 2], fill=WHITE)
    dx, dy = p(47, 32)
    dr = 5.5 * scale * u
    d.ellipse([dx - dr, dy - dr, dx + dr, dy + dr], fill=ORANGE)
    return img.resize((size, size), Image.LANCZOS)


def main():
    OUT.mkdir(exist_ok=True)
    render(16).save(OUT / "favicon-16x16.png")
    render(32).save(OUT / "favicon-32x32.png")
    render(180, rounded=False).save(OUT / "apple-touch-icon.png")  # iOS applies its own rounding
    render(192).save(OUT / "icon-192.png")
    render(512).save(OUT / "icon-512.png")
    render(512, rounded=False, scale=0.8).save(OUT / "icon-maskable-512.png")
    render(256).save(OUT / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (256, 256)])
    print("wrote icons to", OUT)


if __name__ == "__main__":
    main()
