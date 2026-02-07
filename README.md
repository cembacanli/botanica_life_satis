# 🏢 Daire Satış Programı - Real Estate Sales Management

Modern ve kolay kullanılır daire satış yönetim sistemi. Next.js, React, TypeScript ve Supabase kullanılarak geliştirilmiştir.

## 🎯 Özellikler

- ✅ **4 Blok (A, B, C, D)** - Farklı daire türleri ve fiyatlandırma
- ✅ **Hızlı Filtreleme** - Blok, kat ve cephe türüne göre filtrele
- ✅ **Responsive Tasarım** - Tüm cihazlarda mükemmel görünüm
- ✅ **Modern UI** - Tailwind CSS ile şık ve temiz arayüz
- ✅ **Supabase İntegrasyonu** - PostgreSQL veritabanı ile güvenli veri yönetimi
- ✅ **API Endpoints** - RESTful API ile kolay veri erişimi

## 📊 Daire Bilgileri

### A ve B Blokları
- **Toplam:** 60 daire (30 daire/blok)
- **Kat:** 10 kat
- **Daire/Kat:** 6 daire (3 ana yol, 3 arka cephe)
- **Tip:** 2+1 (90 m²)
- **Başlangıç Fiyatı:** 4.350.000 TL (1. kat, arka cephe)
- **Fiyat Artışı:** Kat başına 50.000 TL, Ana yol cephesi +50.000 TL

### C ve D Blokları
- **Toplam:** 120 daire (60 daire/blok)
- **Kat:** 10 kat
- **Daire/Kat:** 12 daire (6 ana yol, 6 arka cephe)
- **Tip:** 1+1 (45 m²)
- **Başlangıç Fiyatı:** 2.350.000 TL (1. kat, arka cephe)
- **Fiyat Artışı:** Kat başına 50.000 TL, Ana yol cephesi +50.000 TL

## 🚀 Kurulum

### Gereksinimler
- Node.js 18+
- npm veya yarn
- Supabase Hesabı

### 1. Projeyi Klonlayın
\`\`\`bash
git clone <repository-url>
cd daire-satis-programi
\`\`\`

### 2. Bağımlılıkları Kurun
\`\`\`bash
npm install
\`\`\`

### 3. Supabase Kurulumu

1. [Supabase](https://supabase.com) adresine gidin ve hesap oluşturun
2. Yeni bir proje oluşturun
3. SQL Editor'ü açın ve bu komutu çalıştırın:

\`\`\`sql
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
\`\`\`

4. Proje ayarlarından (Settings > API) kopyalayın:
   - \`NEXT_PUBLIC_SUPABASE_URL\`
   - \`NEXT_PUBLIC_SUPABASE_ANON_KEY\`

### 4. Environment Değişkenlerini Ayarlayın

\`.env.local\` dosyasını oluşturun:

\`\`\`
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
\`\`\`

### 5. Uygulamayı Başlatın

**Geliştirme Modu:**
\`\`\`bash
npm run dev
\`\`\`

**Production İçin:**
\`\`\`bash
npm run build
npm start
\`\`\`

Tarayıcınızda [http://localhost:3000](http://localhost:3000) adresini açın.

## 📡 API Endpoints

### Daireleri Getir
\`\`\`
GET /api/apartments?block=A&floor=1&facade=ana_yol
\`\`\`

**Query Parameters:**
- \`block\` - A, B, C, D
- \`floor\` - 1-10
- \`facade\` - ana_yol, arka_cephe

### Veritabanını İnitialize Et
\`\`\`
GET /api/init
\`\`\`

## 🌐 Deployment

### Vercel'e Deploy Etme

1. GitHub'a push yapın
2. [Vercel](https://vercel.com) adresine gidin
3. Projeyi import edin
4. Environment değişkenlerini ayarlayın
5. Deploy edin!

### Render'e Deploy Etme

1. [Render](https://render.com) adresine gidin
2. Yeni "Web Service" oluşturun
3. GitHub repository'yi bağlayın
4. Build komutu: \`npm run build\`
5. Start komutu: \`npm start\`
6. Environment değişkenlerini ayarlayın
7. Deploy edin!

## 📁 Proje Yapısı

\`\`\`
src/
├── app/
│   ├── api/
│   │   ├── init/route.ts          # Veritabanı initialization
│   │   └── apartments/route.ts    # Daireleri getir API
│   ├── apartments/page.tsx        # Daireler sayfası
│   ├── layout.tsx                 # Root layout
│   ├── page.tsx                   # Ana sayfa
│   └── globals.css                # Global stiller
├── components/
│   └── ApartmentsList.tsx         # Daireler liste komponenti
└── lib/
    ├── supabase.ts                # Supabase client
    └── data-generator.ts          # Daire data oluşturma
\`\`\`

## 🛠️ Kullanılan Teknolojiler

- **Framework:** Next.js 16+
- **Frontend:** React 19+
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Database:** Supabase (PostgreSQL)
- **Deployment:** Vercel, Render

## 📝 Lisans

MIT

## 👨‍💻 Yazar

Your Name - [@yourhandle](https://twitter.com/yourhandle)

---

**Sorular mı? İletişime geçin veya issue açın!** 🚀
