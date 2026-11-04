"""檢查內容 agent 的輸出（給 agent 自我檢查，也給整合時把關）
用法：
  python3 tools/newcity/validate.py sites <content-partN.json> [--base /tmp/newcity/<slug>/sites_base.json]
  python3 tools/newcity/validate.py ich   <ich-xxx.json>
  python3 tools/newcity/validate.py eras  <eras.json>
有錯誤時結束碼為 1，並列出每一筆問題。規則見 tools/newcity/SPEC.md。
"""
import collections, json, re, sys

OK_PUNCT = "，。！？、："
LATIN_OK = {"Allan", "YouBike"}
SITE_KEYS = ["id", "short", "year", "yearText", "era", "themes", "summary", "intro", "highlights", "funFact", "photoSpot",
             "visitMin", "openNote", "dialogue", "clues", "quiz", "lat", "lng", "coordNote"]
ERAS = {"prehistoric", "dutch", "zheng", "qing", "japan", "postwar", "modern", "unknown"}
ICH_ITEM = ["id", "name", "type", "holder", "registered", "summary", "intro", "whereToSee", "venueId", "dialogue", "quiz", "url"]
ICH_VENUE = ["id", "name", "address", "lat", "lng", "relatedSiteId", "ichIds", "antiquities"]
ERA_IDS = ["dutch", "zheng", "qing", "japan", "early-roc", "roc60", "now"]
PRIVATE = [(r"(?<![A-Za-z0-9])[A-Z][12]\d{8}(?!\d)", "疑似身分證字號"), (r"\S+@\S+\.\S+", "疑似 Email"), (r"(?<![\d/])09\d{2}-?\d{3}-?\d{3}(?!\d)", "疑似手機號碼")]


def check_lines(where, lines, errs, lo=6, hi=10):
    if not isinstance(lines, list) or not (lo <= len(lines) <= hi):
        errs.append("%s: dialogue 應為 %d～%d 句，現在 %s" % (where, lo, hi, len(lines) if isinstance(lines, list) else "不是陣列"))
        return
    for k, l in enumerate(lines):
        t = l.get("text", "")
        if l.get("who") not in ("A", "R"):
            errs.append("%s: 第 %d 句 who 必須是 A 或 R" % (where, k + 1))
        if not (15 <= len(t) <= 70):
            errs.append("%s: 第 %d 句長度 %d（應 15～70 字）：%s" % (where, k + 1, len(t), t[:30]))
        bad = [c for c in t if not ("一" <= c <= "鿿" or c.isdigit() or c in OK_PUNCT or c.isascii() and c.isalpha() or c in " 「」")]
        if bad:
            errs.append("%s: 第 %d 句有不允許的符號 %r" % (where, k + 1, "".join(sorted(set(bad)))))
        for w in re.findall(r"[A-Za-z]+", t):
            if w not in LATIN_OK:
                errs.append("%s: 第 %d 句有英文 %r（只允許 Allan、YouBike）" % (where, k + 1, w))
        if "羅顧問" in t or "顧問" in t:
            errs.append("%s: 第 %d 句請稱呼 Allan，不要用顧問" % (where, k + 1))


def check_quiz(where, qs, errs, n=(1, 2), answers=None):
    if not isinstance(qs, list) or not (n[0] <= len(qs) <= n[1]):
        errs.append("%s: quiz 應有 %d～%d 題" % (where, n[0], n[1]))
        return
    for q in qs:
        if len(q.get("options", [])) != 4 or q.get("answer") not in (0, 1, 2, 3) or not q.get("q") or not q.get("explain"):
            errs.append("%s: quiz 格式錯誤（要 q、4 個 options、answer 0～3、explain）：%s" % (where, q.get("q", "")[:20]))
        elif answers is not None:
            answers[q["answer"]] += 1


WARN = []  # 只提醒、不算錯誤
# 官方原文就是這樣寫的人名、地名用字（雖然 OpenCC 會轉換），照原文保留：
#   莅：臺南北門嶼陳家古厝官方資料「陳林莅」
OFFICIAL_CHARS = set("莅却糍")  # 却：恆春民謠保存者「黃却銀」，屏東縣府 2025 年姓名更正公告的正式寫法；糍：臺中「麻糍埔考古遺址」的正式名稱


def big5_scan(obj, errs):
    """簡體字檢查：不在 Big5（CP950）裡的字，若 OpenCC 會把它轉成別的繁體字（湾→灣、猫→貓、图→圖）就是簡體字，算錯誤；
    其他非 Big5 字多半是罕用字或日文漢字（礮、廍、壠、狛），只列為提醒，確認是正式名稱或史料用字即可保留。
    需要：pip install opencc-python-reimplemented（沒裝時全部只列為提醒）。"""
    try:
        from opencc import OpenCC
        s2t = OpenCC("s2t").convert
    except ImportError:
        s2t = None
        WARN.append("未安裝 opencc-python-reimplemented，簡體字只做初步檢查")
    s = json.dumps(obj, ensure_ascii=False)
    odd = collections.Counter()
    for c in s:
        if "\u4e00" <= c <= "\u9fff":
            try:
                c.encode("cp950")
            except UnicodeEncodeError:
                odd[c] += 1
    for c, n in odd.most_common():
        i = s.index(c)
        ctx = s[max(0, i - 10):i + 6].replace("\n", " ")
        if s2t and s2t(c) != c and c not in OFFICIAL_CHARS:
            errs.append("簡體字「%s」×%d，請改成「%s」：…%s…" % (c, n, s2t(c), ctx))
        else:
            WARN.append("罕用字「%s」×%d（請確認是正式名稱或史料用字）：…%s…" % (c, n, ctx))


