"""在已完成縣市的 sites-official.json 補上 ownership（私有／公有／不明），給 build_data.py 判斷私人宅第用
用法：python3 tools/newcity/add_ownership.py [slug ...]   # 不給 slug 就處理兩個網站的所有縣市
需要：先跑 fetch_sources.py（讀 /tmp/newcity/cache/boch/）。新縣市不用跑這支，build_base.py 會直接寫入。
只增加 ownership 欄位，其他欄位不變；跑完再執行 python3 tools/build_data.py。
"""
import os, sys
from common import CACHE, dump, load, ownership
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import sites as SITES  # noqa: E402

KINDS = ["1.1", "1.2", "1.3", "1.4", "2.1", "3.1"]


def main():
    rec = {}
    for k in KINDS:
        for x in load(os.path.join(CACHE, "boch", k + ".json"), []):
            rec[x["caseId"]] = x
    if not rec:
        raise SystemExit("找不到 %s/boch/*.json，請先跑 fetch_sources.py" % CACHE)
    want = set(sys.argv[1:])
    for slug, site in SITES.cities():
        if want and slug not in want:
            continue
        p = os.path.join(SITES.site_dir(site), slug, "data", "sites-official.json")
        off = load(p)
        if not off:
            continue
        n = {"私有": 0, "公有": 0, "不明": 0}
        for o in off:
            x = rec.get(o.get("caseId"))
            o["ownership"] = ownership(x) if x else "不明"
            n[o["ownership"]] += 1
        dump(off, p)
        print(slug, n)


if __name__ == "__main__":
    main()
