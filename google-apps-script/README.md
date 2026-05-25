# Google Apps Script webhook setup

1. Open the target Google Sheet.
2. Extensions → Apps Script.
3. Replace the default code with `Code.gs` from this folder.
4. Save the project.
5. Deploy → New deployment.
6. Type: **Web app**.
7. Execute as: **Me**.
8. Who has access: **Anyone**.
9. Deploy and copy the Web app URL.
10. Set that URL in Vercel as `GOOGLE_APPS_SCRIPT_URL`.

Expected sheet columns:
- submitted_at
- name
- email
- phone
- gender
- track
- stage
- intent
