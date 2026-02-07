# Twilio WhatsApp Kurulumu - Adım Adım Rehberi

## 5 Dakikada Twilio WhatsApp'ı Kurun

### 1. Twilio Hesabı Oluşturun (2 dakika)

1. https://www.twilio.com/console adresine gidin
2. "Sign up" butonuna tıklayın
3. Email adresinizi doğrulayın
4. Telefon numaranızı doğrulayın
5. Hesabı oluşturun

### 2. Account Bilgileri Alın (1 dakika)

1. Twilio Console dashboard'a girin: https://www.twilio.com/console
2. Sayfanın sol tarafında "Account" seçeneğini bulun
3. Bu ekranda görünenler:
   - **Account SID**: Başında "AC" ile başlayan uzun kod
   - **Auth Token**: Gizli anahtar (gözle simgesine tıklayarak görebilirsiniz)
4. Her ikisini de kopyalayın

### 3. WhatsApp Sandbox'ı Etkinleştirin (2 dakika)

#### Seçenek 1: Hızlı Kurulum (Önerilen)
1. Console'da "Messaging" → "Try it out" → "Send a WhatsApp message"
2. "Yes, opt in to WhatsApp" butonuna tıklayın
3. Sandbox mesajı "join [CODE]" şeklinde gösterilir
4. Bu kodu WhatsApp'ta sandbox numarasına gönderin

#### Seçenek 2: Manuel Kurulum
1. Console: "Messaging" → "Conversations" → "Manage Services"
2. "Create Messaging Service" butonuna tıklayın
3. Name: "WhatsApp Sandbox"
4. "Create Messaging Service" tıklayın
5. "Phone Numbers" seçeneğine tıklayın
6. Sandbox WhatsApp numarası atanır

### 4. Environment Variables'ı Ayarlayın

Proje kökündeki `.env.local` dosyasını açın ve aşağıdaki değerleri doldurun:

```env
# Step 1: Twilio Console'dan alınan değerler
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_twilio_auth_token_here

# Step 2: WhatsApp Sandbox numarası (değiştirmeyin)
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886

# Step 3: Kendi WhatsApp numaranız (opsiyonel)
# Format: +90 ve ardından 10 haneli numara
# Örnek: +905551234567
TWILIO_WHATSAPP_TO_EXAMPLE=whatsapp:+905XXXXXXXXX
```

### 5. Test Edin

#### Windows'ta Test
1. Terminal'de şu komutu çalıştırın:
   ```bash
   .\test-whatsapp.bat
   ```

#### Mac/Linux'ta Test
```bash
./test-whatsapp.sh
```

#### Manuel Test (cURL)
```bash
curl -X POST http://localhost:3000/api/send-whatsapp \
  -H "Content-Type: application/json" \
  -d '{
    "customerPhone": "905551234567",
    "customerName": "Test",
    "block": "A",
    "apartmentNumber": 1,
    "price": 4500000,
    "saleType": "sold",
    "installmentMonths": 12,
    "monthlyPayment": 405000
  }'
```

### 6. Uygulamada Test Edin

1. http://localhost:3000 adresine gidin
2. Bir blok seçin (A, B, C, D)
3. Bir daire seçin
4. "Satış (✅)" seçeneğini seçin
5. Taksit seçeneği seçin
6. Müşteri bilgilerini doldurun:
   - **Adı**: İsim Soyisim
   - **Telefon**: 05XX XXX XXXX (önemli: başında 0 olmalı)
   - **Email**: email@example.com
7. "Satışı Tamamla" butonuna tıklayın
8. WhatsApp mesajı alın

## Troubleshooting (Sorun Giderme)

### Sorun: "Twilio not configured"

**Çözüm**:
1. `.env.local` dosyası mevcut mu?
2. `TWILIO_ACCOUNT_SID` doldurulmuş mu?
3. `TWILIO_AUTH_TOKEN` doldurulmuş mu?
4. Sunucuyu yeniden başlatın: `npm run dev`

### Sorun: Sandbox Numarası Çalışmıyor

**Çözüm**:
1. https://www.twilio.com/console/sms/whatsapp/learn adresine gidin
2. "join [CODE]" mesajını sandbox numarasına gönderin
3. 10 dakika bekleyin
4. Tekrar deneyin

### Sorun: "Invalid phone number"

**Çözüm**:
- Telefon numarası `05XX XXX XXXX` formatında olmalıdır
- Başındaki 0 çıkarılır, +90 eklenir
- Sonuç: `+905XX XXX XXXX`

### Sorun: Mesaj Göndermiyor ama Hata Yok

**Çözüm**:
1. Twilio Console'da "Message Logs" kontrol edin
2. Telefon numarası sandbox'ta kayıtlı mı?
3. "join [CODE]" mesajını yeniden gönderin

## Twilio Console İnceleme

### Message Logs (Mesaj Geçmişi)

1. Console: https://www.twilio.com/console/sms/whatsapp/conversations
2. Gönderilen mesajları görebilirsiniz
3. Başarılı: Durumu "Sent"
4. Başarısız: Hata kodu ve nedeni görülür

### Logs (API Çağrıları)

1. Console: https://www.twilio.com/console/runtime/logs
2. API çağrılarını izleyebilirsiniz
3. Hata detaylarını görebilirsiniz

## Production İçin (İsteğe Bağlı)

### Twilio WhatsApp Business API

Sandbox sınırlamalarını aşmak için:

1. WhatsApp Business Profile başvurusu yapın
2. Kendi WhatsApp numaranızı kaydedin
3. Kimlik doğrulama yapın
4. `TWILIO_WHATSAPP_FROM=whatsapp:+905XXXXXXXXX` güncelleyin

### Deployment Türleri

**Vercel** (Önerilen):
```bash
npm run build
git push # Vercel otomatik deploy eder
```

**Environment Variables Vercel'de**:
1. Vercel Dashboard → Project Settings
2. Environment Variables seçeneğini açın
3. TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN ekleyin

**Render**:
1. Render.com adresine gidin
2. Environment → Add Private File
3. .env.local dosyasını upload edin

## Fiyatlandırma

### Twilio Ücretsiz Tier

- **İlk Kredi**: 50 USD
- **Sandbox**: Sınırsız test mesajı
- **Ücret**: Sandbox'tan production'a geçişte belirlenecek

### WhatsApp Mesaj Fiyatı (Production)

- **Gelen Mesaj**: Ücretsiz
- **Giden Mesaj**: ~0,002 USD per message
- **Örnek**: 10.000 mesaj = ~20 USD

## Daha Fazla Bilgi

- 📚 [Twilio Documentation](https://www.twilio.com/docs)
- 📚 [WhatsApp API Guide](https://www.twilio.com/docs/whatsapp)
- 💬 [Twilio Support](https://support.twilio.com)
- 🐛 [API Status](https://status.twilio.com)

## Hızlı Kontrol Listesi

- [ ] Twilio hesabı oluşturuldu
- [ ] Account SID kopyalandı
- [ ] Auth Token kopyalandı
- [ ] WhatsApp Sandbox etkinleştirildi
- [ ] `.env.local` dosyası güncellendi
- [ ] Sunucu yeniden başlatıldı (`npm run dev`)
- [ ] Test script çalıştırıldı
- [ ] Uygulamada satış testi yapıldı
- [ ] WhatsApp mesajı alındı
- [ ] ✅ Hazır!

---

**Sorular?** Rehberin sonundaki linklerden destek alabilirsiniz.
