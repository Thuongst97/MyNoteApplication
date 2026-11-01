"""Build resources/icon.ico from resources/icon.png.

Windows-friendly layout: classic 32-bit BMP (DIB) frames for 16-128 px and a
PNG frame only for 256 px. Icons whose small frames are PNG-compressed can
make Explorer / the taskbar fall back to a default icon.

Usage: python3 scripts/make-ico.py
"""
import io
import struct
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "resources" / "icon.png"
OUT = ROOT / "resources" / "icon.ico"
SIZES = [16, 20, 24, 32, 40, 48, 64, 96, 128, 256]


def bmp_frame(im: Image.Image) -> bytes:
    w, h = im.size
    px = im.tobytes("raw", "BGRA")
    rows = [px[y * w * 4:(y + 1) * w * 4] for y in range(h)]
    xor = b"".join(reversed(rows))  # bottom-up
    mask_row = ((w + 31) // 32) * 4
    and_mask = bytearray()
    for y in reversed(range(h)):
        bits = bytearray(mask_row)
        for x in range(w):
            if im.getpixel((x, y))[3] == 0:
                bits[x // 8] |= 0x80 >> (x % 8)
        and_mask += bits
    header = struct.pack("<IiiHHIIiiII", 40, w, h * 2, 1, 32, 0, len(xor) + len(and_mask), 0, 0, 0, 0)
    return header + xor + bytes(and_mask)


def png_frame(im: Image.Image) -> bytes:
    buf = io.BytesIO()
    im.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def main() -> None:
    src = Image.open(SRC).convert("RGBA")
    frames = []
    for s in SIZES:
        im = src.resize((s, s), Image.LANCZOS)
        frames.append((s, png_frame(im) if s >= 256 else bmp_frame(im)))
    out = bytearray(struct.pack("<HHH", 0, 1, len(frames)))
    offset = 6 + 16 * len(frames)
    for s, data in frames:
        d = 0 if s >= 256 else s
        out += struct.pack("<BBBBHHII", d, d, 0, 0, 1, 32, len(data), offset)
        offset += len(data)
    for _, data in frames:
        out += data
    OUT.write_bytes(bytes(out))
    print(f"wrote {OUT} ({len(out)} bytes, sizes {SIZES})")


if __name__ == "__main__":
    main()
