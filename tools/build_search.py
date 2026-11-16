"""產生全站搜尋的索引：assets/search/index.json（精簡索引）與 assets/search/intro.json（詳細介紹全文）

入口頁的「搜尋全臺文化資產」讀這兩個檔。兩個網站（第一網站、第二網站）22 個縣市的有形文化資產、無形文化資產與古物都收在一起。
  index.json：每筆的名稱、類別、縣市、鄉鎮、年代、摘要與搜尋用的關鍵字（簡稱、地址、建築類型、主題、保存者、展示點），使用者第一次點搜尋框時載入。
  intro.json：與 index.json 的 items 同順序的詳細內容（介紹、亮點、趣聞、參與方式；沒有的是空字串），送出搜尋後才在背景載入，用來找出「介紹中提到」的結果。

用法（兩個網站的資料有更新後執行，並提交 assets/search/）：
  python3 tools/build_search.py
第二網站的 clone 位置見 tools/sites.py（環境變數 CH2_DIR，沒設就找本 repo 旁邊的 Cultural_Heritage2）。
"""
import hashlib, json, os, re, sys, datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sites as S  # noqa: E402

ROOT = S.ROOT
OUT = os.path.join(ROOT, "assets", "search")

txt = open(os.path.join(ROOT, "assets", "js", "cities.js"), encoding="utf-8").read()
meta = {}
for m in re.finditer(r'\{\s*slug:\s*"([^"]+)",\s*name:\s*"([^"]+)"(.*?)\}', txt, re.S):
    slug, name, rest = m.groups()
    if not re.search(r"on:\s*true", rest):
        continue
    lm = re.search(r'label:\s*"([^"]+)"', rest)
    meta[slug] = (name, lm.group(1) if lm else name)

# 依地區排列：北、中、南、東、離島（縣市篩選的順序）
ORDER = ["keelung-city", "taipei-city", "new-taipei-city", "taoyuan-city", "hsinchu-city", "hsinchu-county", "miaoli-county",
         "taichung-city", "changhua-county", "nantou-county", "yunlin-county", "chiayi-city", "chiayi-county", "tainan-city",
         "kaohsiung-city", "pingtung-county", "yilan-county", "hualien-county", "taitung-county", "penghu-county",
         "kinmen-county", "lienchiang-county"]
cities = [c for c in S.cities() if c[0] in meta]
cities.sort(key=lambda c: ORDER.index(c[0]) if c[0] in ORDER else 99)
missing = [s for s in meta if s not in dict(cities)]
if missing:
    print("注意：cities.js 有、但找不到資料夾的縣市（第二網站是否已 clone？）：", "、".join(missing))


def load(p, default=None):
    return json.load(open(p, encoding="utf-8")) if os.path.exists(p) else default


def town_of(address, county):
    """從展示點地址取出鄉鎮市區，例如「臺南市西港區慶安路32號」→「西港區」"""
    a = (address or "").replace("台", "臺").strip()
    for c in (county, county.replace("縣", "市")):
        if a.startswith(c):
            a = a[len(c):]
    m = re.match(r"(.{1,4}?[鄉鎮市區])", a)
    return m.group(1) if m else ""


def clean(*parts):
    return " ".join(p for p in parts if p).replace("\n", " ")


counties, items, intros = [], [], []
n = {"site": 0, "ich": 0, "anti": 0, "thumb": 0}
for ci, (slug, site) in enumerate(cities):
    name, label = meta[slug]
    base = S.SITES[site]["public"] + slug + "/"
    counties.append([slug, label, base])
    d = os.path.join(S.site_dir(site), slug)
    off = load(os.path.join(d, "data", "sites-official.json"), [])
    con = {c["id"]: c for c in load(os.path.join(d, "data", "sites-content.json"), [])}
    for s in off:
        c = con.get(s["id"], {})
        thumb = 1 if os.path.exists(os.path.join(d, "img", s["id"] + "-0-s.webp")) else 0
        n["thumb"] += thumb
        # [類別 0=有形, 縣市序號, id, 名稱, 等級, 鄉鎮, 年代, 摘要, 有縮圖, 搜尋用關鍵字]
        items.append([0, ci, s["id"], s["name"], s.get("category") or "", s.get("town") or "", c.get("yearText") or "",
                      c.get("summary") or "", thumb,
                      clean(c.get("short") if c.get("short") and c.get("short") not in s["name"] else "", s.get("address"),
                            " ".join(s.get("types") or []), " ".join(c.get("themes") or []))])
        intros.append(clean(c.get("intro"), " ".join(c.get("highlights") or []), c.get("funFact")))
        n["site"] += 1
    ich = load(os.path.join(d, "data", "ich.json"), {}) or {}
    venues = {v["id"]: v for v in ich.get("venues", [])}
    at = {}
    for v in ich.get("venues", []):
        for i in v.get("ichIds", []):
            at.setdefault(i, v["id"])
    for i in ich.get("items", []):
        vid = at.get(i["id"]) or i.get("venueId") or ""
        v = venues.get(vid, {})
        # 無形文資：id 欄位放展示點 id（縣市頁 #map/<展示點 id> 會列出這一項）；沒有固定地點的是空字串
        items.append([1, ci, vid, i["name"], i.get("type") or "無形文資", town_of(v.get("address"), name), i.get("registered", "")[:4],
                      i.get("summary") or "", 0, clean(i.get("holder"), v.get("name"), v.get("address"))])
        intros.append(clean(i.get("intro"), i.get("whereToSee")))
        n["ich"] += 1
    for v in ich.get("venues", []):
        for a in v.get("antiquities") or []:
            items.append([2, ci, v["id"], a["name"], a.get("level") or "古物", town_of(v.get("address"), name),
                          (a.get("registered") or "")[:4], a.get("note") or "", 0, clean("收藏展示：" + v["name"], v.get("address"))])
            intros.append("")
            n["anti"] += 1

os.makedirs(OUT, exist_ok=True)
index = {"meta": {"generated": datetime.date.today().isoformat(),
                  "fields": ["kind", "county", "id", "name", "category", "town", "year", "summary", "thumb", "keywords"],
                  "kinds": ["有形文化資產", "無形文化資產", "古物"], "count": n},
         "counties": counties, "items": items}
body = json.dumps(index, ensure_ascii=False, separators=(",", ":"))
# 兩個檔要成對：index.json 記錄 intro.json 的版本，網頁發現不一致（例如只更新了其中一個的快取）時不使用介紹全文
ibody = json.dumps(intros, ensure_ascii=False, separators=(",", ":"))
index["meta"]["introHash"] = hashlib.sha1(ibody.encode("utf-8")).hexdigest()[:12]
body = json.dumps(index, ensure_ascii=False, separators=(",", ":"))
open(os.path.join(OUT, "index.json"), "w", encoding="utf-8").write(body)
open(os.path.join(OUT, "intro.json"), "w", encoding="utf-8").write('{"hash":"%s","intro":%s}' % (index["meta"]["introHash"], ibody))
print("寫入 assets/search/：%d 個縣市，有形 %d 處（有縮圖 %d）、無形 %d 項、古物 %d 件；index.json %d KB、intro.json %d KB"
      % (len(counties), n["site"], n["thumb"], n["ich"], n["anti"],
         os.path.getsize(os.path.join(OUT, "index.json")) // 1024, os.path.getsize(os.path.join(OUT, "intro.json")) // 1024))
