const { SB, KEY, rest, body, authUser, roleOf } = require('./_lib');

const adm = (path, method, data) => fetch(`${SB}/auth/v1/admin/${path}`, {
  method,
  headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
  body: data ? JSON.stringify(data) : undefined
});
const errMsg = async r => { try { const j = await r.json(); return j.msg || j.message || j.error_description || 'Xatolik'; } catch (_) { return 'Xatolik'; } };

// Faqat admin: sotuvchi yaratish, tahrirlash, o'chirish
module.exports = async (req, res) => {
  if (!SB || !KEY) return res.status(500).json({ error: "Vercel'da SUPABASE_URL va SUPABASE_SERVICE_ROLE_KEY kiritilmagan" });
  const u = await authUser(req);
  if (!u || roleOf(u) === 'seller') return res.status(401).json({ error: "Ruxsat yo'q" });
  const b = body(req);

  try {
    if (req.method === 'POST') {
      const name = String(b.name || '').trim().slice(0, 80), phone = String(b.phone || '').trim().slice(0, 30);
      const login = String(b.login || '').trim().toLowerCase(), password = String(b.password || '');
      if (!name) return res.status(400).json({ error: 'Nomi kerak' });
      if (!/^[a-z0-9._-]{3,30}$/.test(login)) return res.status(400).json({ error: "Login: 3-30 belgi, faqat lotin harflari, raqam, nuqta va chiziq" });
      if (password.length < 6) return res.status(400).json({ error: "Parol kamida 6 ta belgi bo'lsin" });

      const ins = await rest('sellers', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ name, phone, login }) });
      if (!ins.ok) return res.status(400).json({ error: (await ins.text()).includes('duplicate') ? 'Bunday login mavjud' : 'Saqlanmadi' });
      const s = (await ins.json())[0];

      const ur = await adm('users', 'POST', { email: login + '@melissa.uz', password, email_confirm: true, app_metadata: { role: 'seller', seller_id: s.id }, user_metadata: { full_name: name } });
      if (!ur.ok) { await rest(`sellers?id=eq.${s.id}`, { method: 'DELETE' }); return res.status(400).json({ error: await errMsg(ur) }); }
      await rest(`sellers?id=eq.${s.id}`, { method: 'PATCH', body: JSON.stringify({ auth_user_id: (await ur.json()).id }) });
      return res.status(200).json({ ok: true, id: s.id });
    }

    const id = Number(b.id);
    if (!id) return res.status(400).json({ error: 'Sotuvchi id kerak' });
    const sr = await rest(`sellers?id=eq.${id}&select=*`);
    const s = sr.ok ? (await sr.json())[0] : null;
    if (!s) return res.status(404).json({ error: 'Sotuvchi topilmadi' });

    if (req.method === 'PUT') {
      const patch = {};
      if (b.name !== undefined) patch.name = String(b.name).trim().slice(0, 80) || s.name;
      if (b.phone !== undefined) patch.phone = String(b.phone).trim().slice(0, 30);
      if (b.active !== undefined && !s.is_main) patch.active = !!b.active;
      if (Object.keys(patch).length) await rest(`sellers?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
      if (s.auth_user_id) {
        const au = { user_metadata: { full_name: patch.name || s.name } };
        if (b.new_password) {
          if (String(b.new_password).length < 6) return res.status(400).json({ error: "Parol kamida 6 ta belgi bo'lsin" });
          au.password = String(b.new_password);
        }
        if (patch.active !== undefined) au.ban_duration = patch.active ? 'none' : '876000h';
        const r = await adm(`users/${s.auth_user_id}`, 'PUT', au);
        if (!r.ok) return res.status(400).json({ error: await errMsg(r) });
      }
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'DELETE') {
      if (s.is_main) return res.status(400).json({ error: "Asosiy do'konni o'chirib bo'lmaydi" });
      const pr = await rest(`products?seller_id=eq.${id}&select=id&limit=1`);
      if (pr.ok && (await pr.json()).length) return res.status(400).json({ error: "Avval bu sotuvchining mahsulotlarini o'chiring" });
      if (s.auth_user_id) await adm(`users/${s.auth_user_id}`, 'DELETE');
      await rest(`categories?seller_id=eq.${id}`, { method: 'DELETE' });
      await rest(`sellers?id=eq.${id}`, { method: 'DELETE' });
      return res.status(200).json({ ok: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    res.status(500).json({ error: 'Server xatosi' });
  }
};
