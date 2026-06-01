const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwifdYGDjuYDjoZFxKMGSY8L0MMU-18KBT6tzL7ZvUgYtn4HxlbBVQAMAGiWvV0aYGe/exec';
const TELEGRAM_GROUP_URL = 'https://t.me/+tTeE6U4WdIIyMjIx';

export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ ok: false, error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body = await req.json();

    const required = ['name', 'email', 'track', 'stage', 'state', 'business_interests', 'intent', 'contact_consent', 'terms_accepted'];
    const missing = required.filter((field) => !body[field]);
    if (missing.length) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Missing required fields', missing }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    let storageResult = {};
    try {
      storageResult = await response.json();
    } catch (_) {}

    if (!response.ok || storageResult.ok === false) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Submission storage failed' }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ ok: true, message: 'Application submitted successfully', redirect_url: TELEGRAM_GROUP_URL }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Submission failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
