const { SB, KEY, rest, body, verifyInitData } = require('./_lib');

const PROMOS = { MELISSA10: 10 }; // promo-kod: foiz chegirma (mini appdagi bilan bir xil)
const SIZES = ['XS', 'S', 'M', 'L', 'XL'];
const money = n => Number(n).toLocaleString('en-US') + " so'm";

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!SB || !KEY) return res.status(500).json({ error: 'Server sozlanmagan' });

  try {
    const b = body(req);
    const auth = await verifyInitData(b.initData);
    if (!auth) return res.status(401).json({ error: 'Ilovani Telegram orqali oching' });

    const name = String(b.name || '').trim().slice(0, 80);
    const phone = String(b.phone || '').trim().slice(0, 30);
    const address = String(b.address || '').trim().slice(0, 250);
    const payment = String(b.payment || '').trim().slice(0, 60);
    if (!name || phone.replace(/\D/g, '').length < 9 || address.length < 5)
      return res.status(400).json({ error: "Ism, telefon va manzilni to'liq kiriting" });

    const reqItems = Array.isArray(b.items) ? b.items.slice(0, 30) : [];
    const ids = [...new Set(reqItems.map(i => Number(i.id)).filter(Number.isInteger))];
    if (!reqItems.length || !ids.length) return res.status(400).json({ error: "Savat bo'sh" });

    // Narx va tannarx faqat serverda, bazadan olinadi (mijoz yuborgan narxga ishonilmaydi)
    const [pr, cr] = await Promise.all([
      rest(`products?id=in.(${ids.join(',')})&select=id,name,category,price`),
      rest(`product_costs?product_id=in.(${ids.join(',')})&select=product_id,cost_price`)
    ]);
    if (!pr.ok) return res.status(500).json({ error: "Mahsulotlarni o'qib bo'lmadi" });
    const prod = new Map((await pr.json()).map(p => [p.id, p]));
    const cost = new Map(((cr.ok ? await cr.json() : [])).map(c => [c.product_id, Number(c.cost_price)]));

    const items = [];
    for (const i of reqItems) {
      const p = prod.get(Number(i.id));
      const qty = Number(i.qty);
      if (!p || !SIZES.includes(i.size) || !Number.isInteger(qty) || qty < 1 || qty > 20)
        return res.status(400).json({ error: "Savatdagi mahsulot topilmadi. Savatni yangilang" });
      items.push({ id: p.id, name: p.name, category: p.category, size: i.size, qty, price: Number(p.price), cost: cost.get(p.id) || 0 });
    }

    const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
    const pct = PROMOS[String(b.promo || '').trim().toUpperCase()] || 0;
    const discount = Math.round(subtotal * pct / 100);
    const amount = subtotal - discount;
    const totalCost = items.reduce((s, i) => s + i.cost * i.qty, 0);
    const summary = items.map(i => `${i.name} (${i.size})${i.qty > 1 ? ' ×' + i.qty : ''}`).join(', ');

    const ins = await rest('orders', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        customer: name, product: summary.slice(0, 500), amount, cost: totalCost, discount, payment, phone, address,
        items, tg_user_id: auth.user.id, tg_username: auth.user.username || null
      })
    });
    if (!ins.ok) return res.status(500).json({ error: 'Buyurtma saqlanmadi' });
    const order = (await ins.json())[0];

    // Mijozga bot orqali tasdiq xabari (xato bo'lsa, buyurtmaga ta'sir qilmaydi)
    try {
      await fetch(`https://api.telegram.org/bot${auth.token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: auth.user.id,
          text: `✅ Buyurtmangiz qabul qilindi!\n\n#MEL-${order.id}\n${items.map(i => `• ${i.name} (${i.size}) × ${i.qty}`).join('\n')}\n\nJami: ${money(amount)}\nOperatorimiz tez orada siz bilan bog'lanadi.`
        })
      });
    } catch (_) {}

    res.status(200).json({ ok: true, id: order.id, amount, discount });
  } catch (e) {
    res.status(500).json({ error: 'Server xatosi' });
  }
};
