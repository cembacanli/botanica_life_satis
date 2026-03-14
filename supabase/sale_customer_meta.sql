create extension if not exists pgcrypto;

create table if not exists public.sale_customer_meta (
  id uuid primary key default gen_random_uuid(),
  apartment_id uuid not null unique,
  customer_address text,
  customer_identity_no text,
  updated_at timestamptz not null default now()
);

create index if not exists idx_sale_customer_meta_apartment_id
  on public.sale_customer_meta (apartment_id);
