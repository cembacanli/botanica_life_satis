# Taksit Sistemi ve WhatsApp Entegrasyonu Rehberi

## Genel Bakış

Bu rehber, Daire Satış Programı'nın yeni taksit sistemi ve Twilio WhatsApp entegrasyonu özelliklerini açıklamaktadır.

## 1. Taksit Sistemi (Installment System)

### Özellikler

- **6 Farklı Taksit Seçeneği**: Peşin, 3 ay, 6 ay, 12 ay, 24 ay, 36 ay
- **Otomatik Faiz Hesaplaması**: Her taksit seçeneğine uygun faiz oranı
- **Aylık Ödeme Gösterimi**: Müşteriye görünen aylık ödeme tutarı
- **Detaylı Taksit Özeti**: Anapara, faiz oranı, aylık ödeme, toplam ödeme

### Taksit Seçenekleri ve Faiz Oranları

| Seçenek | Ay | Faiz Oranı | Açıklama |
|---------|-----|-----------|---------|
| Peşin | 1 | %0 | Hemen tam ödeme |
| 3 Ay | 3 | %3 | Kısa vadeli |
| 6 Ay | 6 | %5 | Orta vadeli |
| 12 Ay | 12 | %8 | 1 yıl vade |
| 24 Ay | 24 | %12 | 2 yıl vade |
| 36 Ay | 36 | %15 | 3 yıl vade |

### Hesaplama Formülü

```
Toplam Tutar = Daire Fiyatı × (1 + Faiz Oranı / 100)
Aylık Ödeme = Toplam Tutar / Ay Sayısı
```

**Örnek:**
```
Daire Fiyatı: 4.500.000 TL
Taksit: 12 ay (%8 faiz)
Toplam Tutar: 4.500.000 × 1.08 = 4.860.000 TL
Aylık Ödeme: 4.860.000 / 12 = 405.000 TL
```

### Kullanım Adımları

1. **Daire Seçimi**: Blok sayfasında bir daire seçin
2. **Satış Modal Açılır**: "Satış İşlemi" formu açılır
3. **Satış Türü Seçimi**: "Satış (✅)" seçeneğini seçin
4. **Taksit Seçeneği Görünür**: "📅 Taksit Seçeneği" başlığı altında 6 buton görünür
5. **Taksit Seç**: İstediğiniz taksit seçeneğini tıklayın
6. **Özeti Görüntüle**: "Taksit Özeti" bölümünde hesaplamalar gösterilir
7. **Müşteri Bilgileri**: Ad, telefon, email girin
8. **Satışı Tamamla**: Form gönderilir ve WhatsApp mesajı otomatik gönderilir

## 2. WhatsApp Entegrasyonu (Twilio)

### Özellikler

- **Otomatik Mesaj Gönderimi**: Satış tamamlandığında müşteriye WhatsApp mesajı
- **Taksit Bilgisi Dahil**: Mesajda taksit planı ve aylık ödeme tutarı
- **Kişiselleştirilmiş**: Müşteri adı, daire numarası, blok bilgisi içerir
- **Güvenli API**: Twilio REST API üzerinden şifreleme ile iletilir

### Mesaj Şablonu

```
Merhaba {Müşteri Adı}!

Daire Satış Onayı
📍 Blok {Blok} - Daire No: {Daire Numarası}
💰 Fiyat: {Fiyat}

Satış Türü: {Rezervasyon/Kapora/Satış}

{Taksit bilgisi varsa:}
📅 Taksit: {Ay} Ay
💵 Aylık Ödeme: {Aylık Tutar}
```

### Kurulum

#### Adım 1: Twilio Hesabı Oluşturun

