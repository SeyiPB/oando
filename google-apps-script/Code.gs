const SHEET_ID = '1nWZs7FDAuMd32XCfLOLn_sJmfECBxOZaUTchQihKGR0';
const SHEET_NAME = 'candidates';
const HEADERS = ['submitted_at', 'name', 'email', 'phone', 'gender', 'track', 'stage', 'state', 'business_interests', 'intent', 'contact_consent', 'terms_accepted', 'terms_version'];

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    const sheet = spreadsheet.getSheetByName(SHEET_NAME) || spreadsheet.insertSheet(SHEET_NAME);

    const currentHeaders = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
    const needsHeaders = HEADERS.some((header, index) => currentHeaders[index] !== header);
    if (needsHeaders) {
      sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    }

    const row = HEADERS.map((field) => String(body[field] || '').trim());
    if (!row[1] || !row[2] || !row[5] || !row[7] || !row[8] || !row[9] || row[10] !== 'yes' || row[11] !== 'yes') {
      return jsonResponse({ ok: false, error: 'Missing required fields' });
    }

    sheet.appendRow(row);
    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse({ ok: false, error: error.message || 'Submission failed' });
  }
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
