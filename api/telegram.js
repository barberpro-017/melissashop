const SB = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY };

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(200).send('ok');
  const secret = req.headers['x-telegram-bot-api-secret-token'];
  if (!secret || !SB || !KEY) return res.status(401).end();

  // Secret orqali qaysi bot ekanini topamiz
  const r = await fetch(`${SB}/rest/v1/bot_secrets?webhook_secret=eq.${encodeURIComponent(secret)}&select=token,bots(mini_app_url)`, { headers: H });
  const row = r.ok ? (await r.json())[0] : null;
  if (!row) return res.status(401).end();

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const chatId = body.message && body.message.chat && body.message.chat.id;
  if (chatId) {
    await fetch(`https://api.telegram.org/bot${row.token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: "Melissa do'koniga xush kelibsiz 🌸",
        reply_markup: { inline_keyboard: [[{ text: "🛍 Do'konni ochish", web_app: { url: row.bots.mini_app_url } }]] }
      })
    });
  }
  res.status(200).json({ ok: true });
};
