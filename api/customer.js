const { SB, KEY, rest, body, verifyInitData } = require('./_lib');

// Mijoz profili (ism, familiya, telefon): o'qish va saqlash
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!SB || !KEY) return res.status(500).json({ error: 'Server sozlanmagan' });
  try {
    const b = body(req);
    const auth = await verifyInitData(b.initData);
    if (!auth) return res.status(401).json({ error: 'Ilovani Telegram orqali oching' });
    const id = Number(auth.user.id);
    if (b.save) {
      const first_name = String(b.first_name || '').trim().slice(0, 40), last_name = String(b.last_name || '').trim().slice(0, 40);
      const phone = String(b.phone || '').trim().slice(0, 30);
      if (phone && phone.replace(/\D/g, '').length < 9) return res.status(400).json({ error: "Telefon raqam noto'g'ri" });
      const w = await rest('customers?on_conflict=tg_user_id', {
        method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify({ tg_user_id: id, first_name, last_name, phone, updated_at: new Date().toISOString() })
      });
      if (!w.ok) return res.status(500).json({ error: 'Saqlanmadi' });
    }
    const r = await rest(`customers?tg_user_id=eq.${id}&select=first_name,last_name,phone`);
    res.status(200).json((r.ok && (await r.json())[0]) || {});
  } catch (e) {
    res.status(500).json({ error: 'Server xatosi' });
  }
};
