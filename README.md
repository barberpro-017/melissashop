# Melissa — Admin Panel

Statik sayt (HTML + Tailwind + Supabase). Build kerak emas.

## Fayllar
- `index.html` — admin panel
- `config.js` — Supabase URL va anon key
- `supabase.sql` — jadvallar, RLS, namunaviy ma'lumotlar
- `vercel.json` — Vercel sozlamalari

## 1. Supabase
1. Yangi project oching → SQL Editor → `supabase.sql` ni Run qiling.
2. Authentication → Users → **Add user**:
   - Email: `melissaadmin@melissa.uz`
   - Parol: o'zingiz belgilagan parol (kodga yozilmaydi!)
   - **Auto Confirm User** yoqilgan bo'lsin.
3. Authentication → Sign In / Providers → Email: **Allow new users to sign up** ni o'chiring.
4. Project Settings → API: `Project URL` va `anon public` kalitni `config.js` ga yozing.

Saytda login: `melissaadmin` (email avtomatik `melissaadmin@melissa.uz` bo'ladi).

## 2. GitHub
```
git init
git add .
git commit -m "Melissa admin"
git branch -M main
git remote add origin https://github.com/<username>/melissa-admin.git
git push -u origin main
```

## 3. Vercel
1. vercel.com → Add New → Project → GitHub repo'ni tanlang.
2. Framework Preset: **Other**. Build Command va Output Directory bo'sh qoladi.
3. Deploy.

Keyingi o'zgarishlar `git push` bilan avtomatik deploy bo'ladi.

## Xavfsizlik
- Parol faqat Supabase Auth'da turadi, repoda yo'q.
- `service_role` kalitni hech qachon repoga qo'ymang.
- Ma'lumotlarni himoyalash RLS orqali amalga oshadi (`supabase.sql`).
