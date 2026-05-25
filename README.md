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
- not set → submissions fall back to temporary `/tmp` CSV storage

To use Google Sheets, deploy the Apps Script in `google-apps-script/Code.gs` and set the resulting Web app URL as the `GOOGLE_APPS_SCRIPT_URL` environment variable in Vercel.
