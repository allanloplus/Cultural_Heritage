"""合併各縣市資料 → <city>/js/data.js、<city>/index.html，並產生語音腳本 tools/script.json
用法：python3 tools/build_data.py   # 建立所有縣市（有 <city>/data/config.json 的資料夾）
接著：python3 tools/gen_audio.py

每個縣市資料夾 <city>/data/：
  config.json          縣市設定（地圖中心、YouBike 區碼、時光地圖圖層、行程設定、頁面文字）
  sites-official.json  文化部文化資產局開放資料（名稱、類別、地址、座標、官方連結）
  sites-content.json   導覽文字、雙人對話、題目（可含 lat/lng 修正後座標）
  images.json          Wikimedia Commons 圖片與授權
  eras.json            時光地圖各時期內容
  ich.json             無形文化資產、古物與展示地點
  ubike.json           YouBike 2.0 站點
  extra.json           開場對話、遊戲回饋、推薦行程、出發點
網頁共用程式在 assets/js/city/，版面在 tools/city_template.html。
兩個網站：放第二網站的縣市（assets/js/cities.js 的 site: 2）資料夾在 Cultural_Heritage2 的 clone（tools/sites.py），
這支程式會一併處理，頁面的共用資源改用 /Cultural_Heritage/assets/…（範本的 {{root}}）。
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))
import sites as SITES  # noqa: E402  兩個網站的對應


def load(path, default=None):
    if not os.path.exists(path):
        return default
    with open(path, encoding="utf-8") as f:
        return json.load(f)


CJK = r"[\u4e00-\u9fff]"


def fix_text(t):
    """對話中對導覽員的稱呼一律用「Allan」（中英文之間加半形空格）。"""
    t = re.sub("(" + CJK + ")羅顧問", r"\1 羅顧問", t)
    t = re.sub("羅顧問(" + CJK + ")", r"Allan \1", t)
    return t.replace("羅顧問", "Allan")


def fix_lines(lines):
    return [dict(l, text=fix_text(l["text"])) for l in (lines or [])]


def cities():
    """[(slug, site)]：兩個網站裡所有有 data/config.json 的縣市"""
    return SITES.cities()


def build_city(slug, site=1):
    city = os.path.join(SITES.site_dir(site), slug)
    D = os.path.join(city, "data")
    cfg = load(os.path.join(D, "config.json"))
    official = load(os.path.join(D, "sites-official.json"))
    content = {c["id"]: c for c in load(os.path.join(D, "sites-content.json"))}
    images = load(os.path.join(D, "images.json"), {})
    eras = load(os.path.join(D, "eras.json"), {"eras": [], "qingCity": None})
    ich = load(os.path.join(D, "ich.json"), {"items": [], "venues": []})
    ubike = load(os.path.join(D, "ubike.json"), {"meta": {}, "stations": []})
    extra = load(os.path.join(D, "extra.json"))
    cats = cfg["categories"]
    for c in content.values():
        c["dialogue"] = fix_lines(c["dialogue"])
    for e in eras.get("eras", []):
        e["dialogue"] = fix_lines(e.get("dialogue"))
    for i in ich.get("items", []):
        i["dialogue"] = fix_lines(i.get("dialogue"))
    for k in ("intro", "timeIntro", "planIntro", "gameIntro", "reactions"):
        extra[k] = fix_lines(extra.get(k))

    sites = []
    for o in official:
        c = content[o["id"]]
        lat = c.get("lat") if c.get("lat") is not None else o["lat"]
        lng = c.get("lng") if c.get("lng") is not None else o["lng"]
        addr = (o.get("address") or "").replace(cfg["name"], "")
        s = {
            "id": o["id"], "name": o["name"], "short": c["short"], "category": o["category"],
            "level": o.get("level") or "", "town": o.get("town") or "",
            "types": o.get("types") or [], "lat": round(lat, 6), "lng": round(lng, 6),
            "address": cfg["name"] + addr,
            "announced": o.get("announced"), "url": o["url"], "officialImg": o.get("officialImg"),
            "year": c["year"], "yearText": c["yearText"], "era": c["era"], "themes": c["themes"],
            "yearUnknown": bool(c.get("yearUnknown")),
            "summary": c["summary"], "intro": c["intro"], "highlights": c["highlights"],
            "funFact": c["funFact"], "photoSpot": c["photoSpot"], "visitMin": c["visitMin"],
            "openNote": c["openNote"], "dialogue": c["dialogue"], "clues": c["clues"], "quiz": c["quiz"],
            "images": images.get(o["id"], []),
        }
        if o.get("extraLinks"):  # 合併的紀錄：另一筆官方連結
            s["extraLinks"] = o["extraLinks"]
        sites.append(s)
    sites.sort(key=lambda s: (cats.index(s["category"]) if s["category"] in cats else 9, s["year"]))

    cfg_out = {k: v for k, v in cfg.items() if k != "html"}
    data = {
        "meta": {"city": cfg["name"], "slug": slug, "updated": "2026-11-01",
                 "designer": "Allan Lo", "designerSite": "https://www.123hi.org", "designed": "2026年11月", "ai": "Claude Opus 5.5"},
        "config": cfg_out,
        "categories": cats,
        "sites": sites,
        "eras": eras.get("eras", []),
        "qingCity": eras.get("qingCity"),
        "ich": ich,
        "ubike": ubike,
        "extra": extra,
    }
    os.makedirs(os.path.join(city, "js"), exist_ok=True)
    with open(os.path.join(city, "js", "data.js"), "w", encoding="utf-8") as f:
        f.write("/* 由 tools/build_data.py 產生，請改 %s/data/*.json 後重新產生 */\nwindow.CY = " % slug)
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";\n")

    # 頁面
    tpl = open(os.path.join(ROOT, "tools", "city_template.html"), encoding="utf-8").read()
    vals = dict(cfg["html"], name=cfg["name"], short=cfg["short"], slug=slug, root=SITES.ASSET_ROOT[site])
    html = re.sub(r"\{\{(\w+)\}\}", lambda m: vals[m.group(1)], tpl)
    with open(os.path.join(city, "index.html"), "w", encoding="utf-8") as f:
        f.write(html)

    tracks = [
        {"id": "intro", "lines": extra["intro"]},
        {"id": "time-intro", "lines": extra["timeIntro"]},
        {"id": "plan-intro", "lines": extra["planIntro"]},
        {"id": "game-intro", "lines": extra["gameIntro"]},
        {"id": "reactions", "lines": extra["reactions"]},
    ]
    tracks += [{"id": "site-" + s["id"], "lines": s["dialogue"]} for s in sites]
    tracks += [{"id": "era-" + e["id"], "lines": e["dialogue"]} for e in data["eras"] if e.get("dialogue")]
    tracks += [{"id": i["id"], "lines": i["dialogue"]} for i in ich.get("items", []) if i.get("dialogue")]
    print(slug, "sites", len(sites), "eras", len(data["eras"]), "ich", len(ich.get("items", [])),
          "ubike", len(ubike.get("stations", [])), "tracks", len(tracks))
    g = {"dir": slug + "/audio", "tracks": tracks}
    if site != 1:
        g["site"] = site  # gen_audio.py 依這個欄位寫到第二網站的 clone
    return g


def main():
    groups = []
    if not os.path.isdir(SITES.site_dir(2)):
        print("（找不到第二網站的 clone %s，只處理第一網站的縣市）" % SITES.site_dir(2))
    for c, site in cities():  # 每次都建所有縣市（很快），語音腳本才會完整
        if not os.path.exists(os.path.join(SITES.site_dir(site), c, "data", "sites-content.json")):
            print("skip", c, "(尚未有 sites-content.json)")
            continue
        if site != 1:
            print("[第%d網站]" % site, end=" ")
        groups.append(build_city(c, site))
    portal = load(os.path.join(ROOT, "tools", "portal.json"))
    # 入口頁語音放最前面：它很短，又是所有人第一個聽到的
    groups.insert(0, {"dir": "audio", "tracks": [{"id": "portal", "lines": fix_lines(portal["dialogue"])}]})
    for g in groups:
        for t in g["tracks"]:
            for l in t["lines"]:
                if l["who"] not in ("A", "R") or not l["text"].strip():
                    raise SystemExit("invalid line in %s/%s: %r" % (g["dir"], t["id"], l))
    with open(os.path.join(ROOT, "tools", "script.json"), "w", encoding="utf-8") as f:
        json.dump({"groups": groups}, f, ensure_ascii=False, indent=1)
    print("lines", sum(len(t["lines"]) for g in groups for t in g["tracks"]))
    try:  # 容量提醒（GitHub Pages 上限 1 GB；700 MB 時要問使用者是否搬遷，見 tools/newcity/README.md〈容量管理〉）
        sys.path.insert(0, os.path.join(ROOT, "tools", "newcity"))
        import size_report
        for site in sorted(SITES.SITES):
            if os.path.isdir(SITES.site_dir(site)):
                print(size_report.status_line(size_report.report(site)[0], site))
    except Exception as e:
        print("（容量檢查略過：%s）" % e)


if __name__ == "__main__":
    main()
