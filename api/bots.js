const crypto = require('crypto');

const SB = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };

const tg = async (token, method, body) => {
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
  });
  return r.json();
};

// Faqat Supabase'da login qilgan admin ruxsat oladi
async function isAdmin(req) {
  const t = (req.headers.authorization || '').replace('Bearer ', '');
  if (!t) return false;
  const r = await fetch(SB + '/auth/v1/user', { headers: { apikey: KEY, Authorization: 'Bearer ' + t } });
  return r.ok;
}

const upsert = (table, row) => fetch(`${SB}/rest/v1/${table}?on_conflict=bot_id`, {
  method: 'POST',
  headers: { ...H, Prefer: 'resolution=merge-duplicates,return=representation' },
  body: JSON.stringify(row)
});

module.exports = async (req, res) => {
  if (!SB || !KEY) return res.status(500).json({ error: "Vercel'da SUPABASE_URL va SUPABASE_SERVICE_ROLE_KEY kiritilmagan" });
  if (!(await isAdmin(req))) return res.status(401).json({ error: "Ruxsat yo'q" });
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

  try {
    if (req.method === 'POST') {
      const token = String(body.token || '').trim();
      if (!/^\d+:[\w-]{30,}$/.test(token)) return res.status(400).json({ error: "Token formati noto'g'ri" });

      const me = await tg(token, 'getMe');
      if (!me.ok) return res.status(400).json({ error: "Token noto'g'ri yoki bot topilmadi" });

      const host = req.headers['x-forwarded-host'] || req.headers.host;
      const origin = 'https://' + host;
      const appUrl = process.env.MINIAPP_URL || origin + '/app/';
      const secret = crypto.randomBytes(24).toString('hex');

      const steps = [
        await tg(token, 'setWebhook', { url: origin + '/api/telegram', secret_token: secret, allowed_updates: ['message'] }),
        await tg(token, 'setChatMenuButton', { menu_button: { type: 'web_app', text: "Do'kon", web_app: { url: appUrl } } }),
        await tg(token, 'setMyCommands', { commands: [{ command: 'start', description: "Do'konni ochish" }] })
      ];
      const bad = steps.find(s => !s.ok);
      if (bad) return res.status(400).json({ error: 'Telegram: ' + bad.description });

      const botRow = { bot_id: me.result.id, username: me.result.username, name: me.result.first_name, mini_app_url: appUrl };
      const a = await upsert('bots', botRow);
      if (!a.ok) return res.status(500).json({ error: 'Bazaga yozilmadi: ' + (await a.text()) });
      const b = await upsert('bot_secrets', { bot_id: me.result.id, token, webhook_secret: secret });
      if (!b.ok) return res.status(500).json({ error: 'Token saqlanmadi: ' + (await b.text()) });

      return res.status(200).json({ ok: true, bot: botRow });
    }

    if (req.method === 'DELETE') {
      const id = Number(body.id);
      if (!id) return res.status(400).json({ error: 'Bot id kerak' });
      const r = await fetch(`${SB}/rest/v1/bot_secrets?bot_id=eq.${id}&select=token`, { headers: H });
      const row = (await r.json())[0];
      if (row) {
        await tg(row.token, 'deleteWebhook');
        await tg(row.token, 'setChatMenuButton', { menu_button: { type: 'default' } });
      }
      // bot_secrets bots ga bog'langan (on delete cascade)
      await fetch(`${SB}/rest/v1/bots?bot_id=eq.${id}`, { method: 'DELETE', headers: H });
      return res.status(200).json({ ok: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
