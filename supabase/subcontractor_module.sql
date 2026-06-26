-- Tasaron takip ve hakedis modulu icin Supabase tablo kurulumu
-- Bu scripti Supabase SQL Editor'da calistirin.

create extension if not exists pgcrypto;

create table if not exists public.subcontractors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  work_scope text not null,
  contract_date date,
  work_start_date date,
  work_duration_days integer,
  contract_amount numeric(14,2),
  contract_items jsonb not null default '[]'::jsonb,
  payment_schedule jsonb not null default '[]'::jsonb,
  barter_items jsonb not null default '[]'::jsonb,
  phone text default '',
  note text default '',
  created_at timestamptz not null default now()
);

alter table public.subcontractors
  add column if not exists contract_date date,
  add column if not exists work_start_date date,
  add column if not exists work_duration_days integer,
  add column if not exists contract_amount numeric(14,2),
  add column if not exists contract_items jsonb not null default '[]'::jsonb,
  add column if not exists payment_schedule jsonb not null default '[]'::jsonb,
  add column if not exists barter_items jsonb not null default '[]'::jsonb;

alter table public.subcontractors
  alter column contract_amount type numeric(14,2)
  using contract_amount::numeric(14,2);

update public.subcontractors
set contract_date = coalesce(contract_date, current_date),
    work_start_date = coalesce(work_start_date, contract_date, current_date),
    work_duration_days = coalesce(work_duration_days, 1),
    contract_amount = coalesce(contract_amount, 1);

alter table public.subcontractors
  alter column contract_date set not null,
  alter column work_start_date set not null,
  alter column work_duration_days set not null,
  alter column contract_amount set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'subcontractors_work_duration_days_positive'
  ) then
    alter table public.subcontractors
      add constraint subcontractors_work_duration_days_positive check (work_duration_days > 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'subcontractors_contract_amount_positive'
  ) then
    alter table public.subcontractors
      add constraint subcontractors_contract_amount_positive check (contract_amount > 0);
  end if;
end $$;

create table if not exists public.subcontractor_claims (
  id uuid primary key default gen_random_uuid(),
  subcontractor_id uuid not null references public.subcontractors(id) on delete cascade,
  subcontractor_name text not null,
  work_item text not null,
  contract_amount bigint not null check (contract_amount > 0),
  progress_percent numeric(5,2) not null check (progress_percent >= 0 and progress_percent <= 100),
  completed_amount bigint not null default 0,
  previous_paid_amount bigint not null default 0 check (previous_paid_amount >= 0),
  current_claim_amount bigint not null check (current_claim_amount > 0),
  deduction_amount bigint not null default 0 check (deduction_amount >= 0),
  net_payable_amount bigint not null default 0 check (net_payable_amount >= 0),
  claim_date date not null,
  status text not null check (status in ('taslak', 'onaylandi', 'odendi')),
  note text default '',
  created_at timestamptz not null default now()
);

create table if not exists public.subcontractor_payments (
  id uuid primary key default gen_random_uuid(),
  subcontractor_id uuid not null references public.subcontractors(id) on delete cascade,
  subcontractor_name text not null,
  payment_date date not null,
  amount bigint not null check (amount > 0),
  payment_method text default '',
  note text default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_subcontractors_created_at on public.subcontractors(created_at desc);
create index if not exists idx_claims_subcontractor_id on public.subcontractor_claims(subcontractor_id);
create index if not exists idx_claims_claim_date on public.subcontractor_claims(claim_date desc);
create index if not exists idx_subcontractor_payments_subcontractor_id on public.subcontractor_payments(subcontractor_id);
create index if not exists idx_subcontractor_payments_payment_date on public.subcontractor_payments(payment_date desc);

alter table public.subcontractors disable row level security;
alter table public.subcontractor_claims disable row level security;
alter table public.subcontractor_payments disable row level security;
