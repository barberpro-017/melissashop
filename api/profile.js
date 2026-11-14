const SB = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!SB || !KEY) return res.status(500).json({ error: "Vercel'da SUPABASE_URL va SUPABASE_SERVICE_ROLE_KEY kiritilmagan" });

  // Faqat login qilgan admin o'z profilini o'zgartira oladi
  const t = (req.headers.authorization || '').replace('Bearer ', '');
  if (!t) return res.status(401).json({ error: "Ruxsat yo'q" });
  const ur = await fetch(SB + '/auth/v1/user', { headers: { apikey: KEY, Authorization: 'Bearer ' + t } });
  if (!ur.ok) return res.status(401).json({ error: "Ruxsat yo'q" });
  const u = await ur.json();

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const login = String(body.login || '').trim().toLowerCase();
  const name = String(body.full_name || '').trim();
  const password = body.password ? String(body.password) : '';
  if (!name) return res.status(400).json({ error: 'Ism familiya kerak' });
  if (!/^[a-z0-9._-]{3,30}$/.test(login)) return res.status(400).json({ error: "Login noto'g'ri formatda" });
  if (password && password.length < 6) return res.status(400).json({ error: "Parol kamida 6 ta belgi bo'lsin" });

  const patch = { email: login + '@melissa.uz', email_confirm: true, user_metadata: { ...(u.user_metadata || {}), full_name: name } };
  if (password) patch.password = password;

  const r = await fetch(`${SB}/auth/v1/admin/users/${u.id}`, { method: 'PUT', headers: H, body: JSON.stringify(patch) });
  if (!r.ok) {
    let msg = 'Saqlanmadi';
    try { const j = await r.json(); msg = j.msg || j.message || msg; } catch (_) {}
    return res.status(400).json({ error: msg });
  }
  res.status(200).json({ ok: true });
};
