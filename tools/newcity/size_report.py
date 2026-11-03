"""容量檢查：統計網站發布的總大小，對照 GitHub Pages 1 GB 上限，並提醒是否該搬遷
用法：
  python3 tools/newcity/size_report.py                 # 目前用量與各縣市明細
  python3 tools/newcity/size_report.py --next 600      # 再加一個約 600 處（有形＋無形）的縣市，預估會到多少

什麼時候跑：開工前（手冊步驟 0）、開放縣市前（步驟 11）。tools/build_data.py 每次執行也會印出一行摘要。
門檻（見作業手冊〈容量管理〉）：
  700 MB：提醒。開放下一個縣市之前，先請使用者決定是否搬遷（建議改用 Cloudflare Pages 發布）。
  900 MB：停止。不要再開放新縣市，先完成搬遷或瘦身。
計算方式：所有會發布的檔案（git 追蹤中＋尚未加入但沒被 .gitignore 排除的），不含 .git 與語音快取。
"""
import argparse, collections, json, os, subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
LIMIT = 1024          # GitHub Pages 發布網站上限（MB）
WARN, STOP = 700, 900


def published_files():
    out = subprocess.check_output(["git", "ls-files", "-z", "--cached", "--others", "--exclude-standard"], cwd=ROOT)
    return [f for f in out.decode("utf-8").split("\0") if f and os.path.isfile(os.path.join(ROOT, f))]


def report():
    """回傳 (總 MB, {縣市: (MB, 文資數)}, 每處平均 MB)"""
    size = collections.Counter()
    for f in published_files():
        top = f.split("/")[0] if "/" in f else "(根目錄)"
        size[top] += os.path.getsize(os.path.join(ROOT, f))
    total = sum(size.values()) / 1048576
    cities = {}
    for d, b in size.items():
        D = os.path.join(ROOT, d, "data")
        if not os.path.exists(os.path.join(D, "config.json")):
            continue
        n = 0
        for fn, key in (("sites-official.json", None), ("ich.json", "items")):
            p = os.path.join(D, fn)
            if os.path.exists(p):
                x = json.load(open(p, encoding="utf-8"))
                n += len(x[key] if key else x)
        cities[d] = (b / 1048576, n)
    items = sum(n for _, n in cities.values())
    per = sum(mb for mb, _ in cities.values()) / items if items else 0.35
    return total, cities, per


def status_line(total):
    pct = total / LIMIT * 100
    if total >= STOP:
        return "⛔ 網站 %.0f MB（1 GB 的 %.0f%%）：已超過 %d MB，不要再開放新縣市，請先和使用者完成搬遷或瘦身（見作業手冊〈容量管理〉）" % (total, pct, STOP)
    if total >= WARN:
        return "⚠️ 網站 %.0f MB（1 GB 的 %.0f%%）：已超過 %d MB，開放下一個縣市前請先問使用者是否搬遷（見作業手冊〈容量管理〉）" % (total, pct, WARN)
    return "容量：網站 %.0f MB（GitHub Pages 上限 1 GB 的 %.0f%%；%d MB 時提醒是否搬遷）" % (total, pct, WARN)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--next", type=int, default=0, help="下一個縣市的有形＋無形文資數，用來預估")
    a = ap.parse_args()
    total, cities, per = report()
    print("縣市              大小      文資數  每處")
    for d, (mb, n) in sorted(cities.items(), key=lambda x: -x[1][0]):
        print("  %-16s %6.1f MB  %5d  %.2f MB" % (d, mb, n, mb / n if n else 0))
    print("合計（含共用檔案）%.1f MB；平均每處 %.2f MB" % (total, per))
    print("距離 %d MB 提醒線還有 %.0f MB，約可再容納 %d 處文資" % (WARN, max(0, WARN - total), max(0, WARN - total) / per))
    if a.next:
        after = total + a.next * per
        print("預估加入 %d 處後：%.0f MB" % (a.next, after))
        if after >= WARN > total:
            print("⚠️ 這個縣市做完會越過 %d MB 提醒線，開工前請先問使用者是否要先搬遷" % WARN)
    print(status_line(total))


if __name__ == "__main__":
    main()
