"""兩個網站的對應：縣市資料夾放在哪個 repo、網站網址是什麼（tools/ 與 tools/newcity/ 的工具共用）

GitHub Pages 每個網站上限 1 GB，所以縣市分放兩個 repo（見 tools/newcity/README.md〈兩個網站〉）：
  第一網站 allanloplus/Cultural_Heritage   https://cultural.123hi.org/（自訂網域，CNAME）  （本 repo，共用程式、工具都在這裡）
  第二網站 allanloplus/Cultural_Heritage2  https://cultural2.123hi.org/（自訂網域，CNAME）  （只放縣市資料夾）

哪個縣市放哪裡、兩個網站的正式網址，都以 assets/js/cities.js 為準：清單裡的 site 欄位（沒寫的依 SITE2 那一行），以及 SITES 那一行。
  第一網站用自訂網域 https://cultural.123hi.org/（repo 的 CNAME）；第二網站用自訂網域 https://cultural2.123hi.org/。
第二網站 clone 的位置：環境變數 CH2_DIR，沒設就用本 repo 旁邊的 Cultural_Heritage2（例如 /home/user/Cultural_Heritage2）。

第二網站的縣市頁用第一網站的完整網址載入共用程式（tools/city_template.html 的 {{root}}）；
本機預覽時 tools/serve.py 會把這個網址換成 /Cultural_Heritage/。
"""
import os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _site2_dir():
    d = os.environ.get("CH2_DIR")
    if d:
        return os.path.abspath(d)
    parent = os.path.dirname(ROOT)
    for name in ("Cultural_Heritage2", "cultural_heritage2"):
        if os.path.isdir(os.path.join(parent, name)):
            return os.path.join(parent, name)
    return os.path.join(parent, "Cultural_Heritage2")


def _public_urls():
    """cities.js 的 SITES 那一行：各網站的正式網址"""
    txt = open(os.path.join(ROOT, "assets", "js", "cities.js"), encoding="utf-8").read()
    m = re.search(r"var SITES = \{([^}]*)\}", txt)
    return {int(k): v for k, v in re.findall(r'(\d+):\s*"([^"]+)"', m.group(1))}


_PUB = _public_urls()
# url：本機預覽（tools/serve.py）的路徑；public：正式網址
SITES = {
    1: {"repo": "allanloplus/Cultural_Heritage", "url": "/Cultural_Heritage/", "public": _PUB[1], "dir": ROOT},
    2: {"repo": "allanloplus/Cultural_Heritage2", "url": "/Cultural_Heritage2/", "public": _PUB[2], "dir": _site2_dir()},
}
# 縣市頁的共用資源路徑（{{root}}）：第一網站用相對路徑（行為與以前相同），第二網站用第一網站的正式網址
ASSET_ROOT = {1: "../", 2: SITES[1]["public"]}


def _parse_cities():
    """讀 assets/js/cities.js：回傳 ({slug: site}, {縣市名稱: site})"""
    txt = open(os.path.join(ROOT, "assets", "js", "cities.js"), encoding="utf-8").read()
    by_name = {}
    m = re.search(r"var SITE2 = \[([^\]]*)\]", txt)
    for n in re.findall(r'"([^"]+)"', m.group(1) if m else ""):
        by_name[n] = 2
    by_slug = {}
    for e in re.finditer(r'\{\s*slug:\s*"([^"]*)"(.*?)\}', txt, re.S):
        slug, rest = e.groups()
        nm = re.search(r'\bname:\s*"([^"]+)"', rest)
        if not nm:
            continue
        name = nm.group(1)
        s = re.search(r"\bsite:\s*(\d)", rest)
        site = int(s.group(1)) if s else by_name.get(name, 1)
        by_name[name] = site
        if slug:
            by_slug[slug] = site
    return by_slug, by_name


def site_of(slug=None, name=None):
    """縣市在哪個網站（1 或 2）。依序看 cities.js 的 slug、縣市名稱，再看資料夾實際在哪個 repo；都沒有就是 1。"""
    by_slug, by_name = _parse_cities()
    if slug and slug in by_slug:
        return by_slug[slug]
    if name:
        for v in (name, name.replace("台", "臺")):
            if v in by_name:
                return by_name[v]
    if slug and os.path.isdir(os.path.join(SITES[2]["dir"], slug)) and not os.path.isdir(os.path.join(ROOT, slug)):
        return 2
    return 1


def site_dir(site):
    return SITES[site]["dir"]


def city_dir(slug, name=None):
    """縣市資料夾的實際路徑（可能在第二網站的 clone）。第二網站的 clone 不存在時報錯，提醒先掛載。"""
    site = site_of(slug, name)
    d = site_dir(site)
    if site != 1 and not os.path.isdir(d):
        raise SystemExit("%s 放在第二網站，但找不到 %s 的 clone：%s\n請先掛載 allanloplus/Cultural_Heritage2，或用 CH2_DIR 指定位置（見 tools/newcity/README.md〈兩個網站〉）"
                         % (slug, SITES[site]["repo"], d))
    return os.path.join(d, slug)


def cities():
    """所有有 data/config.json 的縣市：[(slug, site)]，依網站、名稱排序。"""
    out = []
    for site in sorted(SITES):
        d = site_dir(site)
        if not os.path.isdir(d):
            continue
        for name in sorted(os.listdir(d)):
            if os.path.exists(os.path.join(d, name, "data", "config.json")):
                out.append((name, site))
    return out


if __name__ == "__main__":
    for k, v in SITES.items():
        print(k, v["repo"], v["public"], "本機 " + v["url"], v["dir"], "" if os.path.isdir(v["dir"]) else "（尚未 clone）")
    for slug, site in cities():
        print("  site %d  %s" % (site, slug))
