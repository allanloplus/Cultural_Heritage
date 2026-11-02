"""步驟 5：把內容 agent 的輸出合併進網站資料
用法：
  python3 tools/newcity/merge.py sites kaohsiung-city /tmp/newcity/kaohsiung-city/out/content-part*.json
  python3 tools/newcity/merge.py ich   kaohsiung-city /tmp/newcity/kaohsiung-city/out/ich-*.json
  python3 tools/newcity/merge.py eras  kaohsiung-city /tmp/newcity/kaohsiung-city/out/eras.json

sites：合併成 <slug>/data/sites-content.json；檢查 id 與 sites-official.json 完全一致、沒有重複，
       沒有行政區的景點用內容裡的座標無法補，會列出來請手動補 sites-official.json 的 town。
ich  ：items、venues 串接成 <slug>/data/ich.json；檢查 id 不重複、venueId／ichIds 互相對得上，
       relatedSiteId 不存在就清掉。
eras ：複製成 <slug>/data/eras.json。
三種都會：把對話裡的「羅顧問」改成 Allan、拒絕含 Email 的內容、跑 validate.py 的檢查（有錯誤就不寫檔）。
"""
import collections, json, os, re, sys
from common import ROOT, dump, load
import validate

CJK = r"[一-鿿]"


def fix(t):
    t = re.sub("(" + CJK + ")羅顧問", r"\1 羅顧問", t)
    t = re.sub("羅顧問(" + CJK + ")", r"Allan \1", t)
    return t.replace("羅顧問", "Allan")


def walk(o):
    if isinstance(o, str):
        return fix(o)
    if isinstance(o, list):
        return [walk(x) for x in o]
    if isinstance(o, dict):
        return {k: walk(v) for k, v in o.items()}
    return o


def gate(obj, kind):
    errs = []
    validate.private_scan(obj, errs)
    if kind == "sites":
        for c in obj:
            validate.check_lines(c["id"], c["dialogue"], errs)
            validate.check_quiz(c["id"], c["quiz"], errs, (2, 2))
    for w in validate.WARN:
        print(" ～ 提醒：", w)
    if errs:
        print("\n".join(" - " + e for e in errs[:60]))
        raise SystemExit("有 %d 個問題，未寫檔。請修正 agent 輸出後再合併。" % len(errs))


def main():
    if len(sys.argv) < 4:
        raise SystemExit(__doc__)
    kind, slug, files = sys.argv[1], sys.argv[2], sys.argv[3:]
    D = os.path.join(ROOT, slug, "data")
    if kind == "sites":
        content = []
        for f in files:
            content += load(f)
        content = walk(content)
        off = load(os.path.join(D, "sites-official.json"))
        offd = {o["id"]: o for o in off}
        ids = [c["id"] for c in content]
        dup = [k for k, v in collections.Counter(ids).items() if v > 1]
        missing, extra = sorted(set(offd) - set(ids)), sorted(set(ids) - set(offd))
        if dup or missing or extra:
            raise SystemExit("id 不一致：重複 %s；缺 %s；多出 %s" % (dup, missing, extra))
        gate(content, "sites")
        notown = [o["id"] for o in off if not o.get("town")]
        if notown:
            print("注意：這些景點沒有行政區，請手動補 sites-official.json 的 town：", notown)
        unk = [c["id"] for c in content if c.get("yearUnknown")]
        print("年代不詳：", unk or "無")
        print("時期分布：", dict(collections.Counter(c["era"] for c in content)))
        dump(content, os.path.join(D, "sites-content.json"))
        print("wrote sites-content.json", len(content))
    elif kind == "ich":
        site_ids = {o["id"] for o in load(os.path.join(D, "sites-official.json"), [])}
        out = {"items": [], "venues": []}
        for f in files:
            d = load(f)
            out["items"] += d["items"]; out["venues"] += d["venues"]
            print(f, len(d["items"]), "items", len(d["venues"]), "venues")
        out = walk(out)
        iid = [i["id"] for i in out["items"]]; vid = [v["id"] for v in out["venues"]]
        if len(iid) != len(set(iid)) or len(vid) != len(set(vid)):
            raise SystemExit("items 或 venues 的 id 重複（請讓不同 agent 用不同前綴，例如 venue-f-、venue-a-）")
        for i in out["items"]:
            if i.get("venueId") and i["venueId"] not in vid:
                raise SystemExit("venueId 不存在：%s → %s" % (i["id"], i["venueId"]))
            if i["id"].startswith(("site-", "era-")) or i["id"] in ("intro", "time-intro", "plan-intro", "game-intro", "reactions"):
                raise SystemExit("item id 會和語音檔名衝突：" + i["id"])
        for v in out["venues"]:
            bad = [x for x in v.get("ichIds", []) if x not in iid]
            if bad:
                raise SystemExit("ichIds 不存在：%s → %s" % (v["id"], bad))
            if v.get("relatedSiteId") and v["relatedSiteId"] not in site_ids:
                print("清掉不存在的 relatedSiteId：", v["id"], v["relatedSiteId"]); v["relatedSiteId"] = ""
        gate(out, "ich")
        nocoord = [v["name"] for v in out["venues"] if v.get("lat") is None]
        if nocoord:
            print("沒有座標（不會出現在地圖上，列表仍看得到）：", nocoord)
        dump(out, os.path.join(D, "ich.json"))
        print("wrote ich.json items", len(out["items"]), "venues", len(out["venues"]),
              "antiquities", sum(len(v.get("antiquities") or []) for v in out["venues"]))
    elif kind == "eras":
        d = walk(load(files[0]))
        errs, summary = validate.eras(files[0])
        print(summary)
        if errs:
            print("\n".join(" - " + e for e in errs))
            raise SystemExit("eras 有問題，未寫檔。")
        gate(d, "eras")
        dump(d, os.path.join(D, "eras.json"))
        print("wrote eras.json")
    else:
        raise SystemExit(__doc__)


if __name__ == "__main__":
    main()
