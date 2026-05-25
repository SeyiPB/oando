from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import csv
import json
from urllib.parse import urlparse
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parent
CSV_PATH = ROOT / "applications.csv"
FIELDS = ["submitted_at", "name", "email", "phone", "gender", "track", "stage", "intent"]


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path != "/apply":
            self.send_error(404, "Not found")
            return

        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length)
        try:
            payload = json.loads(raw.decode("utf-8"))
        except Exception:
            self.send_error(400, "Invalid JSON")
            return

        row = {field: str(payload.get(field, "")).strip() for field in FIELDS}
        row["submitted_at"] = datetime.now(timezone.utc).isoformat()
        if not row["name"] or not row["email"] or not row["track"] or not row["intent"]:
            self.send_error(400, "Missing required fields")
            return

        CSV_PATH.parent.mkdir(parents=True, exist_ok=True)
        write_header = not CSV_PATH.exists() or CSV_PATH.stat().st_size == 0
        with CSV_PATH.open("a", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=FIELDS)
            if write_header:
                writer.writeheader()
            writer.writerow(row)

        body = json.dumps({"ok": True, "saved_to": str(CSV_PATH)}).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", 8008), Handler)
    print("Serving on http://127.0.0.1:8008")
    server.serve_forever()
