#!/usr/bin/env python3
"""Serve sponsorship-ui and proxy Google Sheet CSV (browser CORS blocks direct fetch)."""
import http.server
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

PORT = int(os.environ.get("SPONSORSHIP_UI_PORT", "8090"))
UI_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UI_DIR = os.path.join(UI_DIR, "sponsorship-ui")


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=UI_DIR, **kwargs)

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/api/sheet":
            self._proxy_sheet(parsed.query)
            return
        if parsed.path == "/api/health":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"status":"ok"}')
            return
        super().do_GET()

    def _proxy_sheet(self, query: str):
        params = urllib.parse.parse_qs(query)
        sheet_url = params.get("url", [""])[0]
        if not sheet_url:
            self.send_error(400, "Missing url query param")
            return

        # Accept full Google Sheets URL or sheet ID
        m = re.search(r"/d/([a-zA-Z0-9-_]+)", sheet_url)
        if m:
            csv_url = f"https://docs.google.com/spreadsheets/d/{m.group(1)}/export?format=csv"
        elif re.match(r"^[a-zA-Z0-9-_]+$", sheet_url):
            csv_url = f"https://docs.google.com/spreadsheets/d/{sheet_url}/export?format=csv"
        else:
            csv_url = sheet_url

        try:
            req = urllib.request.Request(
                csv_url,
                headers={"User-Agent": "sponsorship-ui/1.0"},
            )
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = resp.read()
            self.send_response(200)
            self.send_header("Content-Type", "text/csv; charset=utf-8")
            self.end_headers()
            self.wfile.write(data)
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="replace")[:200]
            self.send_response(e.code)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            msg = json.dumps({
                "error": f"Google Sheet returned {e.code}. Share as 'Anyone with the link' or publish to web.",
                "detail": body,
            })
            self.wfile.write(msg.encode())
        except Exception as e:
            self.send_response(502)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode())


if __name__ == "__main__":
    os.chdir(UI_DIR)
    print(f"Sponsorship UI: http://localhost:{PORT}", flush=True)
    http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
