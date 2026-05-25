const SHEET_NAME = 'Sheet1';
const HEADERS = ['submitted_at', 'name', 'email', 'phone', 'gender', 'track', 'stage', 'intent'];

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME) || SpreadsheetApp.getActiveSpreadsheet().insertSheet(SHEET_NAME);

    const currentHeaders = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
    const needsHeaders = HEADERS.some((header, index) => currentHeaders[index] !== header);
    if (needsHeaders) {
      sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    }

    const row = HEADERS.map((field) => String(body[field] || '').trim());
    if (!row[1] || !row[2] || !row[5] || !row[7]) {
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
