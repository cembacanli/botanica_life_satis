create table if not exists public.apartments (
  id text primary key,
  block char(1) not null check (block in ('A', 'B', 'C', 'D')),
  floor integer not null,
  number integer not null,
  facade varchar(20) not null check (facade in ('ana_yol', 'arka_cephe')),
  area numeric(10,2) not null,
  type varchar(20) not null,
  price numeric(12,2) not null,
  status varchar(20) not null default 'available' check (status in ('available', 'reserved', 'deposited', 'sold')),
  created_at timestamptz not null default now()
);

create index if not exists idx_apartments_block on public.apartments(block);
create index if not exists idx_apartments_floor on public.apartments(floor);
create index if not exists idx_apartments_facade on public.apartments(facade);
create unique index if not exists idx_apartments_block_number on public.apartments(block, number);
