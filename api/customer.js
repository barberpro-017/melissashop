const { SB, KEY, rest, body, verifyInitData } = require('./_lib');

// Mijoz: profil (ism, familiya, telefon) va qo'llab-quvvatlash xabarlari
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!SB || !KEY) return res.status(500).json({ error: 'Server sozlanmagan' });
  try {
    const b = body(req);
    const auth = await verifyInitData(b.initData);
    if (!auth) return res.status(401).json({ error: 'Ilovani Telegram orqali oching' });
    const id = Number(auth.user.id);

    // ---- Qo'llab-quvvatlash: murojaat yuborish
    if (b.action === 'support_send') {
      const kind = b.kind === 'Shikoyat' ? 'Shikoyat' : 'Izoh';
      const message = String(b.message || '').trim().slice(0, 1000);
      if (message.length < 5) return res.status(400).json({ error: "Xabar juda qisqa. Iltimos, batafsilroq yozing" });

      const since = new Date(Date.now() - 3600 * 1000).toISOString();
      const recent = await rest(`support_messages?tg_user_id=eq.${id}&created_at=gte.${encodeURIComponent(since)}&select=id`);
      if (recent.ok && (await recent.json()).length >= 5) return res.status(429).json({ error: "Juda ko'p xabar yuborildi. Birozdan keyin urinib ko'ring" });

      let product_id = null, product_name = null;
      if (Number.isInteger(Number(b.product_id)) && Number(b.product_id) > 0) {
        const pr = await rest(`products?id=eq.${Number(b.product_id)}&select=id,name`);
        const p = pr.ok ? (await pr.json())[0] : null;
        if (p) { product_id = p.id; product_name = p.name; }
      }
      const cr = await rest(`customers?tg_user_id=eq.${id}&select=first_name,last_name,phone`);
      const c = (cr.ok && (await cr.json())[0]) || {};
      const name = [c.first_name || auth.user.first_name, c.last_name || auth.user.last_name].filter(Boolean).join(' ') || 'Mijoz';

      const ins = await rest('support_messages', {
        method: 'POST',
        body: JSON.stringify({ tg_user_id: id, bot_id: Number(String(auth.token).split(':')[0]), name, phone: c.phone || null, tg_username: auth.user.username || null, kind, product_id, product_name, message })
      });
      if (!ins.ok) return res.status(500).json({ error: 'Xabar yuborilmadi' });
      return res.status(200).json({ ok: true });
    }

    // ---- Qo'llab-quvvatlash: o'z murojaatlari
    if (b.action === 'support_list') {
      const r = await rest(`support_messages?tg_user_id=eq.${id}&select=id,kind,message,product_name,status,admin_reply,replied_at,created_at&order=created_at.desc&limit=30`);
      return res.status(200).json(r.ok ? await r.json() : []);
    }

    // ---- Profil
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
