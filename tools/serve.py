"""本機預覽用的靜態伺服器（支援 HTTP Range，語音可以跳句／拖曳進度）
用法：python3 tools/serve.py [port]   → 開啟 http://localhost:8000
Python 內建的 `python3 -m http.server` 不支援 Range，跳到下一句時語音會從頭播放；上線到 GitHub Pages 則沒有這個問題。
"""
import http.server, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class Handler(http.server.SimpleHTTPRequestHandler):
    def send_head(self):
        rng = self.headers.get("Range")
        path = self.translate_path(self.path)
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
    print("http://localhost:%d" % port)
    http.server.ThreadingHTTPServer(("", port), Handler).serve_forever()
