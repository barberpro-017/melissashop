const { SB, KEY, rest, body } = require('./_lib');

// Promokod foizi va qaysi sotuvchiga tegishli ekanini tekshiradi (kodlar ro'yxati brauzerga berilmaydi)
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!SB || !KEY) return res.status(500).json({ error: 'Server sozlanmagan' });
  const code = String(body(req).code || '').trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,20}$/.test(code)) return res.status(404).json({ error: 'Promo-kod yaroqsiz' });
  const r = await rest(`promo_codes?code=eq.${encodeURIComponent(code)}&active=eq.true&select=percent,seller_id`);
  const row = r.ok ? (await r.json())[0] : null;
  if (!row) return res.status(404).json({ error: 'Promo-kod yaroqsiz' });
  res.status(200).json({ percent: row.percent, seller_id: row.seller_id || null });
};
