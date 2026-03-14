create extension if not exists pgcrypto;

create table if not exists public.construction_cost_scenarios (
  id uuid primary key default gen_random_uuid(),
  scenario_name text not null,
  inputs jsonb not null,
  blocks jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_construction_cost_scenarios_created_at
  on public.construction_cost_scenarios (created_at desc);
