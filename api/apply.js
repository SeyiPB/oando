const fs = require('fs');

const FIELDS = ['submitted_at', 'name', 'email', 'phone', 'gender', 'track', 'stage', 'intent'];
const MAX_BODY_BYTES = 16 * 1024;
const MAX_FIELD_LENGTH = 2000;
const MIN_SUBMIT_MS = 3000;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 5;
const TMP_CSV_PATH = '/tmp/oando-applications.csv';
const DEFAULT_GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzu2OUyfAFNYXDrpwMoH0Q6VVljVxqppu_zjctpOIVTozcMFF2p2vsiJUOFARsn2n9nWw/exec';
const GOOGLE_APPS_SCRIPT_URL = process.env.GOOGLE_APPS_SCRIPT_URL || DEFAULT_GOOGLE_APPS_SCRIPT_URL;
const requestLog = new Map();

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

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}

function isRateLimited(ip) {
  const now = Date.now();
  const recent = (requestLog.get(ip) || []).filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);
  recent.push(now);
  requestLog.set(ip, recent);
  return recent.length > RATE_LIMIT_MAX_REQUESTS;
}

function validateSubmission(row, payload) {
  if (String(payload.website || '').trim()) {
    return 'Spam check failed';
  }

  const startedAt = Number(payload.started_at || 0);
  if (!Number.isFinite(startedAt) || startedAt <= 0 || Date.now() - startedAt < MIN_SUBMIT_MS) {
    return 'Please take a moment to complete the application';
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
    return 'Enter a valid email address';
  }

  for (const value of Object.values(row)) {
    if (String(value).length > MAX_FIELD_LENGTH) {
      return 'One or more fields are too long';
    }
  }

  const urlLikePattern = /(https?:\/\/|www\.)/i;
  if (urlLikePattern.test(row.name) || urlLikePattern.test(row.email)) {
    return 'Spam check failed';
  }

  const linkCount = (row.intent.match(/https?:\/\//gi) || []).length;
  if (linkCount > 2) {
    return 'Please remove extra links and try again';
  }

  return null;
}

async function forwardToGoogleAppsScript(row) {
  const res = await fetch(GOOGLE_APPS_SCRIPT_URL, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(row)
  });

  const text = await res.text();
  if (!res.ok) {
    throw Object.assign(new Error(`Google Sheets webhook failed: ${res.status}`), { statusCode: 502, details: text.slice(0, 500) });
  }

  try {
    const parsed = text ? JSON.parse(text) : {};
    if (parsed.ok === false) {
      throw Object.assign(new Error(parsed.error || 'Google Sheets webhook rejected the submission'), { statusCode: 502 });
    }
  } catch (err) {
    if (err.statusCode) throw err;
  }
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

  const clientIp = getClientIp(req);
  if (isRateLimited(clientIp)) {
    res.status(429).json({ ok: false, error: 'Too many submissions. Please try again later.' });
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

    const validationError = validateSubmission(row, payload);
    if (validationError) {
      res.status(400).json({ ok: false, error: validationError });
      return;
    }

    if (GOOGLE_APPS_SCRIPT_URL) {
      await forwardToGoogleAppsScript(row);
      console.log('application_submission_google_sheet', JSON.stringify(row));
      res.status(200).json({ ok: true, storage: 'google-sheets' });
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
