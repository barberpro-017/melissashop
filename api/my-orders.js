const { SB, KEY, rest, body, verifyInitData } = require('./_lib');

const tier = a => (a >= 200000 ? 2 : a >= 100000 ? 1 : 0);

// Buyurtmalar tarixi + Melissa Club karta (birinchi buyurtmadan 2 oy, 100 000 dan 1%, 200 000 dan 2%)
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!SB || !KEY) return res.status(500).json({ error: 'Server sozlanmagan' });
  try {
    const auth = await verifyInitData(body(req).initData);
    if (!auth) return res.status(401).json({ error: 'Ilovani Telegram orqali oching' });
    const r = await rest(`orders?tg_user_id=eq.${Number(auth.user.id)}&select=id,product,amount,status,created_at&order=created_at.asc&limit=1000`);
    if (!r.ok) return res.status(500).json({ error: "Buyurtmalarni o'qib bo'lmadi" });
    const all = await r.json();

    let card = null;
    if (all.length) {
      const opened = new Date(all[0].created_at), expires = new Date(opened);
      expires.setMonth(expires.getMonth() + 2);
      const balance = all
        .filter(o => o.status !== 'Bekor qilindi' && new Date(o.created_at) <= expires)
        .reduce((s, o) => s + Math.floor(Number(o.amount) * tier(Number(o.amount)) / 100), 0);
      card = { opened_at: opened.toISOString(), expires_at: expires.toISOString(), balance };
    }
    res.status(200).json({ orders: all.slice(-50).reverse(), card });
  } catch (e) {
    res.status(500).json({ error: 'Server xatosi' });
  }
};
