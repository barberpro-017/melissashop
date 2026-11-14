-- Supabase → SQL Editor ga qo'yib, Run bosing

create table products (
  id bigint generated always as identity primary key,
  name text not null,
  category text not null default 'Umumiy',
  price numeric not null,
  image_url text,
  created_at timestamptz not null default now()
);

create table orders (
  id bigint generated always as identity (start with 100) primary key,
  customer text not null,
  product text not null,
  size text,
  amount numeric not null,
  status text not null default 'Kutilmoqda'
    check (status in ('Kutilmoqda','Yetkazilmoqda','Bajarildi','Bekor qilindi')),
  created_at timestamptz not null default now()
);

create table locations (
  id bigint generated always as identity primary key,
  name text not null,
  address text not null,
  hours text not null,
  created_at timestamptz not null default now()
);

alter table products  enable row level security;
alter table orders    enable row level security;
alter table locations enable row level security;

-- Admin (login qilgan foydalanuvchi) hamma narsani boshqaradi
create policy "admin all" on products  for all to authenticated using (true) with check (true);
create policy "admin all" on orders    for all to authenticated using (true) with check (true);
create policy "admin all" on locations for all to authenticated using (true) with check (true);

-- Mini app (keyinroq) mahsulot va filiallarni o'qiy oladi
create policy "public read" on products  for select to anon using (true);
create policy "public read" on locations for select to anon using (true);
