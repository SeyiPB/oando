# Google Apps Script webhook setup

1. Open the Apps Script project.
2. Replace the code with `Code.gs` from this folder.
3. Save the project.
4. Deploy → Manage deployments.
5. Edit the existing Web app deployment or create a new one.
6. Execute as: **Me**.
7. Who has access: **Anyone**.
8. Deploy and copy the Web app URL.

This version uses `SpreadsheetApp.openById(...)`, so it works for a standalone Apps Script project tied to this sheet ID:
- `1nWZs7FDAuMd32XCfLOLn_sJmfECBxOZaUTchQihKGR0`

Expected sheet columns:
- submitted_at
- name
- email
- phone
- gender
- track
- stage
- intent
