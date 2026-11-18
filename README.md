# Melissa — Admin Panel

Statik sayt (HTML + Tailwind + Supabase) + 2 ta Vercel serverless funksiya (`api/`).

## Fayllar
- `index.html` — admin panel
- `config.js` — Supabase URL va anon key
- `supabase.sql` — asosiy jadvallar, RLS, namunaviy ma'lumotlar
- `supabase-bots.sql` — Bot nazorati jadvallari
- `supabase-update-2.sql` — kategoriyalar, rasm yuklash (Storage), demo ma'lumotlarni tozalash
- `supabase-update-3.sql` — kelish narxi, buyurtma tafsilotlari, mahsulot tavsifi
- `supabase-update-4.sql` — sotuvchilar, o'lchamlar, chegirmalar, promokodlar, poster, mijozlar profili, rol xavfsizligi
- `supabase-update-5.sql` — to'lov turlari, qo'llab-quvvatlash, sotuvchi huquqlari, bazani tozalash funksiyasi
- `app/index.html` — Telegram mini app (manzil: `https://<sayt>/app/`)
- `api/bots.js` — botni mini app qilish / o'chirish (token shu yerda ishlaydi)
- `api/order.js`, `api/my-orders.js`, `api/_lib.js` — mini app buyurtmalari (narxlar serverda hisoblanadi)
- `api/sellers.js`, `api/seller-orders.js` — sotuvchilarni boshqarish va ularning buyurtmalari
- `api/promo.js`, `api/customer.js` — promokod tekshirish, mijoz profili
- `api/admin.js` — buyurtma holati (mijozga xabar bilan), murojaatga javob, bazani tozalash
- `api/_notify.js` — mijozga yuboriladigan chiroyli bot xabarlari
- `api/profile.js` — admin ism/login/parolni o'zgartirish
- `api/telegram.js` — botning /start javobi (webhook)
- `vercel.json` — Vercel sozlamalari

## 1. Supabase
1. SQL Editor → `supabase.sql` ni Run, keyin `supabase-bots.sql`, keyin `supabase-update-2.sql`, keyin `supabase-update-3.sql`, keyin `supabase-update-4.sql`, keyin `supabase-update-5.sql` ni Run.
2. Authentication → Users → Add user: `melissaadmin@melissa.uz` + parol (Auto Confirm User yoqilgan).
3. Authentication → Sign In / Providers → Email: "Allow new users to sign up" ni o'chiring.
4. Project Settings → API: Project URL va `anon public` kalitni `config.js` ga yozing.

## 2. GitHub
Fayllarni repo'ga yuklang (`index.html` va `api` papkasi repo ildizida bo'lsin).

## 3. Vercel
1. Add New → Project → repo'ni Import. Framework Preset: **Other**.
2. Settings → Environment Variables:
   - `SUPABASE_URL` = Project URL
   - `SUPABASE_SERVICE_ROLE_KEY` = Project Settings → API → `service_role` kalit (faqat Vercel'da, kodga YOZMANG)
   - `MINIAPP_URL` (ixtiyoriy) = mini app manzili. Bo'sh bo'lsa `https://<sayt>/app/` ishlatiladi.
3. Deploy (o'zgaruvchilarni qo'shgandan keyin Redeploy qiling).

## Xavfsizlik
- Parol va service_role kalit repoda bo'lmasin.
- Bot tokenlari `bot_secrets` jadvalida, brauzerdan o'qib bo'lmaydi.
