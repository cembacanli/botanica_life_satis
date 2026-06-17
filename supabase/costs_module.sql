-- Maliyet modulu icin Supabase tablo kurulumu / guncellemesi
-- Bu scripti Supabase SQL Editor'da calistirin.

create extension if not exists pgcrypto;

create table if not exists public.costs (
  id uuid primary key default gen_random_uuid(),
  item_name text not null,
  category text not null,
  amount numeric(12,2) not null,
  date date not null,
  note text default '',
  created_at timestamptz not null default now()
);

alter table public.costs
  add column if not exists item_name text,
  add column if not exists category text,
  add column if not exists amount numeric(12,2),
  add column if not exists date date,
  add column if not exists note text default '',
  add column if not exists created_at timestamptz default now();

update public.costs
set note = coalesce(note, ''),
    created_at = coalesce(created_at, now())
where note is null or created_at is null;

alter table public.costs
  alter column amount type numeric(12,2) using round(amount::numeric, 2),
  alter column note set default '',
  alter column created_at set default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'costs_amount_positive'
  ) then
    alter table public.costs
      add constraint costs_amount_positive check (amount > 0);
  end if;
end $$;

create index if not exists idx_costs_date on public.costs(date desc);
create index if not exists idx_costs_created_at on public.costs(created_at desc);
