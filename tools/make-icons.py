#!/usr/bin/env python3
"""Generate Pocketbook's PWA icons.

Dependency-free: rasterises the mark with 4x supersampling and writes PNGs by
hand, so the icons can be regenerated on any machine with a stock Python.

    python3 tools/make-icons.py

Mark: two stacked rounded cards — the back one in accent-dim, the front one in
citron carrying two dark rules. A document stack, in the app's own palette.
"""

import struct
import zlib
from pathlib import Path

BG = (0x0B, 0x0C, 0x0F)
ACCENT = (0xD4, 0xE0, 0x48)
ACCENT_DIM = (0x8E, 0x96, 0x30)

OUT = Path(__file__).resolve().parent.parent / "assets"
SS = 4  # supersampling factor per axis


def rounded_rect(x, y, w, h, r):
    """Return an `inside(px, py)` test for a rounded rectangle."""
    x0, y0, x1, y1 = x, y, x + w, y + h
    r = min(r, w / 2, h / 2)

    def inside(px, py):
        if not (x0 <= px <= x1 and y0 <= py <= y1):
            return False
        cx = min(max(px, x0 + r), x1 - r)
        cy = min(max(py, y0 + r), y1 - r)
        return (px - cx) ** 2 + (py - cy) ** 2 <= r * r

    return inside


def shapes(size, inset):
    """Build the mark's layers. `inset` shrinks the mark for maskable safe area."""
    s = size
    cx, cy = s / 2, s / 2
    w, h = s * 0.34 * inset, s * 0.44 * inset
    r = s * 0.055 * inset
    off = s * 0.035 * inset

    back = rounded_rect(cx - w / 2 - off, cy - h / 2 - off, w, h, r)
    front = rounded_rect(cx - w / 2 + off, cy - h / 2 + off, w, h, r)

    bar_w, bar_h = w * 0.56, h * 0.055
    bar_x = cx - w / 2 + off + w * 0.22
    rules = [
        rounded_rect(bar_x, cy + off - h * 0.14, bar_w, bar_h, bar_h / 2),
        rounded_rect(bar_x, cy + off + h * 0.02, bar_w * 0.66, bar_h, bar_h / 2),
    ]
    return [(back, ACCENT_DIM), (front, ACCENT)] + [(t, BG) for t in rules]


def render(size, inset=1.0):
    layers = shapes(size, inset)
    step = 1.0 / SS
    half = step / 2
    rows = []
    for py in range(size):
        row = bytearray()
        for px in range(size):
            acc = [0, 0, 0]
            for sy in range(SS):
                fy = py + sy * step + half
                for sx in range(SS):
                    fx = px + sx * step + half
                    colour = BG
                    for test, c in layers:
                        if test(fx, fy):
                            colour = c
                    acc[0] += colour[0]
                    acc[1] += colour[1]
                    acc[2] += colour[2]
            n = SS * SS
            row += bytes((acc[0] // n, acc[1] // n, acc[2] // n))
        rows.append(bytes(row))
    return rows


def write_png(path, size, rows):
    raw = b"".join(b"\x00" + r for r in rows)

    def chunk(tag, data):
        body = tag + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body))

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9))
    png += chunk(b"IEND", b"")
    path.write_bytes(png)
    print(f"{path.name}  {size}x{size}  {len(png) / 1024:.1f} KB")


SVG = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="22" fill="#0B0C0F"/>
  <rect x="29.5" y="24.5" width="34" height="44" rx="5.5" fill="#8E9630"/>
  <rect x="36.5" y="31.5" width="34" height="44" rx="5.5" fill="#D4E048"/>
  <rect x="44" y="46" width="19" height="2.4" rx="1.2" fill="#0B0C0F"/>
  <rect x="44" y="53" width="12.5" height="2.4" rx="1.2" fill="#0B0C0F"/>
</svg>
"""


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for size in (192, 512):
        write_png(OUT / f"icon-{size}.png", size, render(size))
    write_png(OUT / "icon-180.png", 180, render(180))
    # Maskable: mark pulled into the central safe area so launcher masks can't clip it.
    write_png(OUT / "maskable-512.png", 512, render(512, inset=0.72))
    (OUT / "icon.svg").write_text(SVG)
    print("icon.svg")


if __name__ == "__main__":
    main()
