"""本機預覽用的靜態伺服器（支援 HTTP Range，語音可以跳句／拖曳進度）
用法：python3 tools/serve.py [port]   → 開啟 http://localhost:8000/Cultural_Heritage/
Python 內建的 `python3 -m http.server` 不支援 Range，跳到下一句時語音會從頭播放；上線到 GitHub Pages 則沒有這個問題。

兩個網站用路徑區分：
  /Cultural_Heritage/…   → 本 repo（第一網站，正式網址 https://cultural.123hi.org/）
  /Cultural_Heritage2/…  → 第二網站的 clone（tools/sites.py：CH2_DIR，或本 repo 旁邊的 Cultural_Heritage2）
  其他路徑（例如 /chiayi-city/）→ 本 repo，和以前一樣，第一網站的頁面仍可直接預覽
第二網站的 HTML 用第一網站的正式網址載入共用程式；這裡送出時會把正式網址換成上面的本機路徑，
所以預覽與測試用的是本機正在改的共用程式（cities.js 在 localhost 也會自動改用本機路徑）。
"""
import http.server, io, os, re, sys, urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))
import sites as SITES  # noqa: E402
MOUNTS = sorted(((v["url"], v["dir"]) for v in SITES.SITES.values()), key=lambda m: -len(m[0]))
LOCAL = [(v["public"].encode(), v["url"].encode()) for v in SITES.SITES.values() if v["public"] != v["url"]]


class Handler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        p = urllib.parse.urlsplit(path).path
        for url, d in MOUNTS:
            if p == url.rstrip("/") or p.startswith(url):
                rest = path[len(url.rstrip("/")):] or "/"
                return self._under(d, rest)
        return self._under(ROOT, path)

    def _under(self, d, path):
        old = self.directory
        self.directory = d
        try:
            return super().translate_path(path)
        finally:
            self.directory = old

    def send_head(self):
        path = self.translate_path(self.path)
        page = os.path.join(path, "index.html") if os.path.isdir(path) and self.path.split("?")[0].endswith("/") else path
        if page.endswith(".html") and os.path.isfile(page) and not page.startswith(ROOT + os.sep):
            data = open(page, "rb").read()  # 第二網站的頁面：正式網址 → 本機路徑
            for a, b in LOCAL:
                data = data.replace(a, b)
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            return io.BytesIO(data)
        rng = self.headers.get("Range")
        if not rng or not os.path.isfile(path):
            return super().send_head()
        m = re.match(r"bytes=(\d*)-(\d*)", rng)
        size = os.path.getsize(path)
        start = int(m.group(1) or 0)
        end = min(int(m.group(2) or size - 1), size - 1)
        f = open(path, "rb")
        f.seek(start)
        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Content-Range", "bytes %d-%d/%d" % (start, end, size))
        self.send_header("Content-Length", str(end - start + 1))
        self.send_header("Accept-Ranges", "bytes")
        self.end_headers()
        self._remaining = end - start + 1
        return f

    def copyfile(self, src, dst):
        n = getattr(self, "_remaining", None)
        if n is None:
            return super().copyfile(src, dst)
        dst.write(src.read(n))
        self._remaining = None


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    os.chdir(ROOT)
    print("http://localhost:%d/Cultural_Heritage/" % port)
    for url, d in MOUNTS:
        print("  %s → %s%s" % (url, d, "" if os.path.isdir(d) else "（尚未 clone）"))
    http.server.ThreadingHTTPServer(("", port), Handler).serve_forever()
