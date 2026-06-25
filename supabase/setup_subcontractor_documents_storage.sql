-- Supabase Depolama (Storage) Kurulumu ve RLS Politikaları
-- Bu betiği Supabase SQL Editor'da çalıştırarak 'subcontractor-documents' klasörünü oluşturabilir
-- ve dosya yükleme/indirme için gerekli yetkileri (RLS) tanımlayabilirsiniz.

-- 1. subcontractor-documents adında bir public storage bucket (depolama alanı) oluştur
insert into storage.buckets (id, name, public)
values ('subcontractor-documents', 'subcontractor-documents', true)
on conflict (id) do nothing;

-- 2. subcontractor-documents bucket'ı için eski politikaları temizle (varsa hata almamak için)
drop policy if exists "Subcontractor Documents Public Read" on storage.objects;
drop policy if exists "Subcontractor Documents Public Insert" on storage.objects;
drop policy if exists "Subcontractor Documents Public Update" on storage.objects;
drop policy if exists "Subcontractor Documents Public Delete" on storage.objects;

-- 3. subcontractor-documents bucket'ı için yeni politikalar tanımla

-- Dosyaları okuma (Public SELECT) izni: Herkes yüklenen dosyaları görebilsin
create policy "Subcontractor Documents Public Read"
on storage.objects for select
using ( bucket_id = 'subcontractor-documents' );

-- Dosya yükleme (Public INSERT) izni: Anonim kullanıcılar da dahil herkes dosya yükleyebilsin
create policy "Subcontractor Documents Public Insert"
on storage.objects for insert
with check ( bucket_id = 'subcontractor-documents' );

-- Dosya güncelleme (Public UPDATE) izni: Dosya üzerine yazma veya güncelleme izni
create policy "Subcontractor Documents Public Update"
on storage.objects for update
using ( bucket_id = 'subcontractor-documents' );

-- Dosya silme (Public DELETE) izni: Dosya kaldırma izni
create policy "Subcontractor Documents Public Delete"
on storage.objects for delete
using ( bucket_id = 'subcontractor-documents' );
