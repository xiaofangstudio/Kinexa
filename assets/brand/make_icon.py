# -*- coding: utf-8 -*-
"""Kinexa 图标 v5：暖黄底 + 取景角标 + 双帧错位 + 一笔白线。
与 Groma / Vexa 同族：单色底、粗几何、一个小强调。
"""
from PIL import Image, ImageDraw

S = 1024
SS = 3
W = S * SS

BG = (255, 210, 77, 255)
INK = (36, 31, 22, 255)
GHOST = (176, 118, 26, 255)   # 后帧：暖棕，跳出来才看得见错位
STROKE = (255, 253, 245, 255)
FRAME = (122, 92, 24, 255)    # 取景角标


def rr(d, box, radius, fill):
    d.rounded_rectangle([c * SS for c in box], radius=radius * SS, fill=fill)


def corner_marks(d):
    """四角的取景角标（L 形），臂长 a，线宽 t。"""
    a, t, m = 124, 22, 106
    # 左上
    d.rectangle([m * SS, m * SS, (m + a) * SS, (m + t) * SS], fill=FRAME)
    d.rectangle([m * SS, m * SS, (m + t) * SS, (m + a) * SS], fill=FRAME)
    # 右上
    d.rectangle([(S - m - a) * SS, m * SS, (S - m) * SS, (m + t) * SS], fill=FRAME)
    d.rectangle([(S - m - t) * SS, m * SS, (S - m) * SS, (m + a) * SS], fill=FRAME)
    # 左下
    d.rectangle([m * SS, (S - m - t) * SS, (m + a) * SS, (S - m) * SS], fill=FRAME)
    d.rectangle([m * SS, (S - m - a) * SS, (m + t) * SS, (S - m) * SS], fill=FRAME)
    # 右下
    d.rectangle([(S - m - a) * SS, (S - m - t) * SS, (S - m) * SS, (S - m) * SS], fill=FRAME)
    d.rectangle([(S - m - t) * SS, (S - m - a) * SS, (S - m) * SS, (S - m) * SS], fill=FRAME)


def stroke(d, pts, width, color):
    r = width * SS / 2.0
    for p in pts:
        d.ellipse([p[0] - r, p[1] - r, p[0] + r, p[1] + r], fill=color)


def bezier(p0, p1, p2, p3, n=90):
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

    # 后帧（洋葱皮）：向右下错位
    rr(d, (391, 366, 821, 796), 104, GHOST)
    # 前帧
    rr(d, (217, 244, 647, 674), 104, INK)

    # 一笔：从后帧右下穿进前帧，S 形；白线
    stroke(d, bezier((295, 596), (373, 482), (455, 586), (565, 402)), 46, STROKE)


    # 取景角标最后压上，保证不被帧块遮住
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


