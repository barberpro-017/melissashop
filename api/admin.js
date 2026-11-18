const { SB, KEY, H, rest, body, authUser, roleOf } = require('./_lib');
const { esc, notifyOrder, sendVia } = require('./_notify');

const adm = (path, method, data) => fetch(`${SB}/auth/v1/admin/${path}`, {
  method, headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' }, body: data ? JSON.stringify(data) : undefined
});
const STATUSES = ['Kutilmoqda', 'Yetkazilmoqda', 'Bajarildi', 'Bekor qilindi'];
const KIND = { 'Yetkazilmoqda': 'shipping', 'Bajarildi': 'delivered', 'Bekor qilindi': 'cancelled' };
const norm = s => String(s || '').trim().toUpperCase().replace(/[’ʻʼ`‘]/g, "'");

// Storage'dagi hamma rasmlarni o'chiradi
async function clearImages() {
  for (let i = 0; i < 30; i++) {
    const r = await fetch(`${SB}/storage/v1/object/list/product-images`, { method: 'POST', headers: H, body: JSON.stringify({ prefix: '', limit: 1000, offset: 0 }) });
    const list = r.ok ? await r.json() : [];
    const names = list.filter(x => x && x.name && x.id).map(x => x.name);
    if (!names.length) return;
    await fetch(`${SB}/storage/v1/object/product-images`, { method: 'DELETE', headers: H, body: JSON.stringify({ prefixes: names }) });
  }
}

// Faqat admin: buyurtma holati (+mijozga xabar), murojaatga javob, bazani tozalash
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!SB || !KEY) return res.status(500).json({ error: "Vercel'da SUPABASE_URL va SUPABASE_SERVICE_ROLE_KEY kiritilmagan" });
  const u = await authUser(req);
  if (!u || roleOf(u) === 'seller') return res.status(401).json({ error: "Ruxsat yo'q" });
  const b = body(req);

  try {
    if (b.action === 'order-status') {
      const id = Number(b.id), status = String(b.status || '');
      if (!id || !STATUSES.includes(status)) return res.status(400).json({ error: "Holat noto'g'ri" });
      const r = await rest(`orders?id=eq.${id}&select=*`);
      const o = r.ok ? (await r.json())[0] : null;
      if (!o) return res.status(404).json({ error: 'Buyurtma topilmadi' });
      const up = await rest(`orders?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      if (!up.ok) return res.status(500).json({ error: 'Holat saqlanmadi' });
      let notified = false;
      if (o.status !== status && KIND[status]) { try { notified = await notifyOrder({ ...o, status }, KIND[status]); } catch (_) {} }
      return res.status(200).json({ ok: true, notified });
    }

    if (b.action === 'support-reply') {
      const id = Number(b.id), reply = String(b.reply || '').trim().slice(0, 1000);
      if (!id || reply.length < 2) return res.status(400).json({ error: 'Javob matnini yozing' });
      const r = await rest(`support_messages?id=eq.${id}&select=*`);
      const m = r.ok ? (await r.json())[0] : null;
      if (!m) return res.status(404).json({ error: 'Xabar topilmadi' });
      const up = await rest(`support_messages?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ admin_reply: reply, replied_at: new Date().toISOString(), status: 'Hal qilindi', read: true }) });
      if (!up.ok) return res.status(500).json({ error: 'Javob saqlanmadi' });
      const text = `💬 <b>Melissa jamoasidan javob</b>\n\n<i>Sizning ${m.kind === 'Shikoyat' ? 'shikoyatingiz' : 'izohingiz'}:</i>\n<blockquote>${esc(m.message)}</blockquote>\n\n<b>Javob:</b>\n${esc(reply)}\n\nRahmat, biz bilan bo'lganingiz uchun 💛`;
      const notified = await sendVia(m.bot_id, m.tg_user_id, miniUrl => ({
        text, parse_mode: 'HTML', link_preview_options: { is_disabled: true },
        reply_markup: miniUrl ? { inline_keyboard: [[{ text: "🛍 Do'konni ochish", web_app: { url: miniUrl } }]] } : undefined
      }));
      return res.status(200).json({ ok: true, notified });
    }

    if (b.action === 'reset-db') {
      if (norm(b.confirm) !== "O'CHIRISH") return res.status(400).json({ error: "Tasdiqlash so'zi noto'g'ri" });
      const sr = await rest('sellers?is_main=eq.false&select=auth_user_id');
      for (const s of (sr.ok ? await sr.json() : [])) if (s.auth_user_id) await adm(`users/${s.auth_user_id}`, 'DELETE');
      const rr = await fetch(`${SB}/rest/v1/rpc/reset_shop_data`, { method: 'POST', headers: H, body: '{}' });
      if (!rr.ok) return res.status(500).json({ error: "Baza tozalanmadi. supabase-update-5.sql ni Run qilganingizni tekshiring" });
      await clearImages();
      return res.status(200).json({ ok: true });
    }

    res.status(400).json({ error: "Noma'lum amal" });
  } catch (e) {
    res.status(500).json({ error: 'Server xatosi' });
  }
};
