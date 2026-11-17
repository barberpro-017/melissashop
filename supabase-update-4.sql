-- 4-yangilanish. Supabase → SQL Editor → Run. Qayta Run qilish xavfsiz.
-- Avval update-2 va update-3 Run qilingan bo'lishi kerak.

-- 0) Rol yordamchilari (sotuvchi = app_metadata.role 'seller'; boshqalar admin)
create or replace function is_admin() returns boolean language sql stable as
$$ select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'seller' $$;
create or replace function my_seller() returns bigint language sql stable as
$$ select nullif(auth.jwt() -> 'app_metadata' ->> 'seller_id', '')::bigint $$;

-- 1) Sotuvchilar
create table if not exists sellers (
  id bigint generated always as identity primary key,
  name text not null,
  phone text,
  login text unique,
  auth_user_id uuid,
  is_main boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
insert into sellers (name, is_main) select 'Melissa', true where not exists (select 1 from sellers where is_main);
alter table sellers enable row level security;
drop policy if exists "admin all" on sellers;
create policy "admin all" on sellers for all to authenticated using (is_admin()) with check (is_admin());
drop policy if exists "seller self" on sellers;
create policy "seller self" on sellers for select to authenticated using (id = my_seller());
-- Mini app faqat sotuvchi nomini ko'radi (telefon/login emas)
create or replace view sellers_public as select id, name from sellers where active;
grant select on sellers_public to anon, authenticated;

-- 2) Mahsulot: o'lchamlar, sotuvchi, foizli chegirma
alter table products add column if not exists sizes text[] not null default '{}';
alter table products add column if not exists seller_id bigint references sellers(id);
alter table products add column if not exists discount_percent int not null default 0;
alter table products drop constraint if exists products_discount_range;
alter table products add constraint products_discount_range check (discount_percent between 0 and 90);
update products set seller_id = (select id from sellers where is_main limit 1) where seller_id is null;

-- 3) Kategoriya sotuvchiga tegishli
alter table categories add column if not exists seller_id bigint references sellers(id);
update categories set seller_id = (select id from sellers where is_main limit 1) where seller_id is null;
alter table categories drop constraint if exists categories_name_key;
create unique index if not exists categories_name_seller_idx on categories (lower(name), seller_id);

-- 4) Buyurtma
alter table orders add column if not exists location_id bigint;
alter table orders add column if not exists promo_code text;

-- 5) Reklama banneri (bitta qator)
create table if not exists banner_settings (
  id int primary key default 1 check (id = 1),
  badge text, title text, subtitle text, button_text text,
  bg_from text, bg_to text, text_color text, badge_color text,
  image_product_id bigint,
  product_ids bigint[] not null default '{}',
  updated_at timestamptz not null default now()
);

-- 6) Promokodlar (faqat server o'qiydi)
create table if not exists promo_codes (
  id bigint generated always as identity primary key,
  code text not null unique,
  percent int not null check (percent between 1 and 90),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
insert into promo_codes (code, percent) values ('MELISSA10', 10) on conflict (code) do nothing;

-- 7) Mijozlar profili (mini appdagi "Mening profilim")
create table if not exists customers (
  tg_user_id bigint primary key,
  first_name text, last_name text, phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table banner_settings enable row level security;
alter table promo_codes enable row level security;
alter table customers enable row level security;

drop policy if exists "admin all" on banner_settings;
create policy "admin all" on banner_settings for all to authenticated using (is_admin()) with check (is_admin());
drop policy if exists "public read" on banner_settings;
create policy "public read" on banner_settings for select to anon, authenticated using (true);
drop policy if exists "admin all" on promo_codes;
create policy "admin all" on promo_codes for all to authenticated using (is_admin()) with check (is_admin());
drop policy if exists "admin all" on customers;
create policy "admin all" on customers for all to authenticated using (is_admin()) with check (is_admin());
revoke all on promo_codes, customers from anon;

-- 8) Eski "admin all" siyosatlarini rol bilan almashtirish (sotuvchi admin ma'lumotini ko'ra olmasin)
do $$ declare t text; begin
  foreach t in array array['products','orders','locations','categories','product_costs'] loop
    execute format('drop policy if exists "admin all" on %I', t);
    execute format('create policy "admin all" on %I for all to authenticated using (is_admin()) with check (is_admin())', t);
  end loop;
end $$;
drop policy if exists "admin read bots" on bots;
create policy "admin read bots" on bots for select to authenticated using (is_admin());

-- 9) Sotuvchi faqat o'z mahsulotlari bilan ishlaydi
drop policy if exists "seller own" on products;
create policy "seller own" on products for all to authenticated
  using (seller_id = my_seller()) with check (seller_id = my_seller());
drop policy if exists "seller own" on product_costs;
create policy "seller own" on product_costs for all to authenticated
  using (exists (select 1 from products p where p.id = product_id and p.seller_id = my_seller()))
  with check (exists (select 1 from products p where p.id = product_id and p.seller_id = my_seller()));
drop policy if exists "auth read" on categories;
create policy "auth read" on categories for select to authenticated using (true);
drop policy if exists "seller insert" on categories;
create policy "seller insert" on categories for insert to authenticated with check (seller_id = my_seller());
drop policy if exists "seller delete" on categories;
create policy "seller delete" on categories for delete to authenticated using (seller_id = my_seller());
