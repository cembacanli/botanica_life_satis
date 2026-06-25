create table if not exists public.insulation_procurement_projects (
  id uuid primary key default gen_random_uuid(),
  project_name text not null,
  calculations jsonb not null,
  username text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_insulation_procurement_projects_updated_at
  on public.insulation_procurement_projects (updated_at desc);
