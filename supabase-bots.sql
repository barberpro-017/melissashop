-- Bot nazorati uchun. supabase.sql dan KEYIN, SQL Editor'da Run qiling.

create table bots (
  bot_id bigint primary key,
  username text not null,
  name text not null,
  mini_app_url text not null,
  created_at timestamptz not null default now()
);

-- Token alohida jadvalda: brauzerdan (admin ham) o'qib bo'lmaydi, faqat server (service_role)
create table bot_secrets (
  bot_id bigint primary key references bots(bot_id) on delete cascade,
  token text not null,
  webhook_secret text not null unique
);

alter table bots enable row level security;
alter table bot_secrets enable row level security;

create policy "admin read bots" on bots for select to authenticated using (true);
-- bot_secrets uchun policy yo'q → anon va authenticated hech narsa ko'ra olmaydi

revoke all on bot_secrets from anon, authenticated;
