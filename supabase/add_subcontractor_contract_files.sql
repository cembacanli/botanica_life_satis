-- Taşeron sözleşmesi yükleme özelliği için yeni kolonların eklenmesi
-- Bu betiği Supabase SQL Editor'da çalıştırabilirsiniz.

alter table public.subcontractors 
  add column if not exists contract_file_url text,
  add column if not exists contract_file_name text;
