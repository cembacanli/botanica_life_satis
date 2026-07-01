-- Hakediş dışı taşeron ödemeleri için tablo.
-- Supabase SQL Editor'da bir kez çalıştırın.

create extension if not exists pgcrypto;

create table if not exists public.subcontractor_payments (
  id uuid primary key default gen_random_uuid(),
  subcontractor_id uuid not null references public.subcontractors(id) on delete cascade,
  subcontractor_name text not null,
  payment_date date not null,
  amount numeric(20,2) not null check (amount > 0),
  payment_method text default '',
  note text default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_subcontractor_payments_subcontractor_id
  on public.subcontractor_payments(subcontractor_id);

create index if not exists idx_subcontractor_payments_payment_date
  on public.subcontractor_payments(payment_date desc);

alter table public.subcontractor_payments disable row level security;
