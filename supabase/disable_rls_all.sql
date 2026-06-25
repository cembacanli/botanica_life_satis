-- Veritabanı tablolarında RLS (Satır Düzeyinde Güvenlik) kapatma betiği
-- Bu betiği Supabase SQL Editor'da çalıştırarak tablolar üzerindeki kısıtlamaları kaldırabilir
-- ve göç (migration) işlemini başarıyla tamamlayabiliriz.

alter table public.apartments disable row level security;
alter table public.sales disable row level security;
alter table public.sale_details disable row level security;
