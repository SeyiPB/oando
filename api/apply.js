const fs = require('fs');

const FIELDS = ['submitted_at', 'name', 'email', 'phone', 'gender', 'track', 'stage', 'intent'];
const MAX_BODY_BYTES = 16 * 1024;
const TMP_CSV_PATH = '/tmp/oando-applications.csv';

function escapeCsv(value) {
  const str = String(value ?? '').replace(/\r?\n|\r/g, ' ').trim();
  return /[",]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;

  return await new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('Request too large'), { statusCode: 413 }));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(Object.assign(new Error('Invalid JSON'), { statusCode: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function appendEphemeralCsv(row) {
  const header = `${FIELDS.join(',')}\n`;
  const line = `${FIELDS.map((field) => escapeCsv(row[field])).join(',')}\n`;
  if (!fs.existsSync(TMP_CSV_PATH)) fs.writeFileSync(TMP_CSV_PATH, header, 'utf8');
  fs.appendFileSync(TMP_CSV_PATH, line, 'utf8');
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  if (!String(req.headers['content-type'] || '').includes('application/json')) {
    res.status(415).json({ ok: false, error: 'Content-Type must be application/json' });
    return;
  }

  try {
    const payload = await readJsonBody(req);
    const row = Object.fromEntries(FIELDS.map((field) => [field, String(payload[field] || '').trim()]));
    row.submitted_at = new Date().toISOString();

    if (!row.name || !row.email || !row.track || !row.intent) {
      res.status(400).json({ ok: false, error: 'Missing required fields' });
      return;
    }

    appendEphemeralCsv(row);
    console.log('application_submission', JSON.stringify(row));

    res.status(200).json({ ok: true, storage: 'ephemeral-vercel-tmp' });
  } catch (err) {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({ ok: false, error: err.message || 'Submission failed' });
  }
};
