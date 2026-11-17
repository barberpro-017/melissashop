const { SB, KEY, rest, authUser, roleOf } = require('./_lib');

// Sotuvchi faqat o'z mahsulotlari kiritilgan buyurtma qatorlarini ko'radi (boshqa sotuvchilarniki yashiriladi)
module.exports = async (req, res) => {
  if (!SB || !KEY) return res.status(500).json({ error: 'Server sozlanmagan' });
  const u = await authUser(req);
  if (!u || roleOf(u) !== 'seller') return res.status(401).json({ error: "Ruxsat yo'q" });
  const sid = Number(u.app_metadata.seller_id);
  try {
    const filter = encodeURIComponent(JSON.stringify([{ seller_id: sid }]));
    const r = await rest(`orders?items=cs.${filter}&select=*&order=created_at.desc&limit=500`);
    if (!r.ok) return res.status(500).json({ error: "Buyurtmalarni o'qib bo'lmadi" });
    const out = (await r.json()).map(o => {
      const items = (o.items || []).filter(i => Number(i.seller_id) === sid);
      return {
        id: o.id, created_at: o.created_at, status: o.status, customer: o.customer, phone: o.phone, address: o.address,
        payment: o.payment, items, discount: 0, promo_code: null, note: o.note,
        product: items.map(i => `${i.name} (${i.size})${i.qty > 1 ? ' ×' + i.qty : ''}`).join(', '),
        amount: items.reduce((s, i) => s + i.price * i.qty, 0),
        cost: items.reduce((s, i) => s + (i.cost || 0) * i.qty, 0)
      };
    });
    res.status(200).json(out);
  } catch (e) {
    res.status(500).json({ error: 'Server xatosi' });
  }
};
