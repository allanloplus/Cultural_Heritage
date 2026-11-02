"""步驟 2：從文資局開放資料篩出某縣市的有形文化資產，產生景點清單、分組檔與官方資料
用法：python3 tools/newcity/build_base.py 高雄市 kaohsiung-city [--per-part 25]

需要：先跑 fetch_sources.py；pip install pypinyin
產生：
  /tmp/newcity/<slug>/sites_base.json   每處文資一筆：id、名稱、類別、行政區、座標、官方說明文字 texts（給內容 agent 用）
  /tmp/newcity/<slug>/part<N>.json      依行政區排序後切成每份約 25 處，一個內容 agent 寫一份
  /tmp/newcity/<slug>/stats.txt         類別、行政區、YouBike 區碼統計（寫 config.json 時參考）
  <slug>/data/sites-official.json       網站用的官方資料（只有在 <slug>/data/config.json 已存在時才寫）
  <slug>/data/ubike.json                config.json 有 ubikeAreas 時才寫

id 規則：行政區拼音-名稱拼音（例：zhongxi-chikanlou）。pypinyin 偶爾讀錯破音字（例如「嵌」讀成 qian），
看到怪的 id 可以用 --rename 舊id=新id 修正；id 一旦開始寫內容就不要再改。
"""
import argparse, collections, json, math, os, re
from common import CACHE, ROOT, city_addr, dump, in_city, load, work_dir

KINDS = [("1.1", "monument"), ("1.2", "building"), ("1.3", "cluster"), ("1.4", "memorial"), ("2.1", "archaeo"), ("3.1", "landscape")]
CAT_ORDER = ["國定古蹟", "市定古蹟", "縣定古蹟", "歷史建築", "紀念建築", "聚落建築群", "考古遺址", "文化景觀"]


