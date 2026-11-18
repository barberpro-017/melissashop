const { SB, KEY, rest, body, verifyInitData } = require('./_lib');
const { notifyOrder } = require('./_notify');

const DEF_SIZES = ['XS', 'S', 'M', 'L', 'XL'];

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!SB || !KEY) return res.status(500).json({ error: 'Server sozlanmagan' });

  try {
    const b = body(req);
    const auth = await verifyInitData(b.initData);
    if (!auth) return res.status(401).json({ error: 'Ilovani Telegram orqali oching' });

    const name = String(b.name || '').trim().slice(0, 80);
    const phone = String(b.phone || '').trim().slice(0, 30);
    const payment = String(b.payment || '').trim().slice(0, 60);
    if (!name || phone.replace(/\D/g, '').length < 9)
      return res.status(400).json({ error: "Ism va telefon raqamni to'liq kiriting (Profil → Mening profilim)" });

    // To'lov turi faqat admin yoqib qo'ygan turlardan
    const pmr = await rest('payment_methods?active=eq.true&select=name');
    const pms = pmr.ok ? (await pmr.json()).map(x => x.name) : [];
    if (pms.length && !pms.includes(payment)) return res.status(400).json({ error: "To'lov turini tanlang" });

    // Yetkazib berish nuqtasi faqat admin kiritgan ro'yxatdan
    const lid = Number(b.location_id);
    const lr = Number.isInteger(lid) ? await rest(`locations?id=eq.${lid}&select=id,name,address`) : null;
    const loc = lr && lr.ok ? (await lr.json())[0] : null;
    if (!loc) return res.status(400).json({ error: 'Yetkazib berish nuqtasini tanlang' });

    const reqItems = Array.isArray(b.items) ? b.items.slice(0, 30) : [];
    const ids = [...new Set(reqItems.map(i => Number(i.id)).filter(Number.isInteger))];
    if (!reqItems.length || !ids.length) return res.status(400).json({ error: "Savat bo'sh" });

    // Narx, chegirma va tannarx faqat serverda, bazadan olinadi
    const [pr, cr] = await Promise.all([
      rest(`products?id=in.(${ids.join(',')})&select=id,name,category,price,discount_percent,sizes,seller_id,images`),
      rest(`product_costs?product_id=in.(${ids.join(',')})&select=product_id,cost_price`)
    ]);
    if (!pr.ok) return res.status(500).json({ error: "Mahsulotlarni o'qib bo'lmadi" });
    const prod = new Map((await pr.json()).map(p => [p.id, p]));
    const cost = new Map((cr.ok ? await cr.json() : []).map(c => [c.product_id, Number(c.cost_price)]));

    const items = [];
    for (const i of reqItems) {
      const p = prod.get(Number(i.id));
      const qty = Number(i.qty);
      const allowed = p && p.sizes && p.sizes.length ? p.sizes : DEF_SIZES;
      if (!p || !allowed.includes(String(i.size)) || !Number.isInteger(qty) || qty < 1 || qty > 20)
        return res.status(400).json({ error: "Savatdagi mahsulot yoki o'lcham topilmadi. Savatni yangilang" });
      const list = Number(p.price), pct = Number(p.discount_percent) || 0;
      items.push({
        id: p.id, name: p.name, category: p.category, size: String(i.size), qty,
        price: Math.round(list * (100 - pct) / 100), list_price: list, discount_percent: pct,
        cost: cost.get(p.id) || 0, seller_id: p.seller_id, img: (p.images || [])[0] || null
      });
    }

    const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
    let pct = 0, promoCode = null, eligible = subtotal;
    const code = String(b.promo || '').trim().toUpperCase();
    if (code) {
      const pc = await rest(`promo_codes?code=eq.${encodeURIComponent(code)}&active=eq.true&select=code,percent,seller_id`);
      const row = pc.ok ? (await pc.json())[0] : null;
      if (!row) return res.status(400).json({ error: 'Promo-kod yaroqsiz' });
      pct = row.percent; promoCode = row.code;
      if (row.seller_id) {
        eligible = items.filter(i => i.seller_id === row.seller_id).reduce((s, i) => s + i.price * i.qty, 0);
        if (!eligible) return res.status(400).json({ error: "Bu promo-kod savatdagi mahsulotlarga amal qilmaydi" });
      }
    }
    const discount = Math.round(eligible * pct / 100);
    const amount = subtotal - discount;
    const totalCost = items.reduce((s, i) => s + i.cost * i.qty, 0);
    const summary = items.map(i => `${i.name} (${i.size})${i.qty > 1 ? ' ×' + i.qty : ''}`).join(', ');

    const ins = await rest('orders', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        customer: name, product: summary.slice(0, 500), amount, cost: totalCost, discount, payment, phone,
        address: `${loc.name} — ${loc.address}`, location_id: loc.id, promo_code: promoCode,
        items, tg_user_id: auth.user.id, tg_username: auth.user.username || null, bot_id: Number(String(auth.token).split(':')[0])
      })
    });
    if (!ins.ok) return res.status(500).json({ error: 'Buyurtma saqlanmadi' });
    const order = (await ins.json())[0];

    // Mijoz profilini (yo'q bo'lsa) yaratish
    try {
      const [fn, ...rest_] = name.split(/\s+/);
      await rest('customers?on_conflict=tg_user_id', {
        method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates' },
        body: JSON.stringify({ tg_user_id: auth.user.id, first_name: fn, last_name: rest_.join(' '), phone })
      });
    } catch (_) {}

    // Mijozga bot orqali chiroyli tasdiq xabari (rasm, chek, bosqichlar, tugmalar)
    let notified = false;
    try { notified = await notifyOrder(order, 'placed'); } catch (_) {}

    res.status(200).json({ ok: true, id: order.id, amount, discount, notified });
  } catch (e) {
    res.status(500).json({ error: 'Server xatosi' });
  }
};
