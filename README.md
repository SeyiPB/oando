# Owners & Operators

Static site plus lightweight intake endpoints.

## Local preview

```bash
python3 server.py
```

Open the local preview in your browser after starting the server.

## Production form storage

Vercel supports two modes:
- `GOOGLE_APPS_SCRIPT_URL` set → submissions are forwarded to Google Sheets
- otherwise the bundled default webhook URL is used
- if no webhook is available, submissions fall back to temporary `/tmp` CSV storage

Current default Google Sheets webhook:
- `https://script.google.com/macros/s/AKfycbzu2OUyfAFNYXDrpwMoH0Q6VVljVxqppu_zjctpOIVTozcMFF2p2vsiJUOFARsn2n9nWw/exec`

If you rotate the Apps Script deployment URL later, set the new value in Vercel as `GOOGLE_APPS_SCRIPT_URL`.
