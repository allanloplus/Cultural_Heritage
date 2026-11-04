"""容量檢查：分網站統計發布的總大小，各自對照 GitHub Pages 1 GB 上限，並提醒是否該搬遷
用法：
  python3 tools/newcity/size_report.py                          # 兩個網站的目前用量與各縣市明細
  python3 tools/newcity/size_report.py --site 2                 # 只看第二網站
  python3 tools/newcity/size_report.py --next 600 --city 臺北市  # 再加一個約 600 處（有形＋無形）的縣市，預估它所在網站會到多少
                                                                 # （--city 填縣市名稱或 slug，依 assets/js/cities.js 判斷網站；也可用 --site）

兩個網站（見 tools/sites.py、作業手冊〈兩個網站〉）：
  第一網站 Cultural_Heritage（本 repo，含共用程式）、第二網站 Cultural_Heritage2（另一個 clone，CH2_DIR 可指定位置）。
  每個網站各自 1 GB，各自計算門檻。
什麼時候跑：開工前（手冊步驟 0）、開放縣市前（步驟 11）。tools/build_data.py 每次執行也會印出各網站一行摘要。
門檻（見作業手冊〈容量管理〉）：
  700 MB：提醒。開放下一個縣市之前，先請使用者決定怎麼辦。
  900 MB：停止。這個網站不要再開放新縣市。
計算方式：所有會發布的檔案（git 追蹤中＋尚未加入但沒被 .gitignore 排除的），不含 .git 與語音快取。
"""
import argparse, collections, json, os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, "tools"))
import sites as SITES  # noqa: E402
LIMIT = 1024          # GitHub Pages 每個發布網站的上限（MB）
WARN, STOP = 700, 900
NAMES = {1: "第一網站（Cultural_Heritage）", 2: "第二網站（Cultural_Heritage2）"}


def published_files(d):
    out = subprocess.check_output(["git", "ls-files", "-z", "--cached", "--others", "--exclude-standard"], cwd=d)
    return [f for f in out.decode("utf-8").split("\0") if f and os.path.isfile(os.path.join(d, f))]


def report(site=1):
    """回傳 (總 MB, {縣市: (MB, 文資數)}, 每處平均 MB)；site 為 1 或 2"""
    d = SITES.site_dir(site)
    size = collections.Counter()
    for f in published_files(d):
        top = f.split("/")[0] if "/" in f else "(根目錄)"
        size[top] += os.path.getsize(os.path.join(d, f))
    total = sum(size.values()) / 1048576
    cities = {}
    for c, b in size.items():
        D = os.path.join(d, c, "data")
        if not os.path.exists(os.path.join(D, "config.json")):
            continue
        n = 0
        for fn, key in (("sites-official.json", None), ("ich.json", "items")):
            p = os.path.join(D, fn)
            if os.path.exists(p):
                x = json.load(open(p, encoding="utf-8"))
                n += len(x[key] if key else x)
        cities[c] = (b / 1048576, n)
    items = sum(n for _, n in cities.values())
    per = sum(mb for mb, _ in cities.values()) / items if items else 0.35
    return total, cities, per


def status_line(total, site=1):
    pct = total / LIMIT * 100
    who = NAMES[site]
    if total >= STOP:
        return "⛔ %s %.0f MB（1 GB 的 %.0f%%）：已超過 %d MB，這個網站不要再開放新縣市，請先和使用者討論（見作業手冊〈容量管理〉）" % (who, total, pct, STOP)
    if total >= WARN:
        return "⚠️ %s %.0f MB（1 GB 的 %.0f%%）：已超過 %d MB，這個網站開放下一個縣市前請先問使用者（見作業手冊〈容量管理〉）" % (who, total, pct, WARN)
    return "容量：%s %.0f MB（GitHub Pages 上限 1 GB 的 %.0f%%；%d MB 時提醒）" % (who, total, pct, WARN)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--next", type=int, default=0, help="下一個縣市的有形＋無形文資數，用來預估")
    ap.add_argument("--city", help="下一個縣市的名稱或 slug（決定預估哪個網站）")
    ap.add_argument("--site", type=int, choices=sorted(SITES.SITES), help="只看這個網站")
    a = ap.parse_args()
    target = a.site or (SITES.site_of(a.city, a.city) if a.city else None)
    if a.next and not target:
        target = 1
        print("（沒有指定 --city 或 --site，預估第一網站）")
    reports = {}
    for site in sorted(SITES.SITES):
        if os.path.isdir(os.path.join(SITES.site_dir(site), ".git")):
            reports[site] = report(site)
        elif site == target or site == a.site:
            print("（找不到%s的 clone：%s，視為空網站）" % (NAMES[site], SITES.site_dir(site)))
    # 每處平均：兩個網站所有縣市合起來算，比較準
    allc = [v for r in reports.values() for v in r[1].values()]
    n_all = sum(n for _, n in allc)
    per = sum(mb for mb, _ in allc) / n_all if n_all else 0.35
    for site in sorted(SITES.SITES):
        if a.site and site != a.site:
            continue
        total, cities, _ = reports.get(site, (0.0, {}, per))
        print("== %s %s" % (NAMES[site], SITES.SITES[site]["url"]))
        print("縣市              大小      文資數  每處")
        for d, (mb, n) in sorted(cities.items(), key=lambda x: -x[1][0]):
            print("  %-16s %6.1f MB  %5d  %.2f MB" % (d, mb, n, mb / n if n else 0))
        print("合計（含共用檔案）%.1f MB" % total)
        print("距離 %d MB 提醒線還有 %.0f MB，約可再容納 %d 處文資" % (WARN, max(0, WARN - total), max(0, WARN - total) / per))
        if a.next and site == target:
            after = total + a.next * per
            print("預估%s加入 %d 處後：%.0f MB（1 GB 的 %.0f%%）" % ("「%s」" % a.city if a.city else "", a.next, after, after / LIMIT * 100))
            if after >= STOP:
                print("⛔ 這個縣市做完會越過 %d MB 停止線，開工前請先問使用者" % STOP)
            elif after >= WARN > total:
                print("⚠️ 這個縣市做完會越過 %d MB 提醒線，開工前請先問使用者" % WARN)
        print(status_line(total, site))
    print("平均每處 %.2f MB（兩個網站所有縣市合計）" % per)


if __name__ == "__main__":
    main()
