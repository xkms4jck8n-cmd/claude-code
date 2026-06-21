#!/usr/bin/env python3
"""Generate branded iOS app icon + splash for Knowledge Kingdom.

Theme: dark navy (#0b1020) background with a gold crown and a soft
teal/gold glow — matching the game's in-app palette. Output PNGs are
written directly into the Capacitor iOS asset catalogs.

App icons must be fully opaque (no alpha) per App Store requirements,
so the background fully fills the square.
"""
import math
import os

from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ICON_DIR = os.path.join(ROOT, "ios/App/App/Assets.xcassets/AppIcon.appiconset")
SPLASH_DIR = os.path.join(ROOT, "ios/App/App/Assets.xcassets/Splash.imageset")

NAVY_TOP = (17, 24, 48)      # #111830
NAVY_BOT = (8, 12, 28)       # #080c1c
GOLD_TOP = (246, 221, 154)   # #f6dd9a
GOLD_BOT = (198, 148, 31)    # #c6941f
TEAL = (84, 224, 200)        # #54e0c8
GEM = (84, 224, 200)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def radial_background(size, glow=True):
    """Dark navy vertical gradient with an optional centered glow."""
    img = Image.new("RGB", (size, size))
    px = img.load()
    for y in range(size):
        t = y / max(1, size - 1)
        row = lerp(NAVY_TOP, NAVY_BOT, t)
        for x in range(size):
            px[x, y] = row
    if glow:
        glow_layer = Image.new("RGB", (size, size), (0, 0, 0))
        gd = ImageDraw.Draw(glow_layer)
        cx, cy = size * 0.5, size * 0.46
        r = size * 0.42
        gd.ellipse([cx - r, cy - r, cx + r, cy + r], fill=lerp((0, 0, 0), TEAL, 0.16))
        r2 = size * 0.30
        gd.ellipse([cx - r2, cy - r2, cx + r2, cy + r2], fill=lerp((0, 0, 0), GOLD_TOP, 0.20))
        glow_layer = glow_layer.filter(ImageFilter.GaussianBlur(size * 0.08))
        img = Image.blend(img, ImageChops_add(img, glow_layer), 1.0)
    return img


def ImageChops_add(a, b):
    from PIL import ImageChops
    return ImageChops.add(a, b)


def crown_polygon(cx, cy, w, h):
    L = cx - w * 0.46
    R = cx + w * 0.46
    base_bottom = cy + h * 0.34
    valley_y = cy - h * 0.02
    side_peak_y = cy - h * 0.30
    center_peak_y = cy - h * 0.44
    v1 = cx - w * 0.20
    v2 = cx + w * 0.20
    return [
        (L, side_peak_y),
        (v1, valley_y),
        (cx, center_peak_y),
        (v2, valley_y),
        (R, side_peak_y),
        (R, base_bottom),
        (L, base_bottom),
    ], dict(L=L, R=R, base_bottom=base_bottom, side_peak_y=side_peak_y,
            center_peak_y=center_peak_y, v1=v1, v2=v2, valley_y=valley_y)


def gold_gradient(size_box):
    w, h = size_box
    grad = Image.new("RGB", (w, h))
    px = grad.load()
    for y in range(h):
        t = y / max(1, h - 1)
        row = lerp(GOLD_TOP, GOLD_BOT, t)
        for x in range(w):
            px[x, y] = row
    return grad


def draw_crown(img, cx, cy, w, h):
    poly, m = crown_polygon(cx, cy, w, h)
    minx = int(min(p[0] for p in poly)) - 4
    miny = int(min(p[1] for p in poly)) - 4
    maxx = int(max(p[0] for p in poly)) + 4
    maxy = int(max(p[1] for p in poly)) + 4
    bw, bh = maxx - minx, maxy - miny

    mask = Image.new("L", (bw, bh), 0)
    md = ImageDraw.Draw(mask)
    md.polygon([(x - minx, y - miny) for (x, y) in poly], fill=255)

    grad = gold_gradient((bw, bh))
    img.paste(grad, (minx, miny), mask)

    d = ImageDraw.Draw(img)
    # outline
    d.line(poly + [poly[0]], fill=lerp(GOLD_BOT, (90, 60, 10), 0.4),
           width=max(2, int(w * 0.012)), joint="curve")

    # base band separator
    band_y = m["base_bottom"] - h * 0.16
    d.line([(m["L"] + w * 0.02, band_y), (m["R"] - w * 0.02, band_y)],
           fill=lerp(GOLD_BOT, (120, 80, 20), 0.5), width=max(2, int(w * 0.01)))

    # gem at each peak
    gem_r = w * 0.055
    for (gx, gy) in [(m["L"], m["side_peak_y"]), (cx, m["center_peak_y"]),
                     (m["R"], m["side_peak_y"])]:
        d.ellipse([gx - gem_r, gy - gem_r, gx + gem_r, gy + gem_r], fill=GEM)
        d.ellipse([gx - gem_r * 0.4, gy - gem_r * 0.5,
                   gx + gem_r * 0.1, gy], fill=lerp(GEM, (255, 255, 255), 0.6))

    # row of gems along the base band
    n = 5
    for i in range(n):
        gx = m["L"] + (m["R"] - m["L"]) * (i + 0.5) / n
        gy = (band_y + m["base_bottom"]) / 2
        r = w * 0.028
        col = GEM if i % 2 == 0 else lerp(GOLD_TOP, (255, 255, 255), 0.3)
        d.ellipse([gx - r, gy - r, gx + r, gy + r], fill=col)


def make_icon(size):
    img = radial_background(size, glow=True)
    draw_crown(img, size * 0.5, size * 0.52, size * 0.62, size * 0.62)
    return img


def make_splash(size):
    img = radial_background(size, glow=True)
    # smaller crown, centered
    draw_crown(img, size * 0.5, size * 0.47, size * 0.30, size * 0.30)
    return img


def main():
    icon = make_icon(1024)
    icon.save(os.path.join(ICON_DIR, "AppIcon-512@2x.png"), "PNG")
    print("wrote AppIcon-512@2x.png (1024x1024)")

    splash = make_splash(2732)
    for name in ("splash-2732x2732.png", "splash-2732x2732-1.png",
                 "splash-2732x2732-2.png"):
        splash.save(os.path.join(SPLASH_DIR, name), "PNG")
        print("wrote", name, "(2732x2732)")


if __name__ == "__main__":
    main()
