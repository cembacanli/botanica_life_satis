# Daire Satış Programı - Proje Konfigürasyonu

## Proje Bilgileri
- **Adı:** Daire Satış Programı (Real Estate Sales Management)
- **Teknoloji:** Next.js 16+ / React 19+ / TypeScript / Tailwind CSS
- **Veritabanı:** In-memory (production için Supabase)
- **Başlangıç:** 27 Ocak 2026

## Proje Özellikleri

### 🏗️ Blok Yapısı
- **A ve B Blokları:** 60 daire (2+1, 90m²)
- **C ve D Blokları:** 120 daire (1+1, 45m²)
- **Toplam:** 360 daire

### 💰 Fiyatlandırma
- **A/B Blokları:** 4.350.000 TL ila 4.800.000 TL (kat+cephe faktörü)
- **C/D Blokları:** 2.350.000 TL ila 2.800.000 TL (kat+cephe faktörü)
- Kat başına +50.000 TL, Ana yol cephesi +50.000 TL

### 📊 Özellikler
- Hızlı filtreleme (Blok, Kat, Cephe)
- Responsive tasarım
- API endpoints
- TypeScript type safety

## Kurulum Adımları

### 1. Bağımlılıkları Kurun
```bash
npm install
```

### 2. Geliştirme Sunucusunu Başlatın
```bash
npm run dev
```

### 3. Tarayıcıda Açın
```
http://localhost:3000
```

## Komutlar

| Komut | Açıklama |
|-------|----------|
| `npm run dev` | Geliştirme sunucusu başlat |
| `npm run build` | Production build oluştur |
| `npm start` | Production sunucusu başlat |
| `npm run lint` | Lint kontrol et |

## API Endpoints

### GET /api/apartments
Filtrelenmiş daireleri getir

**Query Parameters:**
- `block` - A, B, C, D
- `floor` - 1-10
- `facade` - ana_yol, arka_cephe

**Örnek:**
```
GET /api/apartments?block=A&floor=5&facade=ana_yol
```

### GET /api/init
Veritabanını initialize et

## Dosya Yapısı

```
src/
├── app/
│   ├── api/
│   │   ├── init/route.ts           # DB init API
│   │   └── apartments/route.ts     # Daireler API
│   ├── apartments/page.tsx         # Daireler sayfası
│   ├── layout.tsx                  # Root layout
│   ├── page.tsx                    # Ana sayfa
│   └── globals.css                 # Global stiller
├── components/
│   └── ApartmentsList.tsx          # Daireler listesi
└── lib/
    ├── supabase.ts                 # Supabase client
    └── data-generator.ts           # Veri oluşturma
```

## Deployment

### Vercel
1. GitHub repo push yapın
2. Vercel'e connect edin
3. Environment variables ayarlayın
4. Deploy!

### Render
1. Render adresine gidin
2. Web Service oluşturun
3. GitHub connect edin
4. Build: `npm run build`
5. Start: `npm start`

## Supabase Kurulumu (İsteğe Bağlı)

Production için Supabase kullanmak istiyorsanız:

1. [Supabase](https://supabase.com) adresine gidin
2. Yeni proje oluşturun
3. SQL çalıştırın:

```sql
CREATE TABLE apartments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  block CHAR(1) NOT NULL,
  floor INTEGER NOT NULL,
  number INTEGER NOT NULL,
  facade VARCHAR(20) NOT NULL,
  area DECIMAL(5,2) NOT NULL,
  type VARCHAR(10) NOT NULL,
  price DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_apartments_block ON apartments(block);
CREATE INDEX idx_apartments_floor ON apartments(floor);
CREATE INDEX idx_apartments_facade ON apartments(facade);
```

4. .env.local dosyasını güncelleyin:

```
NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
```

## Teknik Notlar

- Proje TypeScript ile yazılmıştır (strict mode)
- Tailwind CSS ile stillenmiştir
- Server-side rendering (SSR) ve Static Generation (SSG) kullanır
- Turbopack ile hızlı build
- Environment variables ile konfigüre edilir

## Lisans

MIT

## İletişim

Sorular veya öneriler için issue açın veya contact form kullanın.
