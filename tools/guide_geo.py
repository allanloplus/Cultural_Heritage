"""產生全系列導覽地圖（guide/）的底圖圖形：guide/geo.js

地圖上的線條都來自姊妹站已整理好的公開資料，只在建置時讀取、不修改它們：
  海岸線與山脈分層  Cultural_Atlas  data/terrain/9/（Copernicus DEM 轉成的 Terrarium 地形圖磚）
  鐵道              Cultural_Rail   data/lines/*.json（臺鐵車站座標與站序）
  濁水溪、淡水河    Cultural_Ascent data/raw/rivers/stems.json（推算的主流）
  古道              Cultural_Ascent data/raw/trails/tracks.json（林業保育署、觀光署公開軌跡）

用法（需要 numpy、matplotlib、Pillow；結果已提交，只有想改地圖範圍或線條時才要重跑）：
  ATLAS_DIR=... RAIL_DIR=... ASCENT_DIR=... python3 tools/guide_geo.py
沒設環境變數時，找本 repo 旁邊的 Cultural_Atlas、Cultural_Rail、Cultural_Ascent。
"""
import io, json, math, os, sys

import numpy as np
from PIL import Image
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PARENT = os.path.dirname(ROOT)


def find(env, name):
    d = os.environ.get(env)
    if d:
        return d
    for n in (name, name.lower()):
        if os.path.isdir(os.path.join(PARENT, n)):
            return os.path.join(PARENT, n)
    sys.exit("找不到 %s，請用環境變數 %s 指定" % (name, env))


ATLAS, RAIL, ASCENT = find("ATLAS_DIR", "Cultural_Atlas"), find("RAIL_DIR", "Cultural_Rail"), find("ASCENT_DIR", "Cultural_Ascent")

# 本島與澎湖的主圖範圍、比例（每度緯度 K 個單位，經度乘上 cos 23.7°）
W0, N0, K = 119.25, 25.42, 250.0
COS = math.cos(math.radians(23.7))
# 金門、馬祖放在左上角的小框（與傳統臺灣全圖相同的做法），各有自己的範圍、比例與擺放位置
INSETS = {
    "matsu": {"box": (119.86, 120.56, 25.92, 26.42), "k": 230.0, "at": (14, 16)},
    "kinmen": {"box": (118.19, 118.52, 24.36, 24.54), "k": 520.0, "at": (14, 176)},
}
LEVELS = [1, 300, 1000, 2000, 3000]   # 海岸線與山脈分層的高度（公尺）


def proj(lng, lat, inset=None):
    if inset:
        b, k, (ax, ay) = INSETS[inset]["box"], INSETS[inset]["k"], INSETS[inset]["at"]
        return ax + (lng - b[0]) * COS * k, ay + (b[3] - lat) * k
    return (lng - W0) * COS * K, (N0 - lat) * K


