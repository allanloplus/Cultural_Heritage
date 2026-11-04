"""步驟 4：從維基百科文資列表找每個景點的代表照片，查 Wikimedia Commons 授權，寫 <slug>/data/images.json
用法：python3 tools/newcity/images.py 高雄市 kaohsiung-city [--none 景點id ...]
接著：python3 tools/fetch_images.py kaohsiung-city   # 下載成 webp 自架（會被限流，可重跑，會接著做）

比對規則：名稱完全相同，或（4 字以上時）互相包含才算；寧可沒有照片也不要配錯。
會列出「同一張照片配給多個景點」的情況，請人工判斷後用 --none 排除配錯的景點。
授權只收 CC / 公有領域；只寫 Attribution 或作者不明（非公有領域）的照片不用。
"""
import argparse, collections, json, os, re, sys, time, urllib.parse
from common import CACHE, ROOT, city_dir, dump, get, load, work_dir

SKIP_SECTIONS = ("古物", "無形文化資產", "民俗", "傳統工藝", "傳統表演藝術", "保存技術", "口述傳統", "已撤銷", "已解除", "註銷")


def clean(s):
    s = re.sub(r"<ref.*?(/>|</ref>)", "", s, flags=re.S)
    s = re.sub(r"\{\{[^{}]*\}\}", "", s)
    s = re.sub(r"\[\[(?:[^|\]]*\|)?([^\]]*)\]\]", r"\1", s)
    return s.replace("<br />", " ").replace("<br>", " ").strip()


def wiki_rows(city):
    rows = []
    for title in (city + "文化資產", city + "古蹟列表", city + "歷史建築列表"):
        d = load(os.path.join(CACHE, "wiki", title + ".json"))
        if not d or "parse" not in d:
            continue
        sec = None
        for b in re.split(r"(\n=+[^=\n]+=+\s*\n)", d["parse"]["wikitext"]):
            if re.match(r"\n=+[^=\n]+=+\s*\n", b):
                sec = b.strip().strip("=").strip()
                continue
            for tbl in re.findall(r"\{\|(.*?)\n\|\}", b, re.S):
                for r in tbl.split("\n|-")[1:]:
                    cells = [c.strip() for c in re.split(r"\n\||\|\|", "\n" + r.strip())[1:]]
                    # 維基語法的檔案前綴有多種寫法（含簡體別名「图像」），這裡只是比對語法，不是顯示文字
                    img = re.findall(r"\[\[(?:File|檔案|文件|Image|图像|圖像):([^|\]]+)", r)
                    cells = [clean(c) for c in cells if not re.match(r"\[\[(File|檔案|文件|Image):", c) and not c.startswith("[http")]
                    rows.append(dict(page=title, sec=sec, cells=cells, img=img[:1]))
    return rows


def norm(s):
    return re.sub(r"[「」()（）\s\-{}‧・、0-9號]|國定古蹟|直轄市定|市定|縣定", "", s.replace("臺", "台"))


def commons_info(files):
    out = {}
    for i in range(0, len(files), 40):
        chunk = files[i:i + 40]
        q = dict(action="query", format="json", formatversion="2", prop="imageinfo", iiprop="url|extmetadata|size",
                 iiurlwidth="960", titles="|".join("File:" + t for t in chunk))
        d = json.loads(get("https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(q), timeout=60))
        normd = {n["to"]: n["from"] for n in d["query"].get("normalized", [])}
        for p in d["query"]["pages"]:
            orig = normd.get(p["title"], p["title"])[5:]
            if "imageinfo" not in p:
                out[orig] = None
                continue
            ii = p["imageinfo"][0]; em = ii.get("extmetadata", {})
            g = lambda k: re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", em.get(k, {}).get("value", "") or "")).strip()
            out[orig] = dict(file=p["title"][5:], thumb=ii.get("thumburl"), page=ii.get("descriptionurl"),
                             artist=g("Artist"), license=g("LicenseShortName"), licenseUrl=g("LicenseUrl"))
        time.sleep(2)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("city"); ap.add_argument("slug")
    ap.add_argument("--none", nargs="*", default=[], help="不要配照片的景點 id（配錯時用）")
    a = ap.parse_args()
    W = work_dir(a.slug)
    base = load(os.path.join(W, "sites_base.json"))
    rows = wiki_rows(a.city)
    dump(rows, os.path.join(W, "wiki_rows.json"))  # 內容 agent（無形文資、古物）也會用到
    print("wiki rows:", len(rows), "with image:", sum(1 for r in rows if r["img"]))
    m = {}
    for o in base:
        on = norm(o["name"]); best = None
        for r in rows:
            if not r["cells"] or not r["img"] or any(k in (r["sec"] or "") for k in SKIP_SECTIONS):
                continue
            n = norm(r["cells"][0])
            if len(n) >= 2 and (n == on or (len(n) >= 4 and (n in on or on in n))):
                best = r["img"][0]
                break
        m[o["id"]] = None if o["id"] in a.none else best
    inv = collections.defaultdict(list)
    for k, v in m.items():
        if v:
            inv[v].append(k)
    for f, ks in inv.items():
        if len(ks) > 1:
            print("同一張照片配給多處，請確認：", f, ks)
    info = commons_info(sorted(inv))
    out = {}
    for sid, f in m.items():
        v = info.get(f) if f else None
        if not v or not v["thumb"] or v["license"] in ("", "Attribution"):
            continue
        lic = v["license"]  # 只收 CC 與公有領域（「Copyrighted free use」等其他授權不收）
        if not (lic.startswith("CC") or "public domain" in lic.lower() or lic.upper().startswith("PD")):
            continue
        if "Unknown" in (v["artist"] or "") and "Public domain" not in v["license"]:
            continue
        thumb = re.sub(r"/\d+px-", "/960px-", v["thumb"].split("?")[0])
        out[sid] = [{"file": v["file"], "thumb": thumb, "page": v["page"],
                     "artist": "佚名" if "Unknown" in (v["artist"] or "") else v["artist"][:80],
                     "license": v["license"], "licenseUrl": v["licenseUrl"]}]
    D = os.path.join(city_dir(a.slug, a.city), "data")  # 第二網站的縣市在 Cultural_Heritage2 的 clone
    old = load(os.path.join(D, "images.json"), {})
    for sid, ims in out.items():  # 保留已下載的 local / small 欄位
        if sid in old and old[sid] and old[sid][0].get("file") == ims[0]["file"]:
            out[sid] = old[sid]
    dump(out, os.path.join(D, "images.json"))
    print("photos:", len(out), "of", len(base), "sites")


if __name__ == "__main__":
    sys.exit(main())
