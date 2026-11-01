"""合併嘉義市資料 → chiayi-city/js/data.js，並產生語音腳本 tools/script.json
用法：python3 tools/build_data.py && python3 tools/gen_audio.py
資料來源（chiayi-city/data/）：
  sites-official.json  文化部文化資產局開放資料（名稱、類別、地址、座標、官方連結）
  sites-content.json   導覽文字、雙人對話、題目
  images.json          Wikimedia Commons 圖片與授權
  eras.json            時光地圖各時期內容
  ich.json             無形文化資產、古物與展示地點
  ubike.json           YouBike 2.0 嘉義市站點
  extra.json           開場對話、遊戲回饋、推薦行程
"""
import json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CITY = os.path.join(ROOT, "chiayi-city")
D = os.path.join(CITY, "data")


def load(name, default=None):
    p = os.path.join(D, name)
    if not os.path.exists(p):
        return default
    with open(p, encoding="utf-8") as f:
        return json.load(f)


CAT_ORDER = ["國定古蹟", "市定古蹟", "歷史建築", "聚落建築群", "文化景觀"]


def main():
    official = load("sites-official.json")
    content = {c["id"]: c for c in load("sites-content.json")}
    images = load("images.json", {})
    eras = load("eras.json", {"eras": [], "qingCity": None})
    ich = load("ich.json", {"items": [], "venues": []})
    ubike = load("ubike.json")
    extra = load("extra.json")

    sites = []
    for o in official:
        c = content[o["id"]]
        s = {
            "id": o["id"], "name": o["name"], "short": c["short"], "category": o["category"],
            "types": o.get("types") or [], "lat": round(o["lat"], 6), "lng": round(o["lng"], 6),
            "address": "嘉義市" + (o.get("address") or "").replace("嘉義市", ""),
            "announced": o.get("announced"), "url": o["url"], "officialImg": o.get("officialImg"),
            "year": c["year"], "yearText": c["yearText"], "era": c["era"], "themes": c["themes"],
            "summary": c["summary"], "intro": c["intro"], "highlights": c["highlights"],
            "funFact": c["funFact"], "photoSpot": c["photoSpot"], "visitMin": c["visitMin"],
            "openNote": c["openNote"], "dialogue": c["dialogue"], "clues": c["clues"], "quiz": c["quiz"],
            "images": images.get(o["id"], []),
        }
        sites.append(s)
    sites.sort(key=lambda s: (CAT_ORDER.index(s["category"]) if s["category"] in CAT_ORDER else 9, s["year"]))

    data = {
        "meta": {"city": "嘉義市", "slug": "chiayi-city", "updated": "2026-11-01",
                 "designer": "Allan Lo", "designed": "2026/11/1", "ai": "Claude Opus 5.5"},
        "categories": CAT_ORDER,
        "sites": sites,
        "eras": eras.get("eras", []),
        "qingCity": eras.get("qingCity"),
        "ich": ich,
        "ubike": ubike,
        "extra": extra,
    }
    os.makedirs(os.path.join(CITY, "js"), exist_ok=True)
    with open(os.path.join(CITY, "js", "data.js"), "w", encoding="utf-8") as f:
        f.write("/* 由 tools/build_data.py 產生，請改 chiayi-city/data/*.json 後重新產生 */\nwindow.CY = ")
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";\n")

    # ---- 語音腳本 ----
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
    portal = json.load(open(os.path.join(ROOT, "tools", "portal.json"), encoding="utf-8"))
    script = {"groups": [
        {"dir": "chiayi-city/audio", "tracks": tracks},
        {"dir": "audio", "tracks": [{"id": "portal", "lines": portal["dialogue"]}]},
    ]}
    bad = []
    for g in script["groups"]:
        for t in g["tracks"]:
            for l in t["lines"]:
                if l["who"] not in ("A", "R") or not l["text"].strip():
                    bad.append((t["id"], l))
    if bad:
        raise SystemExit("invalid lines: %r" % bad[:5])
    with open(os.path.join(ROOT, "tools", "script.json"), "w", encoding="utf-8") as f:
        json.dump(script, f, ensure_ascii=False, indent=1)
    n = sum(len(t["lines"]) for g in script["groups"] for t in g["tracks"])
    print("sites", len(sites), "eras", len(data["eras"]), "ich", len(ich.get("items", [])),
          "tracks", sum(len(g["tracks"]) for g in script["groups"]), "lines", n)


if __name__ == "__main__":
    main()