def tile_xy(lng, lat, z):
    n = 2 ** z
    return (lng + 180) / 360 * n, (1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * n


def dem(box, z=9):
    """box=(西, 東, 南, 北) 內的地形：回傳高度陣列與每個格點的經緯度"""
    x0, y0 = tile_xy(box[0], box[3], z)
    x1, y1 = tile_xy(box[1], box[2], z)
    tx0, ty0, tx1, ty1 = int(x0), int(y0), int(x1), int(y1)
    W, H = (tx1 - tx0 + 1) * 256, (ty1 - ty0 + 1) * 256
    a = np.zeros((H, W), dtype=np.float32)
    for tx in range(tx0, tx1 + 1):
        for ty in range(ty0, ty1 + 1):
            p = os.path.join(ATLAS, "data", "terrain", str(z), str(tx), "%d.png" % ty)
            if not os.path.exists(p):
                continue
            im = np.asarray(Image.open(p).convert("RGB"), dtype=np.float32)
            a[(ty - ty0) * 256:(ty - ty0 + 1) * 256, (tx - tx0) * 256:(tx - tx0 + 1) * 256] = im[:, :, 0] * 256 + im[:, :, 1] + im[:, :, 2] / 256 - 32768
    n = 2 ** z
    px = np.arange(W) + tx0 * 256 + .5
    py = np.arange(H) + ty0 * 256 + .5
    lng = px / (256 * n) * 360 - 180
    lat = np.degrees(np.arctan(np.sinh(np.pi * (1 - 2 * py / (256 * n)))))
    return a, lng, lat


def simplify(pts, tol):
    """Douglas–Peucker"""
    if len(pts) < 3:
        return pts
    a, b = np.array(pts[0]), np.array(pts[-1])
    d = b - a
    L = np.hypot(*d) or 1e-9
    P = np.array(pts)
    dist = np.abs(d[0] * (P[:, 1] - a[1]) - d[1] * (P[:, 0] - a[0])) / L
    i = int(np.argmax(dist))
    if dist[i] > tol:
        return simplify(pts[:i + 1], tol)[:-1] + simplify(pts[i:], tol)
    return [pts[0], pts[-1]]


def simplify_ring(ring, tol):
    """封閉的環起點等於終點，直接簡化會整條收成兩點：先從離起點最遠的點切成兩半"""
    P = np.array(ring)
    i = int(np.argmax(np.hypot(P[:, 0] - P[0, 0], P[:, 1] - P[0, 1])))
    if i == 0:
        return []
    return simplify(ring[:i + 1], tol)[:-1] + simplify(ring[i:], tol)


def path_d(rings):
    out = []
    for r in rings:
        out.append("M" + "L".join("%.1f,%.1f" % p for p in r) + "Z")
    return "".join(out)


def contours(box, inset=None, keep=None, min_area=1.5, tol=0.6):
    a, lng, lat = dem(box)
    a = np.where(a < 0, 0, a)
    LNG, LAT = np.meshgrid(lng, lat)
    cs = plt.contour(LNG, LAT, a, levels=LEVELS)
    out = []
    for lv, segs in zip(LEVELS, cs.allsegs):
        rings = []
        for s in segs:
            if len(s) < 4:
                continue
            if keep and not keep(s):
                continue
            ring = simplify_ring([proj(x, y, inset) for x, y in s], tol)
            if len(ring) < 3:
                continue
            xs, ys = zip(*ring)
            area = abs(sum(xs[i] * ys[i - 1] - xs[i - 1] * ys[i] for i in range(len(ring)))) / 2
            if area < min_area:
                continue
            rings.append(ring)
        out.append(path_d(rings))
    plt.close("all")
    return out


def in_box(s, b, pad=0.0):
    return (s[:, 0].min() > b[0] + pad and s[:, 0].max() < b[1] - pad and s[:, 1].min() > b[2] + pad and s[:, 1].max() < b[3] - pad)


main_box = (W0, 122.12, 21.85, N0)


def keep_main(s):
    # 不要中國沿海（南日島、平潭一帶）：重心在北緯 23.9 度以北、東經 119.75 度以西的都捨棄
    cx, cy = s[:, 0].mean(), s[:, 1].mean()
    if cx < 119.75 and cy > 23.9:
        return False
    return in_box(s, main_box, 0.005)


geo = {"w": round((122.12 - W0) * COS * K, 1), "h": round((N0 - 21.85) * K, 1), "levels": LEVELS,
       "main": contours(main_box, keep=keep_main), "insets": {}}
for name, ins in INSETS.items():
    b = ins["box"]
    x0, y0 = proj(b[0], b[3], name)
    x1, y1 = proj(b[1], b[2], name)
    geo["insets"][name] = {"box": [round(x0, 1), round(y0, 1), round(x1 - x0, 1), round(y1 - y0, 1)],
                           "land": contours(b, name, keep=lambda s, b=b: in_box(s, b, 0.003), min_area=0.3, tol=0.4)}


def line(pts, tol=0.8, inset=None):
    return path_d([simplify([proj(x, y, inset) for x, y in pts], tol)]).rstrip("Z")


# 鐵道：西部幹線＋南迴＋東部幹線，依站序連成環島線；另外畫幾條支線
def stations(lid):
    d = json.load(open(os.path.join(RAIL, "data", "lines", lid + ".json"), encoding="utf-8"))
    return [(float(s["lng"]), float(s["lat"])) for s in d["stations"]]


loop_ids = ["north", "mountain", "south", "pingtung", "southlink", "taitung", "northlink", "yilan"]
loop = []
for lid in loop_ids:
    s = stations(lid)
    if loop and s and math.hypot(loop[-1][0] - s[0][0], loop[-1][1] - s[0][1]) > math.hypot(loop[-1][0] - s[-1][0], loop[-1][1] - s[-1][1]):
        s = s[::-1]
    loop += s if not loop or s[0] != loop[-1] else s[1:]
geo["rail"] = line(loop, 0.5)
geo["railCoast"] = line(stations("coast"), 0.5)
geo["railBranches"] = [line(stations(l), 0.5) for l in ("pingxi", "neiwan", "jiji")]

# 河流（主流）與古道
st = json.load(open(os.path.join(ASCENT, "data", "raw", "rivers", "stems.json"), encoding="utf-8"))["rivers"]
geo["rivers"] = {k: line([(p[0], p[1]) for p in st[k]["pts"]], 0.6) for k in ("zhuoshui", "danshui")}
tr = json.load(open(os.path.join(ASCENT, "data", "raw", "trails", "tracks.json"), encoding="utf-8"))
geo["trails"] = {k: line([(p[0], p[1]) for p in tr[k]["pts"]], 0.4) for k in ("nenggao", "jinshuiying", "batongguan", "xiakeluo", "fuba")}

# 縣市標記位置（與入口頁地圖相同，取自 assets/js/cities.js）
txt = open(os.path.join(ROOT, "assets", "js", "cities.js"), encoding="utf-8").read()
import re  # noqa: E402
pins = []
for m in re.finditer(r'\{\s*slug:\s*"([^"]+)",\s*name:\s*"([^"]+)"(.*?)\}', txt, re.S):
    slug, name, rest = m.groups()
    la, ln = float(re.search(r"lat:\s*([\d.]+)", rest).group(1)), float(re.search(r"lng:\s*([\d.]+)", rest).group(1))
    ins = "kinmen" if slug == "kinmen-county" else "matsu" if slug == "lienchiang-county" else None
    x, y = proj(ln, la, ins)
    pins.append([slug, round(x, 1), round(y, 1)])
geo["pins"] = pins


def pt(lng, lat, inset=None):
    x, y = proj(lng, lat, inset)
    return [round(x, 1), round(y, 1)]


# 地標位置（經緯度換成地圖座標）：玉山、濁水溪口、鹿港、扇形車庫、金門
geo["spots"] = {"yushan": pt(120.957, 23.47), "zhuoMouth": pt(120.21, 23.83), "lukang": pt(120.435, 24.055),
                "changhua": pt(120.54, 24.08), "kinmen": pt(118.37, 24.44, "kinmen"), "taipei": pt(121.515, 25.045),
                "tainan": pt(120.2, 22.99), "hualien": pt(121.6, 23.99), "taitung": pt(121.15, 22.79), "penghu": pt(119.57, 23.57)}
body = json.dumps(geo, ensure_ascii=False, separators=(",", ":"))
open(os.path.join(ROOT, "guide", "geo.js"), "w", encoding="utf-8").write(
    "/* 全系列導覽地圖的底圖圖形，由 tools/guide_geo.py 產生，請勿手動修改 */\nwindow.GUIDE_GEO=" + body + ";\n")
print("guide/geo.js %d KB，地圖 %s×%s" % (len(body) // 1024, geo["w"], geo["h"]))
