from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import csv
import json
import threading
import re
from urllib.parse import urlparse
from datetime import datetime, timezone
from time import time

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT.parent / "oando-private-data"
CSV_PATH = DATA_DIR / "applications.csv"
FIELDS = ["submitted_at", "name", "email", "phone", "gender", "track", "stage", "state", "business_interests", "intent"]
MAX_BODY_BYTES = 16_384
MAX_FIELD_LENGTH = 2_000
MIN_SUBMIT_SECONDS = 3
RATE_LIMIT_WINDOW_SECONDS = 600
RATE_LIMIT_MAX_REQUESTS = 5
WRITE_LOCK = threading.Lock()
REQUEST_LOG = {}
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
URL_LIKE_RE = re.compile(r"(https?://|www\.)", re.IGNORECASE)


def get_client_ip(handler):
    forwarded = handler.headers.get("X-Forwarded-For", "").strip()
    if forwarded:
        return forwarded.split(",")[0].strip()
    return handler.client_address[0]


def is_rate_limited(ip):
    now = time()
    recent = [ts for ts in REQUEST_LOG.get(ip, []) if now - ts < RATE_LIMIT_WINDOW_SECONDS]
    recent.append(now)
    REQUEST_LOG[ip] = recent
    return len(recent) > RATE_LIMIT_MAX_REQUESTS


def validate_submission(row, payload):
    if str(payload.get("website", "")).strip():
        return "Spam check failed"

    try:
        started_at = int(str(payload.get("started_at", "0") or "0")) / 1000
    except ValueError:
        started_at = 0

    if started_at <= 0 or time() - started_at < MIN_SUBMIT_SECONDS:
        return "Please take a moment to complete the application"

    if not EMAIL_RE.match(row["email"]):
        return "Enter a valid email address"

    if any(len(str(value)) > MAX_FIELD_LENGTH for value in row.values()):
        return "One or more fields are too long"

    if URL_LIKE_RE.search(row["name"]) or URL_LIKE_RE.search(row["email"]):
        return "Spam check failed"

    if len(re.findall(r"https?://", row["intent"], flags=re.IGNORECASE)) > 2:
        return "Please remove extra links and try again"

    return None


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path != "/apply":
            self.send_error(404, "Not found")
            return

        if is_rate_limited(get_client_ip(self)):
            self._send_json(429, {"ok": False, "error": "Too many submissions. Please try again later."})
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

        row = {field: str(payload.get(field, "")).strip() for field in FIELDS}
        row["submitted_at"] = datetime.now(timezone.utc).isoformat()
        if not row["name"] or not row["email"] or not row["track"] or not row["state"] or not row["business_interests"] or not row["intent"]:
            self.send_error(400, "Missing required fields")
            return

        validation_error = validate_submission(row, payload)
        if validation_error:
            self._send_json(400, {"ok": False, "error": validation_error})
            return

        DATA_DIR.mkdir(parents=True, exist_ok=True)
        with WRITE_LOCK:
            write_header = not CSV_PATH.exists() or CSV_PATH.stat().st_size == 0
            with CSV_PATH.open("a", newline="", encoding="utf-8") as f:
                writer = csv.DictWriter(f, fieldnames=FIELDS)
                if write_header:
                    writer.writeheader()
                writer.writerow(row)

        self._send_json(200, {"ok": True})

    def _send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", 8008), Handler)
    print("Serving Owners & Operators locally on port 8008")
    server.serve_forever()
