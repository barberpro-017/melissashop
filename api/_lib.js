const crypto = require('crypto');

const SB = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };

const rest = (path, opts = {}) =>
  fetch(`${SB}/rest/v1/${path}`, { ...opts, headers: { ...H, ...(opts.headers || {}) } });

const body = req => (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}));

// Saytga login qilgan foydalanuvchi (Supabase JWT orqali)
async function authUser(req) {
  const t = (req.headers.authorization || '').replace('Bearer ', '');
  if (!t) return null;
  const r = await fetch(SB + '/auth/v1/user', { headers: { apikey: KEY, Authorization: 'Bearer ' + t } });
  return r.ok ? r.json() : null;
}
const roleOf = u => (u && u.app_metadata && u.app_metadata.role) || 'admin';

// Telegram Mini App initData imzosini tekshiradi.
async function verifyInitData(initData) {
  if (!initData || typeof initData !== 'string') return null;
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');
  if (Date.now() / 1000 - Number(params.get('auth_date') || 0) > 86400) return null;

  const check = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const r = await rest('bot_secrets?select=token');
  if (!r.ok) return null;
  for (const { token } of await r.json()) {
    const secret = crypto.createHmac('sha256', 'WebAppData').update(token).digest();
    const h = crypto.createHmac('sha256', secret).update(check).digest('hex');
    if (h.length === hash.length && crypto.timingSafeEqual(Buffer.from(h), Buffer.from(hash))) {
      try { return { user: JSON.parse(params.get('user')), token }; } catch (_) { return null; }
    }
  }
  return null;
}

module.exports = { SB, KEY, H, rest, body, authUser, roleOf, verifyInitData };
