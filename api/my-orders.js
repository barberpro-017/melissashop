const { SB, KEY, rest, body, verifyInitData } = require('./_lib');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!SB || !KEY) return res.status(500).json({ error: 'Server sozlanmagan' });
  try {
    const auth = await verifyInitData(body(req).initData);
    if (!auth) return res.status(401).json({ error: 'Ilovani Telegram orqali oching' });
    const r = await rest(`orders?tg_user_id=eq.${Number(auth.user.id)}&select=id,product,amount,status,created_at&order=created_at.desc&limit=50`);
    if (!r.ok) return res.status(500).json({ error: "Buyurtmalarni o'qib bo'lmadi" });
    res.status(200).json(await r.json());
  } catch (e) {
    res.status(500).json({ error: 'Server xatosi' });
  }
};
