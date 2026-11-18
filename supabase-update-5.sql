-- 5-yangilanish. Supabase → SQL Editor → Run. Qayta Run qilish xavfsiz.
-- Avval update-2, 3 va 4 Run qilingan bo'lishi kerak.

-- 1) Sotuvchilar boshqa sotuvchi nomlarini ko'ra olsin (login/telefon emas)
create or replace view sellers_public as select id, name, is_main from sellers where active;
grant select on sellers_public to anon, authenticated;

-- 2) Sotuvchi hamma mahsulotni ko'radi, lekin faqat o'zinikini o'zgartiradi (RLS "seller own" siyosati bor)
drop policy if exists "auth read" on products;
create policy "auth read" on products for select to authenticated using (true);

-- 3) Yetkazib berish nuqtalari: kim qo'shgani; sotuvchi faqat o'zinikini o'chiradi
alter table locations add column if not exists seller_id bigint references sellers(id);
update locations set seller_id = (select id from sellers where is_main limit 1) where seller_id is null;
drop policy if exists "auth read" on locations;
create policy "auth read" on locations for select to authenticated using (true);
drop policy if exists "seller insert" on locations;
create policy "seller insert" on locations for insert to authenticated with check (seller_id = my_seller());
drop policy if exists "seller delete" on locations;
create policy "seller delete" on locations for delete to authenticated using (seller_id = my_seller());

-- 4) Promokod sotuvchiga tegishli bo'lishi mumkin (faqat uning mahsulotlariga chegirma beradi)
alter table promo_codes add column if not exists seller_id bigint references sellers(id);
drop policy if exists "seller own" on promo_codes;
create policy "seller own" on promo_codes for all to authenticated
  using (seller_id = my_seller()) with check (seller_id = my_seller());

-- 5) Buyurtma qaysi bot orqali kelgani (mijozga xabar yuborish uchun)
alter table orders add column if not exists bot_id bigint;

-- 6) To'lov turlari
create table if not exists payment_methods (
  id bigint generated always as identity primary key,
  name text not null unique,
  kind text not null default 'other',
  icon text not null default 'fa-credit-card',
  color text not null default '#D4A373',
  description text,
  instructions text,
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
alter table payment_methods enable row level security;
drop policy if exists "admin all" on payment_methods;
create policy "admin all" on payment_methods for all to authenticated using (is_admin()) with check (is_admin());
drop policy if exists "public read" on payment_methods;
create policy "public read" on payment_methods for select to anon, authenticated using (active);
insert into payment_methods (name, kind, icon, color, description, sort) values
  ('Payme / Click (Online)', 'online', 'fa-credit-card', '#3B82F6', 'Plastik karta orqali onlayn to''lov', 1),
  ('Kuryerga naqd pul orqali', 'cash', 'fa-money-bill-wave', '#16A34A', 'Buyurtma yetkazilganda naqd to''lanadi', 2),
  ('Terminal orqali', 'terminal', 'fa-wallet', '#D4A373', 'Yetkazib berish nuqtasida terminal orqali', 3)
on conflict (name) do nothing;

-- 7) Qo'llab-quvvatlash: aloqa sozlamalari va mijoz xabarlari
create table if not exists support_settings (
  id int primary key default 1 check (id = 1),
  phone text, telegram text, instagram text, work_hours text,
  updated_at timestamptz not null default now()
);
alter table support_settings enable row level security;
drop policy if exists "admin all" on support_settings;
create policy "admin all" on support_settings for all to authenticated using (is_admin()) with check (is_admin());
drop policy if exists "public read" on support_settings;
create policy "public read" on support_settings for select to anon, authenticated using (true);

create table if not exists support_messages (
  id bigint generated always as identity primary key,
  tg_user_id bigint not null,
  bot_id bigint,
  name text, phone text, tg_username text,
  kind text not null default 'Izoh' check (kind in ('Izoh', 'Shikoyat')),
  product_id bigint, product_name text,
  message text not null,
  status text not null default 'Yangi' check (status in ('Yangi', 'Ko''rildi', 'Hal qilindi')),
  read boolean not null default false,
  admin_reply text, replied_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists support_messages_user_idx on support_messages (tg_user_id);
create index if not exists support_messages_read_idx on support_messages (read);
alter table support_messages enable row level security;
drop policy if exists "admin all" on support_messages;
create policy "admin all" on support_messages for all to authenticated using (is_admin()) with check (is_admin());
revoke all on support_messages from anon;

-- 8) Bazani yangi holatga keltirish (faqat server, service_role chaqira oladi)
-- Saqlanadi: admin login, asosiy do'kon, botlar, to'lov turlari, aloqa sozlamalari.
create or replace function reset_shop_data() returns void
language plpgsql security definer set search_path = public as $$
begin
  truncate table orders, product_costs, products, categories, locations, banner_settings,
                 promo_codes, customers, support_messages restart identity cascade;
  delete from sellers where not is_main;
  insert into promo_codes (code, percent) values ('MELISSA10', 10);
end $$;
revoke all on function reset_shop_data() from public, anon, authenticated;
grant execute on function reset_shop_data() to service_role;
