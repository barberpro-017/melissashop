-- 2-yangilanish. Supabase → SQL Editor → Run.
-- Mavjud bazada ham, yangi bazada ham ishlaydi (qayta Run qilish xavfsiz).

-- 1) Demo ma'lumotlarni tozalash
delete from orders    where customer in ('Dilnoza Sobirova','Zarina Karimova','Madina Aliyeva');
delete from products  where name in ('Nafis shoyi ko''ylak','Klassik oq kostyum','Pushti kuzgi trench');
delete from locations where name in ('Melissa Flagship — Toshkent','Melissa Showroom — Samarkand');

-- 2) Mahsulot rasmlari (4 tagacha)
alter table products add column if not exists images text[] not null default '{}';
alter table products drop column if exists image_url;
alter table products drop constraint if exists products_images_max4;
alter table products add constraint products_images_max4 check (cardinality(images) <= 4);

-- 3) Buyurtma tafsilotlari
alter table orders add column if not exists phone text;
alter table orders add column if not exists address text;
alter table orders add column if not exists note text;

-- 4) Kategoriyalar
create table if not exists categories (
  id bigint generated always as identity primary key,
  name text not null unique,
  created_at timestamptz not null default now()
);
alter table categories enable row level security;
drop policy if exists "admin all" on categories;
create policy "admin all" on categories for all to authenticated using (true) with check (true);
drop policy if exists "public read" on categories;
create policy "public read" on categories for select to anon using (true);

-- 5) Rasmlar uchun Storage
insert into storage.buckets (id, name, public) values ('product-images', 'product-images', true)
  on conflict (id) do nothing;
drop policy if exists "product images read" on storage.objects;
create policy "product images read" on storage.objects for select using (bucket_id = 'product-images');
drop policy if exists "product images upload" on storage.objects;
create policy "product images upload" on storage.objects for insert to authenticated with check (bucket_id = 'product-images');
drop policy if exists "product images delete" on storage.objects;
create policy "product images delete" on storage.objects for delete to authenticated using (bucket_id = 'product-images');
