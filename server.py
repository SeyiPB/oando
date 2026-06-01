from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import csv
import json
import threading
from urllib.parse import urlparse
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT.parent / "oando-private-data"
CSV_PATH = DATA_DIR / "applications.csv"
FIELDS = [
    "submitted_at",
    "name",
    "email",
    "phone",
    "gender",
    "track",
    "stage",
    "state",
    "business_interests",
    "intent",
    "contact_consent",
    "terms_accepted",
    "terms_version",
]
TELEGRAM_GROUP_URL = "https://t.me/+tTeE6U4WdIIyMjIx"
MAX_BODY_BYTES = 16_384
WRITE_LOCK = threading.Lock()


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path != "/apply":
            self.send_error(404, "Not found")
            return

        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0 or length > MAX_BODY_BYTES:
            self.send_error(413, "Request too large")
            return

        if "application/json" not in (self.headers.get("Content-Type") or ""):
            self.send_error(415, "Content-Type must be application/json")
            return

        raw = self.rfile.read(length)
        try:
            payload = json.loads(raw.decode("utf-8"))
        except Exception:
            self.send_error(400, "Invalid JSON")
            return

        row = {}
        for field in FIELDS:
            value = payload.get(field, "")
            if isinstance(value, list):
                value = ", ".join(str(item).strip() for item in value if str(item).strip())
            row[field] = str(value).strip()
        row["submitted_at"] = datetime.now(timezone.utc).isoformat()
        if (
            not row["name"]
            or not row["email"]
            or not row["track"]
            or not row["stage"]
            or not row["state"]
            or not row["business_interests"]
            or not row["intent"]
            or row["contact_consent"].lower() != "yes"
            or row["terms_accepted"].lower() != "yes"
        ):
            self.send_error(400, "Missing required fields")
            return

        DATA_DIR.mkdir(parents=True, exist_ok=True)
        with WRITE_LOCK:
            write_header = not CSV_PATH.exists() or CSV_PATH.stat().st_size == 0
            with CSV_PATH.open("a", newline="", encoding="utf-8") as f:
                writer = csv.DictWriter(f, fieldnames=FIELDS)
                if write_header:
                    writer.writeheader()
                writer.writerow(row)

        body = json.dumps({"ok": True, "redirect_url": TELEGRAM_GROUP_URL}).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", 8008), Handler)
    print("Serving Owners & Operators locally on port 8008")
    server.serve_forever()
