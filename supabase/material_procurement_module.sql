create extension if not exists pgcrypto;

create table if not exists public.material_procurement_projects (
  id uuid primary key default gen_random_uuid(),
  project_name text not null,
  project jsonb not null,
  mortar jsonb not null,
  materials jsonb not null,
  walls jsonb not null,
  username text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_material_procurement_projects_updated_at
  on public.material_procurement_projects (updated_at desc);