1. [Twilio Console](https://www.twilio.com/console) adresine gidin
2. Ücretsiz hesap oluşturun (50 USD credit)
3. Account SID ve Auth Token alın

#### Adım 2: WhatsApp Sandbox Ayarlayın

1. Twilio Console → Messaging → Try it out → Send a WhatsApp message
2. WhatsApp sandbox kurun
3. Telefon numaranızı sandbox'a ekleyin
4. Test mesajını gönderin

#### Adım 3: .env.local Ayarlayın

```env
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
```

⚠️ **Not**: `TWILIO_WHATSAPP_FROM` varsayılan olarak sandbox numarasıdır. Production için kendi WhatsApp Business numaranızı ekleyin.

#### Adım 4: Test Edin

1. Uygulamada bir satış yapın
2. Telefon numarasını doğru formatta girin: `05XX XXX XXXX`
3. Form gönderildikten sonra WhatsApp mesajı gelsin

### API Route: `/api/send-whatsapp`

**Endpoint**: `POST /api/send-whatsapp`

**Request Body**:
```json
{
  "customerPhone": "905XXXXXXXXX",
  "customerName": "Ahmet Yılmaz",
  "block": "A",
  "apartmentNumber": 5,
  "price": 4500000,
  "saleType": "sold",
  "monthlyPayment": 405000,
  "installmentMonths": 12
}
```

**Response (Success)**:
```json
{
  "success": true,
  "messageSid": "SM1234567890abcdef1234567890abcdef"
}
```

**Response (Twilio Yapılandırılmamış)**:
```json
{
  "message": "Twilio not configured, message skipped",
  "status": 200
}
```

### Hata Yönetimi

- **Twilio Yapılandırılmamış**: Satış kaydedilir, mesaj atlanır (status 200)
- **Geçersiz Telefon Numarası**: Otomatik +90 formatına dönüştürülür
- **Twilio API Hatası**: Konsola logged, satış kaydı devam eder

## 3. Entegrasyon Akışı

```
Müşteri Satış Formu Doldurur
         ↓
  Taksit Seçeneği Seçer (Satış Durumunda)
         ↓
  Satışı Tamamla Butonu
         ↓
  Frontend: handleSubmit Çalışır
         ↓
  1. Taksit Planı Hesaplanır
  2. SaleData Nesnesi Oluşturulur
  3. /api/send-whatsapp POST Çağrısı
  4. localStorage'a Satış Kaydedilir
  5. Daire Status Güncellenir
  6. Modal Kapanır
         ↓
  WhatsApp Mesajı Müşteriye Gelir
```

## 4. Dosya Yapısı

```
src/
├── lib/
│   └── installments.ts                 # Taksit hesaplama fonksiyonları
├── app/
│   ├── api/
│   │   └── send-whatsapp/
│   │       └── route.ts                # WhatsApp API endpoint
│   └── blocks/
│       └── [block]/
│           └── page.tsx                # Satış modal entegrasyonu
└── components/
    └── SalesModal.tsx                  # Taksit UI + WhatsApp çağrısı
```

## 5. Veri Modelleri

### InstallmentPlan Interface

```typescript
interface InstallmentPlan {
  months: number              // Taksit ayı (1-36)
  interestRate: number        // Faiz oranı (%)
  monthlyPayment: number      // Aylık ödeme (TL)
  totalAmount: number         // Toplam ödeme tutarı (TL)
  totalInterest: number       // Toplam faiz (TL)
}
```

### SaleData Interface (Güncellenmiş)

```typescript
export interface SaleData {
  apartmentId: string
  saleType: 'reservation' | 'deposit' | 'sold'
  customerName: string
  customerPhone: string
  customerEmail: string
  paymentAmount?: number
  installmentMonths?: number        // NEW: Taksit ayı
  monthlyPayment?: number           // NEW: Aylık ödeme
  notes?: string
}
```

## 6. İleri Konfigürasyon

### Faiz Oranlarını Özelleştirme

[src/lib/installments.ts](src/lib/installments.ts) dosyasında `INSTALLMENT_OPTIONS` array'ini düzenleyin:

```typescript
export const INSTALLMENT_OPTIONS: InstallmentOption[] = [
  { months: 1, interestRate: 0, description: 'Peşin Ödeme' },
  { months: 3, interestRate: 2, description: '3 Ay Taksit (%2)' },  // Değiştirildi
  // ... diğer seçenekler
]
```

### Production WhatsApp

1. [Twilio](https://www.twilio.com/whatsapp) adresinden WhatsApp Business Profile onayı alın
2. Kendi WhatsApp numaranızı `TWILIO_WHATSAPP_FROM` env variable'a ekleyin
3. `TWILIO_WHATSAPP_FROM` formatı: `whatsapp:+905XXXXXXXXX`

### Mesaj Şablonunu Özelleştirme

[src/app/api/send-whatsapp/route.ts](src/app/api/send-whatsapp/route.ts) dosyasında `buildWhatsAppMessage()` fonksiyonunu düzenleyin.

## 7. Sorun Giderme

### "Twilio not configured" Mesajı

**Problem**: Twilio yapılandırılmamış, mesaj göndermiyor.

**Çözüm**: 
1. `.env.local` dosyasını kontrol edin
2. `TWILIO_ACCOUNT_SID` ve `TWILIO_AUTH_TOKEN` doldurulmuş mu?
3. Dev sunucusunu yeniden başlatın: `npm run dev`

### Telefon Numarası Hataları

**Problem**: "Geçersiz telefon numarası" hatası.

**Çözüm**:
1. Telefon numarasını `05XX XXX XXXX` formatında girin
2. Başındaki `0` otomatik silinir ve `+90` eklenir
3. Sonuç: `+905XX XXX XXXX` (Twilio format)

### WhatsApp Mesajı Gelmiyor

**Sorun Adımları**:
1. Twilio console'da mesaj geçmişini kontrol edin
2. Phone Number Verification yapıldı mı?
3. Sandbox modu aktif mi?
4. Sayfa konsolu (F12) hata mesajlarını kontrol edin

## 8. Test Senaryoları

### Test 1: Temel Taksit Seçimi

1. Blok A → Daire seçin
2. "Satış (✅)" seçeneğini seçin
3. Farklı taksit seçeneklerini tıklayın
4. Özet hesaplamaları doğrulayın

### Test 2: Satış Kaydı ve Mesaj

1. Müşteri bilgilerini doldurun
2. Telefon: `05XXXXXXXXX`
3. Satışı Tamamla
4. Twilio Console'da mesajı kontrol edin

### Test 3: localStorage Doğrulaması

1. DevTools (F12) → Application → localStorage
2. `salesRecords` key'ini kontrol edin
3. `installmentMonths` ve `monthlyPayment` var mı?

## 9. Türkçe Rehber Özeti

### Müşteri Perspektifi
- Daire seç → Satış tür seç → Taksit seç → Bilgiler doldur → Gönder → WhatsApp mesajı al

### İşletmeci Perspektifi
- Raporlarda taksit bilgisi görüntülenebilir
- localStorage'da tam satış detayları saklanır
- Production için Supabase'e migrate edilebilir

## 10. Lisans ve Ek Bilgiler

- **Twilio Free Tier**: 50 USD credit
- **WhatsApp Sandbox**: Sınırsız test mesajı
- **API Documentation**: [Twilio WhatsApp API](https://www.twilio.com/docs/whatsapp)

---

**Son Güncelleme**: 2026-01-27
**Versiyon**: 1.0.0
