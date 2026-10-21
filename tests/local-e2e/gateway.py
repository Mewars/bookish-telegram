"""Loopback-only static beta build plus gateway to real local test services.

The application build retains its exact Ryadom-Test origin guard. Playwright
redirects that virtual origin here and this gateway supplies only a local ANON
key. No service key or production credentials enter the browser.
"""

import http.server, json, urllib.request, urllib.error, os
from pathlib import Path
from urllib.parse import urlsplit, unquote
import argparse

parser = argparse.ArgumentParser()
parser.add_argument("--workdir", required=True, type=Path)
args = parser.parse_args()
root = (Path(__file__).resolve().parents[2] / "dist").resolve()
cfg = json.loads((args.workdir / "credentials.json").read_text())


class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_OPTIONS(self):
        self.send_response(204)
        self.cors()
        self.end_headers()

    def cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header(
            "Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS"
        )
        self.send_header("Access-Control-Expose-Headers", "*")

    def handle_request(self):
        if (
            self.path == "/api/friends.php"
            and os.environ.get("FRIENDS_LOCAL_PHP_ORIGIN") == "http://127.0.0.1:8187"
        ):
            data = (
                self.rfile.read(int(self.headers.get("Content-Length", "0")))
                if self.command != "GET"
                else None
            )
            request = urllib.request.Request(
                "http://127.0.0.1:8187/api/friends.php",
                data=data,
                headers={
                    k: v
                    for k, v in self.headers.items()
                    if k.lower() not in ["host", "content-length", "connection"]
                },
                method=self.command,
            )
            try:
                response = urllib.request.urlopen(request, timeout=20)
            except urllib.error.HTTPError as error:
                response = error
            self.send_response(response.status)
            for k, v in response.headers.items():
                if k.lower() not in [
                    "transfer-encoding",
                    "connection",
                    "content-length",
                ]:
                    self.send_header(k, v)
            self.end_headers()
            self.wfile.write(response.read())
            return
        for prefix, port in [
            ("/auth/v1", 19999),
            ("/rest/v1", 13000),
            ("/storage/v1", 15000),
        ]:
            if self.path.startswith(prefix):
                headers = {
                    k: v
                    for k, v in self.headers.items()
                    if k.lower()
                    not in ["host", "content-length", "connection", "accept-encoding"]
                }
                auth = self.headers.get("Authorization", "")
                if auth.startswith("Bearer sb_publishable_"):
                    headers["Authorization"] = "Bearer " + cfg["anon_key"]
                headers["apikey"] = cfg["anon_key"]
                data = (
                    self.rfile.read(int(self.headers.get("Content-Length", "0")))
                    if self.command not in ["GET", "HEAD"]
                    else None
                )
                request = urllib.request.Request(
                    f"http://127.0.0.1:{port}" + self.path[len(prefix) :],
                    data=data,
                    headers=headers,
                    method=self.command,
                )
                try:
                    response = urllib.request.urlopen(request, timeout=20)
                except urllib.error.HTTPError as error:
                    response = error
                except urllib.error.URLError:
                    self.send_error(502, "Local test service unavailable")
                    return
                self.send_response(response.status)
                self.cors()
                for k, v in response.headers.items():
                    if k.lower() not in [
                        "transfer-encoding",
                        "connection",
                        "content-length",
                        "access-control-allow-origin",
                        "access-control-allow-headers",
                        "access-control-expose-headers",
                    ]:
                        self.send_header(k, v)
                self.end_headers()
                self.wfile.write(response.read())
                return
        relative = unquote(urlsplit(self.path).path)
        allowed_root = root
        if relative.startswith('/host/'):
            allowed_root = (Path(__file__).resolve().parents[2] / 'host-public').resolve()
            path = (allowed_root / relative.removeprefix('/host/')).resolve()
            if relative in ['/host/wall/supabase-client.js', '/host/classifieds/supabase-client.js']:
                allowed_root = args.workdir.resolve()
                path = allowed_root / 'host-supabase-client.js'
        else:
            path = (root / relative.lstrip('/')).resolve()
        if not path.is_relative_to(allowed_root):
            self.send_error(403)
            return
        if path.is_dir():
            path = path / "index.html"
        if not path.exists():
            self.send_error(404)
            return
        import mimetypes

        self.send_response(200)
        self.send_header(
            "Content-Type", mimetypes.guess_type(path)[0] or "application/octet-stream"
        )
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(path.read_bytes())

    do_GET = handle_request
    do_POST = handle_request
    do_PATCH = handle_request
    do_DELETE = handle_request
    do_PUT = handle_request


http.server.ThreadingHTTPServer(("127.0.0.1", 4180), Handler).serve_forever()
