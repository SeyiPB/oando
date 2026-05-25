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
- `https://script.google.com/macros/s/AKfycbzpwI9qZCrfPGuabE5xxOms2NmLkf_akSiDrY6EyvyG4Ju5e1AwIwKb1jAN3sHAIWBFaA/exec`

If you rotate the Apps Script deployment URL later, set the new value in Vercel as `GOOGLE_APPS_SCRIPT_URL`.
