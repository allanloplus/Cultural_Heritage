"""步驟 1：下載原始資料到 /tmp/newcity/cache/（已下載過就略過）
用法：python3 tools/newcity/fetch_sources.py 高雄市

下載內容：
  boch/<類別>.json  文化部文化資產局開放資料（全臺，每類一個檔）
      1.1 古蹟  1.2 歷史建築  1.3 聚落建築群  1.4 紀念建築  2.1 考古遺址  3.1 文化景觀
      4.1 傳統表演藝術  4.2 傳統工藝  5.1 民俗  5.2 口述傳統  5.3 傳統知識與實踐  6.1 古物
      注意：1.1、1.2、6.1 很大（6～12 MB），伺服器慢，一個檔可能要 10 分鐘以上。
      6.1（古物）要用舊版網址 /opendata/assetsCase/6.1.json；其他用 /opendata/v2/。
      保存技術及保存者不在這裡，內容 agent 可用 https://nchdb.boch.gov.tw/data/api 查。
  yb2.json          YouBike 2.0 全臺站點（area_code：08 嘉義市、11 嘉義縣、12 高雄市、13 臺南市…）
  wiki/<頁名>.json  中文維基百科「<縣市>文化資產」「<縣市>古蹟列表」「<縣市>歷史建築列表」的 wikitext（找不到的頁面會略過）
"""
import json, os, sys, time, urllib.parse
from common import CACHE, get

BOCH = ["1.1", "1.2", "1.3", "1.4", "2.1", "3.1", "4.1", "4.2", "5.1", "5.2", "5.3", "6.1"]


def boch_url(c):
    if c == "6.1":
        return "https://data.boch.gov.tw/opendata/assetsCase/6.1.json"
    return "https://data.boch.gov.tw/opendata/v2/assetsCase/%s.json" % c


def fetch_json(url, path, timeout=1500):
    if os.path.exists(path):
        try:
            d = json.load(open(path, encoding="utf-8"))
            if d:
                print("cached", path)
                return
        except Exception:
            pass
    raw = get(url, timeout=timeout)
    d = json.loads(raw)  # 不是 JSON 就讓它報錯，不要存壞檔
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(raw)
    print("saved", path, len(raw), "bytes", len(d) if isinstance(d, list) else "")


def main():
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    city = sys.argv[1]
    for c in BOCH:
        fetch_json(boch_url(c), os.path.join(CACHE, "boch", c + ".json"))
    fetch_json("https://apis.youbike.com.tw/json/station-yb2.json", os.path.join(CACHE, "yb2.json"), timeout=120)
    for title in (city + "文化資產", city + "古蹟列表", city + "歷史建築列表"):
        path = os.path.join(CACHE, "wiki", title + ".json")
        if os.path.exists(path):
            print("cached", path)
            continue
        url = ("https://zh.wikipedia.org/w/api.php?action=parse&format=json&formatversion=2&redirects=1&prop=wikitext&page="
               + urllib.parse.quote(title))
        d = json.loads(get(url, timeout=60))
        if "error" in d:
            print("no wiki page:", title, d["error"].get("info"))
        else:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            json.dump(d, open(path, "w", encoding="utf-8"), ensure_ascii=False)
            print("saved", path, len(d["parse"]["wikitext"]), "chars")
        time.sleep(5)


if __name__ == "__main__":
    main()