def private_scan(obj, errs):
    big5_scan(obj, errs)
    s = json.dumps(obj, ensure_ascii=False)
    for rx, what in PRIVATE:
        for m in re.findall(rx, s)[:3]:
            errs.append("%s：%s" % (what, m))


def sites(path, base_path=None):
    data = json.load(open(path, encoding="utf-8")); errs = []; answers = collections.Counter()
    names = {}
    if base_path:
        names = {o["id"]: o["name"] for o in json.load(open(base_path, encoding="utf-8"))}
    for c in data:
        w = c.get("id", "?")
        miss = [k for k in SITE_KEYS if k not in c]
        if miss:
            errs.append("%s: 缺欄位 %s" % (w, miss))
            continue
        if names and w not in names:
            errs.append("%s: id 不在 sites_base.json" % w)
        if c["era"] not in ERAS:
            errs.append("%s: era %r 不在允許清單" % (w, c["era"]))
        if c["era"] == "unknown" and not c.get("yearUnknown"):
            errs.append("%s: era 為 unknown 時要加 yearUnknown: true" % w)
        if not isinstance(c["year"], int):
            errs.append("%s: year 要是整數" % w)
        if not (1 <= len(c["themes"]) <= 3):
            errs.append("%s: themes 要 1～3 個" % w)
        if len(c["highlights"]) != 3 or len(c["clues"]) != 3:
            errs.append("%s: highlights 與 clues 各要 3 則" % w)
        nm = names.get(w) or ""
        core = re.sub(r"[（(].*?[)）]", "", nm)
        for cl in c["clues"]:
            if core and (core in cl or c["short"] in cl):
                errs.append("%s: 線索不能出現名稱：%s" % (w, cl[:30]))
        if c["lat"] is None or c["lng"] is None or not (20.5 < c["lat"] < 26.5 and 116 < c["lng"] < 122.5):
            errs.append("%s: lat/lng 不合理 %s,%s" % (w, c["lat"], c["lng"]))
        check_lines(w, c["dialogue"], errs)
        check_quiz(w, c["quiz"], errs, (2, 2), answers)
    private_scan(data, errs)
    return errs, "%d 處；正確答案位置分布 %s" % (len(data), dict(sorted(answers.items())))


def ich(path):
    d = json.load(open(path, encoding="utf-8")); errs = []; answers = collections.Counter()
    items, venues = d.get("items", []), d.get("venues", [])
    vids = {v.get("id") for v in venues}; iids = {i.get("id") for i in items}
    for i in items:
        w = i.get("id", "?")
        miss = [k for k in ICH_ITEM if k not in i]
        if miss:
            errs.append("%s: 缺欄位 %s" % (w, miss)); continue
        if i["venueId"] and i["venueId"] not in vids:
            errs.append("%s: venueId %s 不存在" % (w, i["venueId"]))
        check_lines(w, i["dialogue"], errs)
        check_quiz(w, i["quiz"], errs, (1, 2), answers)
    for v in venues:
        w = v.get("id", "?")
        miss = [k for k in ICH_VENUE if k not in v]
        if miss:
            errs.append("%s: 缺欄位 %s" % (w, miss)); continue
        bad = [x for x in v["ichIds"] if x not in iids]
        if bad:
            errs.append("%s: ichIds 不存在 %s" % (w, bad))
    if len(iids) != len(items) or len(vids) != len(venues):
        errs.append("id 重複")
    private_scan(d, errs)
    return errs, "%d 項、%d 處展示點、%d 件古物；答案分布 %s" % (
        len(items), len(venues), sum(len(v.get("antiquities") or []) for v in venues), dict(sorted(answers.items())))


def eras(path):
    d = json.load(open(path, encoding="utf-8")); errs = []
    ids = [e.get("id") for e in d.get("eras", [])]
    if ids != ERA_IDS:
        errs.append("eras 的 id 與順序應為 %s，現在 %s" % (ERA_IDS, ids))
    for e in d.get("eras", []):
        w = "era-%s" % e.get("id")
        for k in ("name", "range", "title", "summary", "events", "landmarks", "view", "dialogue", "quiz", "sources"):
            if k not in e:
                errs.append("%s: 缺欄位 %s" % (w, k))
        check_lines(w, e.get("dialogue", []), errs, 4, 12)
        check_quiz(w, e.get("quiz", []), errs, (1, 3))
        for lm in e.get("landmarks", []):
            if lm.get("lat") is None or not (21.5 < lm["lat"] < 26.5):
                errs.append("%s: 地標座標不合理 %s" % (w, lm.get("name")))
    return errs, "%d 個時期；qingCity=%s" % (len(ids), "有" if d.get("qingCity") else "無")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        raise SystemExit(__doc__)
    kind, path = sys.argv[1], sys.argv[2]
    base = sys.argv[sys.argv.index("--base") + 1] if "--base" in sys.argv else None
    errs, summary = {"sites": lambda: sites(path, base), "ich": lambda: ich(path), "eras": lambda: eras(path)}[kind]()
    print(summary)
    for w in WARN:
        print(" ～ 提醒：", w)
    for e in errs:
        print(" -", e)
    print("OK" if not errs else "%d 個問題" % len(errs))
    sys.exit(1 if errs else 0)
