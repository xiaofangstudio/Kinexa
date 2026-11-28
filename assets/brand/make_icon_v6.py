# -*- coding: utf-8 -*-
"""Kinexa 图标 v6：暖黄底 + 取景角标 + 两帧错位（后帧为洋葱皮）+ 贯穿一笔。

设计意图：Kinexa 是二维动画软件，核心隐喻是「一帧接一帧，落笔把它们连起来」。
后帧是洋葱皮半透明残影，前帧是当前画格，一笔白线从前帧起笔、越过边界续到后帧。
同族语言（Groma 金黄底 + 四角对焦标）保持一致：单色底、粗几何、一个白强调。
"""
from PIL import Image, ImageDraw

S = 1024
SS = 3
W = S * SS

BG = (255, 210, 77, 255)
INK = (36, 31, 22, 255)
GHOST = (150, 98, 20, 118)     # 洋葱皮：暖棕半透明
STROKE = (255, 253, 245, 255)
FRAME = (122, 92, 24, 255)     # 取景角标


def rr(d, box, radius, fill):
    d.rounded_rectangle([c * SS for c in box], radius=radius * SS, fill=fill)


def corner_marks(d):
    a, t, m = 124, 22, 106
    d.rectangle([m * SS, m * SS, (m + a) * SS, (m + t) * SS], fill=FRAME)
    d.rectangle([m * SS, m * SS, (m + t) * SS, (m + a) * SS], fill=FRAME)
    d.rectangle([(S - m - a) * SS, m * SS, (S - m) * SS, (m + t) * SS], fill=FRAME)
    d.rectangle([(S - m - t) * SS, m * SS, (S - m) * SS, (m + a) * SS], fill=FRAME)
    d.rectangle([m * SS, (S - m - t) * SS, (m + a) * SS, (S - m) * SS], fill=FRAME)
    d.rectangle([m * SS, (S - m - a) * SS, (m + t) * SS, (S - m) * SS], fill=FRAME)
    d.rectangle([(S - m - a) * SS, (S - m - t) * SS, (S - m) * SS, (S - m) * SS], fill=FRAME)
    d.rectangle([(S - m - t) * SS, (S - m - a) * SS, (S - m) * SS, (S - m) * SS], fill=FRAME)


def stroke(d, pts, width, color):
    r = width * SS / 2.0
    for p in pts:
        d.ellipse([p[0] - r, p[1] - r, p[0] + r, p[1] + r], fill=color)


def bezier(p0, p1, p2, p3, n=110):
    out = []
    for i in range(n + 1):
        t = i / float(n)
        u = 1 - t
        x = u**3 * p0[0] + 3 * u**2 * t * p1[0] + 3 * u * t**2 * p2[0] + t**3 * p3[0]
        y = u**3 * p0[1] + 3 * u**2 * t * p1[1] + 3 * u * t**2 * p2[1] + t**3 * p3[1]
        out.append((x * SS, y * SS))
    return out


def main(png, ico):
    img = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    rr(d, (0, 0, S, S), 226, BG)

    # 洋葱皮后帧：单独图层做半透明叠加，避免直接覆盖画成实色
    ghost = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    gd = ImageDraw.Draw(ghost)
    rr(gd, (372, 396, 812, 836), 96, GHOST)
    img = Image.alpha_composite(img, ghost)
    d = ImageDraw.Draw(img)

    # 当前画格
    rr(d, (196, 216, 636, 656), 96, INK)

    # 一笔：从前帧左下起笔，S 形越过前帧右边，续写到洋葱皮后帧右上
    stroke(d, bezier((272, 566), (366, 430), (520, 640), (742, 396)), 42, STROKE)

    # 取景角标最后压上
    corner_marks(d)

    img = img.resize((S, S), Image.LANCZOS)
    img.save(png)
    img.save(ico, sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)])
    print("ok", png, ico)


if __name__ == "__main__":
    import sys
    png = sys.argv[1] if len(sys.argv) > 1 else "kinexa-icon-1024.png"
    ico = sys.argv[2] if len(sys.argv) > 2 else "kinexa.ico"
    main(png, ico)
