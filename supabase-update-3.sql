-- 3-yangilanish. Supabase → SQL Editor → Run. Qayta Run qilish xavfsiz.

-- 1) Kelish narxi ALOHIDA jadvalda: mini app (anon) uni hech qachon ko'ra olmaydi
create table if not exists product_costs (
  product_id bigint primary key references products(id) on delete cascade,
  cost_price numeric not null default 0
);
alter table product_costs enable row level security;
drop policy if exists "admin all" on product_costs;
create policy "admin all" on product_costs for all to authenticated using (true) with check (true);
revoke all on product_costs from anon;

-- 2) Mahsulot tavsifi (mini appda ko'rinadi)
alter table products add column if not exists description text;

-- 3) Buyurtma tafsilotlari (mini app serveri orqali yoziladi)
alter table orders add column if not exists items jsonb not null default '[]';
alter table orders add column if not exists cost numeric not null default 0;
alter table orders add column if not exists discount numeric not null default 0;
alter table orders add column if not exists payment text;
alter table orders add column if not exists tg_user_id bigint;
alter table orders add column if not exists tg_username text;
create index if not exists orders_tg_user_idx on orders (tg_user_id);
