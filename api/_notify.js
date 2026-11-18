const { rest } = require('./_lib');

const fmt = n => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + " so'm";
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const when = d => new Date(d).toLocaleString('en-GB', { timeZone: 'Asia/Tashkent', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', ' ·');

const tgCall = async (token, method, payload) => {
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    return await r.json();
  } catch (_) { return { ok: false }; }
};

// Mijoz qaysi bot orqali kirgan bo'lsa, o'sha bot orqali yuboradi (bilinmasa, hamma botni sinab ko'radi)
async function sendVia(botId, chatId, make) {
  const q = botId ? `bot_secrets?bot_id=eq.${Number(botId)}&select=token,bots(mini_app_url)` : 'bot_secrets?select=token,bots(mini_app_url)';
  const r = await rest(q);
  if (!r.ok) return false;
  for (const row of await r.json()) {
    const payload = await make(row.bots && row.bots.mini_app_url);
    if (!payload) continue;
    const res = await tgCall(row.token, 'sendMessage', { chat_id: chatId, ...payload });
    if (res.ok) return true;
    if (payload.link_preview_options && !payload.link_preview_options.is_disabled) {
      const again = await tgCall(row.token, 'sendMessage', { chat_id: chatId, ...payload, link_preview_options: { is_disabled: true } });
      if (again.ok) return true;
    }
  }
  return false;
}

const HEAD = {
  placed: ['🛍', 'Buyurtmangiz qabul qilindi!', 'Rahmat, {n}! Buyurtmangizni tez orada tayyorlaymiz.'],
  shipping: ['🚚', "Buyurtmangiz yo'lga chiqdi!", "{n}, buyurtmangiz yetkazib berish nuqtasiga yo'l oldi."],
  delivered: ['🎁', 'Buyurtmangiz yetib keldi!', 'Xaridingiz uchun rahmat, {n}! Kiyimlaringiz sizga yarashsin 💛'],
  cancelled: ['❌', 'Buyurtma bekor qilindi', "{n}, buyurtmangiz bekor qilindi. Savollaringiz bo'lsa, biz bilan bog'laning."]
};
const TRACK = {
  placed: ['✅ Qabul qilindi', "⬜ Yo'lda", '⬜ Yetib keldi'],
  shipping: ['✅ Qabul qilindi', "🚚 <b>Yo'lda</b>", '⬜ Yetib keldi'],
  delivered: ['✅ Qabul qilindi', "✅ Yo'lda", '🎁 <b>Yetib keldi</b>']
};

function buildOrderMessage(o, kind, instructions) {
  const [ic, title, sub] = HEAD[kind];
  const first = String(o.customer || '').split(/\s+/)[0] || 'hurmatli mijoz';
  const items = (o.items && o.items.length) ? o.items : [{ name: o.product, size: '', qty: 1, price: o.amount }];
  const list = items.map((i, k) => `${k + 1}. <b>${esc(i.name)}</b>\n    ${i.size ? esc(i.size) + ' · ' : ''}${i.qty} × ${fmt(i.price)}${i.discount_percent ? ` <i>(-${i.discount_percent}%)</i>` : ''}`).join('\n');
  const subtotal = items.reduce((s, i) => s + Number(i.price) * Number(i.qty), 0);
  const lines = [
    `${ic} <b>${esc(title)}</b>`, "<i>Melissa · Women's Clothing</i>", '',
    esc(sub.replace('{n}', first)), '',
    `🧾 <b>#MEL-${o.id}</b>  ·  ${when(o.created_at)}`, '',
    `<blockquote>${list}</blockquote>`, '',
    `Mahsulotlar: ${fmt(subtotal)}`,
    Number(o.discount) > 0 ? `🎟 Promokod <b>${esc(o.promo_code || '')}</b>: −${fmt(o.discount)}` : null,
    `💰 <b>Jami: ${fmt(o.amount)}</b>`, '',
    `📍 ${esc(o.address)}`,
    `💳 ${esc(o.payment)}`,
    kind === 'placed' && instructions ? `\n<blockquote>${esc(instructions)}</blockquote>` : null,
    TRACK[kind] ? '\n' + TRACK[kind].join('\n') : null
  ].filter(x => x !== null);
  return lines.join('\n');
}

// Buyurtma holati haqida chiroyli xabar: rasm (oldindan ko'rish), chek, bosqichlar va tugmalar
async function notifyOrder(o, kind) {
  if (!o || !o.tg_user_id || !HEAD[kind]) return false;
  let instructions = '';
  try {
    const pr = await rest(`payment_methods?name=eq.${encodeURIComponent(o.payment || '')}&select=instructions`);
    instructions = (pr.ok && (await pr.json())[0] || {}).instructions || '';
  } catch (_) {}
  const img = ((o.items || []).find(i => i.img) || {}).img;
  const text = buildOrderMessage(o, kind, instructions);
  return sendVia(o.bot_id, o.tg_user_id, miniUrl => {
    const go = g => (miniUrl ? miniUrl + (g ? '?go=' + g : '') : null);
    const row1 = miniUrl ? [{ text: "🛍 Do'konni ochish", web_app: { url: go() } }] : [];
    const row2 = miniUrl ? [kind === 'delivered' ? { text: '⭐ Fikr bildirish', web_app: { url: go('support') } } : { text: '📦 Buyurtmalarim', web_app: { url: go('orders') } }, { text: "💬 Yordam", web_app: { url: go('support') } }] : [];
    return {
      text, parse_mode: 'HTML',
      link_preview_options: img ? { url: img, show_above_text: true, prefer_large_media: true } : { is_disabled: true },
      reply_markup: miniUrl ? { inline_keyboard: [row1, row2] } : undefined
    };
  });
}

module.exports = { fmt, esc, when, tgCall, sendVia, buildOrderMessage, notifyOrder };