def slugify(name, town, city):
    from pypinyin import lazy_pinyin
    n = re.sub(r"[（(].*?[)）]", "", name)
    n = re.sub(r"[^一-鿿]", "", n)
    short = city[:-1]  # 高雄市 → 高雄
    t = re.sub(r"[區鄉鎮市]$", "", town or "")
    for pre in ("國定古蹟", "直轄市定古蹟", "原" + city, "原" + short, city, short, short.replace("臺", "台"), "原"):
        if n.startswith(pre):
            n = n[len(pre):]
    if t and n.startswith(t):
        n = n[len(t):]
    s = ""
    for x in lazy_pinyin(n):
        x = x.replace("ü", "v")
        if len(s) + len(x) > 18:
            break
        s += x
    tp = "".join(lazy_pinyin(t)).replace("ü", "v")
    return (tp + "-" if tp else "") + (s or "site")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("city"); ap.add_argument("slug")
    ap.add_argument("--per-part", type=int, default=25)
    ap.add_argument("--rename", action="append", default=[], help="舊id=新id")
    a = ap.parse_args()
    W = work_dir(a.slug)
    cfg = load(os.path.join(ROOT, a.slug, "data", "config.json"))
    local_cat = "市定古蹟" if a.city.endswith("市") else "縣定古蹟"

    base = {}
    for f, kind in KINDS:
        for x in load(os.path.join(CACHE, "boch", f + ".json"), []):
            if not in_city(x, a.city):
                continue
            a0 = city_addr(x, a.city)
            town = a0.get("distName") or ""
            lvl = (x.get("assetsClassifyName") or "").strip()
            cat = {"monument": "國定古蹟" if "國定" in lvl else local_cat, "building": "歷史建築", "memorial": "紀念建築",
                   "cluster": "聚落建築群", "archaeo": "考古遺址", "landscape": "文化景觀"}[kind]
            lat, lng = x.get("latitude"), x.get("longitude")
            if lat and float(lat) > 100:  # 經緯度寫反
                lat, lng = lng, lat
            ann = x.get("announcementList") or []
            texts = {k: re.sub(r"\s+", " ", v)[:1500] for k, v in x.items()
                     if isinstance(v, str) and len(v) > 40 and not v.startswith("http")}
            base[x["caseId"]] = dict(
                name=x["caseName"].replace("國定古蹟-", "").replace("國定古蹟", "").strip(), category=cat, level=lvl,
                types=[t["name"] for t in x.get("assetsTypes") or []],
                announced=min([z.get("registerDate", "")[:10] for z in ann if z.get("registerDate")] or [""]),
                town=town, address=town + (a0.get("address") or ""),
                lat=float(lat) if lat else None, lng=float(lng) if lng else None,
                open=x.get("openUpTime"), caseId=x["caseId"], url=(x.get("caseUrl") or "").replace("http://", "https://"),
                officialImg=(x.get("representImage") or {}).get("original"), texts=texts)
    base = list(base.values())
    if not base:
        raise SystemExit("找不到 %s 的資料：先跑 fetch_sources.py，並確認縣市名稱（例：高雄市、臺南市）" % a.city)
    known = {o["town"] for o in base if o["town"]} | set((cfg or {}).get("towns") or [])
    for o in base:  # 少數資料沒有行政區：從地址或說明文字找已知的行政區名，找不到就留空（stats.txt 會列出，請手動補）
        if not o["town"]:
            hay = (o["address"] or "") + " " + " ".join(o["texts"].values())
            o["town"] = next((t for t in sorted(known, key=len, reverse=True) if t in hay), "")
            o["address"] = o["town"] + (o["address"] or "") if o["town"] and not (o["address"] or "").startswith(o["town"]) else o["address"]

    towns = (cfg or {}).get("towns") or [t for t, _ in collections.Counter(o["town"] for o in base).most_common()]
    base.sort(key=lambda o: (towns.index(o["town"]) if o["town"] in towns else 99,
                             CAT_ORDER.index(o["category"]) if o["category"] in CAT_ORDER else 9, o["name"]))
    used = collections.Counter()
    ren = dict(r.split("=", 1) for r in a.rename)
    for o in base:
        s = slugify(o["name"], o["town"], a.city)
        used[s] += 1
        if used[s] > 1:
            s += str(used[s])
        o["id"] = ren.get(s, s)
    ids = [o["id"] for o in base]
    assert len(ids) == len(set(ids)), "duplicate ids"

    dump(base, os.path.join(W, "sites_base.json"))
    n = math.ceil(len(base) / a.per_part)
    size = math.ceil(len(base) / n)
    for i in range(n):
        dump(base[i * size:(i + 1) * size], os.path.join(W, "part%d.json" % (i + 1)))

    # 統計（寫 config.json 用）
    lines = ["%s：%d 處" % (a.city, len(base)),
             "類別：" + json.dumps(collections.Counter(o["category"] for o in base), ensure_ascii=False),
             "行政區：" + json.dumps(collections.Counter(o["town"] for o in base).most_common(), ensure_ascii=False),
             "沒有行政區：" + json.dumps([o["name"] for o in base if not o["town"]], ensure_ascii=False),
             "沒有座標：" + json.dumps([o["name"] for o in base if not o["lat"]], ensure_ascii=False),
             "同名：" + json.dumps([k for k, v in collections.Counter(o["name"] for o in base).items() if v > 1], ensure_ascii=False)]
    pts = [o for o in base if o["lat"]]
    if pts:
        la = sorted(o["lat"] for o in pts); ln = sorted(o["lng"] for o in pts)
        lines.append("座標中位數（地圖中心參考）：[%.3f, %.3f]" % (la[len(la) // 2], ln[len(ln) // 2]))
        yb = load(os.path.join(CACHE, "yb2.json"), [])
        near = collections.Counter(x["area_code"] for x in yb
                                   if la[0] - .02 < float(x["lat"]) < la[-1] + .02 and ln[0] - .02 < float(x["lng"]) < ln[-1] + .02)
        lines.append("範圍內 YouBike 站點 area_code：" + json.dumps(near.most_common(), ensure_ascii=False) + "（取站數最多、屬於本縣市的那個）")
    lines.append("分組：%d 份，每份約 %d 處" % (n, size))
    open(os.path.join(W, "stats.txt"), "w", encoding="utf-8").write("\n".join(lines) + "\n")
    print("\n".join(lines))
    print("ids:", ids[:12], "...")

    if not cfg:
        print("\n尚未有 %s/data/config.json：先參考 stats.txt 寫好 config（可複製 tainan-city/data/config.json 改），再跑一次本程式。" % a.slug)
        return
    D = os.path.join(ROOT, a.slug, "data")
    off = [{k: o.get(k) for k in ["id", "name", "category", "level", "town", "types", "announced", "address",
                                  "lat", "lng", "open", "url", "caseId", "officialImg"]} for o in base]
    dump(off, os.path.join(D, "sites-official.json"))
    missing = sorted({o["category"] for o in base} - set(cfg["categories"]))
    if missing:
        print("注意：config.categories 缺少", missing, "（地圖上會看不到這些類別）")
    areas = cfg.get("ubikeAreas") or []
    if areas:
        yb = load(os.path.join(CACHE, "yb2.json"), [])
        st = [{"no": x["station_no"], "name": x["name_tw"].replace("YouBike2.0_", ""), "addr": x["district_tw"] + x["address_tw"],
               "lat": round(float(x["lat"]), 6), "lng": round(float(x["lng"]), 6), "spaces": x["parking_spaces"]}
              for x in yb if x["area_code"] in areas]
        dump({"meta": {"source": "YouBike 微笑單車官方站點資料 https://apis.youbike.com.tw/json/station-yb2.json",
                       "area_code": ",".join(areas), "note": "%s YouBike 2.0 站點；即時車輛於網頁上即時查詢" % a.city},
              "stations": st}, os.path.join(D, "ubike.json"), indent=0)
        print("ubike stations:", len(st))
    print("wrote", os.path.join(D, "sites-official.json"), len(off))


if __name__ == "__main__":
    main()
