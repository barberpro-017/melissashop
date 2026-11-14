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

-- Namunaviy ma'lumotlar (Gemini dizaynidagidek)
insert into products (name, category, price, image_url) values
 ('Nafis shoyi ko''ylak', 'Ko''ylak', 480000, 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=300'),
 ('Klassik oq kostyum', 'Kostyum', 750000, 'https://images.unsplash.com/photo-1550639525-c97d455acf70?w=300'),
 ('Pushti kuzgi trench', 'Palto', 920000, 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=300');

insert into orders (customer, product, size, amount, status) values
 ('Dilnoza Sobirova', 'Pushti kuzgi trench', 'L', 920000, 'Bajarildi'),
 ('Zarina Karimova', 'Klassik oq kostyum', 'M', 750000, 'Yetkazilmoqda'),
 ('Madina Aliyeva', 'Nafis shoyi ko''ylak', 'S', 480000, 'Kutilmoqda');

insert into locations (name, address, hours) values
 ('Melissa Flagship — Toshkent', 'Amir Temur ko''chasi, 15-uy (Tashkent City yaqinida)', '09:00 - 21:00'),
 ('Melissa Showroom — Samarkand', 'Universitet xiyoboni, 4-uy', '10:00 - 20:00');
