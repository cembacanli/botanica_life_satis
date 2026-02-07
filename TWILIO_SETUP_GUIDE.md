# 📱 Twilio WhatsApp Kurulum Rehberi

## 🎯 Amaç
WhatsApp üzerinden müşterilere satış onayı ve iptal bildirimleri göndermek.

---

## 📋 Gerekli Bilgiler

WhatsApp mesajları göndermek için 3 bilgi lazım:

1. **TWILIO_ACCOUNT_SID** - Twilio hesap numarası
2. **TWILIO_AUTH_TOKEN** - Twilio şifresi
3. **TWILIO_WHATSAPP_FROM** - Mesaj göndereceğimiz WhatsApp numarası

---

## 🚀 Adım 1: Twilio Hesap Oluştur

1. https://www.twilio.com/console adresine git
2. Hesap oluştur veya giriş yap
3. "Account SID" ve "Auth Token" kopyala

**Nerede bulunur:**
```
Twilio Console
└── Account Info (sol üstte)
    ├── Account SID (Kopyala)
    └── Auth Token (Kopyala)
```

---

## 🎛️ Adım 2: WhatsApp Sandbox Aç

1. https://www.twilio.com/console/sms/whatsapp/sandbox adresine git
2. **"WhatsApp Sandbox"** sekmesine tıkla
3. Sandbox'ı etkinleştir
4. Gelen kodu WhatsApp'a gönder

**Twilio tarafından bir WhatsApp numarası verilecek:**
```
Twilio WhatsApp From: +1415 523 8886 (örnek)
Kopyala: whatsapp:+14155238886
```

---

## 🔧 Adım 3: .env.local Dosyasını Güncelle

Dosya: `C:\Users\CEM\Desktop\YENI_SATIS_PROGRAMI\.env.local`

Aşağıdaki değerleri güncelleyeceğiz:

```env
# Twilio WhatsApp Configuration
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
```

### Örnek Doldurma:

```env
# Twilio Sandbox Bilgileri
TWILIO_ACCOUNT_SID=ACa1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
TWILIO_AUTH_TOKEN=abcd1234efgh5678ijkl9012mnop3456
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
```

---

## 📝 Adım 4: Müşteri Numarasını Hazırla

WhatsApp mesajları göndermek için müşteri numarası gerekir:

**Format:** `+90XXXXXXXXXX` (Türkiye için)

Örnek:
- ❌ Yanlış: `05551234567`
- ✅ Doğru: `+905551234567`

**Sistem otomatik dönüştürür:**
- "05551234567" → "+905551234567" ✓

---

## 🧪 Test Etme

### 1. Satış Yap
1. http://localhost:3000 açı
2. Login: `cem` / `2127030cem`
3. Herhangi bir bloğa tıkla
4. Müsait dairenin "Satış Yap" butonuna tıkla
5. Satış Türü: "Kapora" seç
6. Müşteri Telefonu: `+905551234567` gir (kendi numarandan test et)
7. "Satışı Tamamla" butonuna tıkla

### 2. WhatsApp Mesajını Kontrol Et
- Twilio Sandbox'a eklenmiş numaraya WhatsApp gelecek
- Mesaj: "🎉 Daire Satış Onayı"

### 3. İptal Testi
1. Aynı dairenin butonuna tekrar tıkla
2. "İptal Et" butonuna tıkla (2x)
3. İptal WhatsApp'ı gelecek: "⚠️ Satış İptali Bildirimi"

---

## 💰 Twilio Fiyatlandırması

- **WhatsApp Mesajı:** ~₺0.50 - ₺2.00 TL / mesaj (konum/duruma göre değişir)
- **Minimum Kredi:** $5 - $20 (credits için)
- **Ücretsiz Deneme:** 15 gün ücretsiz kredi

**Türkiye'ye WhatsApp Gönderme:**
- Sandbox mode: Ücretsiz (test için)
- Production mode: Ücretli

---

## 🔐 Güvenlik Not

⚠️ **Auth Token'ı asla GitHub'a commit etme!**

`.gitignore` zaten konfigüre edilmiş, ama kontrol et:

```
.env.local (✅ ignored)
```

---

## 🐛 Sorun Giderme

### "Twilio credentials not configured"
**Çözüm:** `.env.local` dosyasında tüm 3 değer var mı kontrol et

### "Unable to send WhatsApp message"
**Çözüm:** 
- Numaranın Sandbox'a eklenmiş olması gerekir
- Kredi yeterli mi kontrol et
- Network bağlantısı çalışıyor mu

### "Invalid phone number format"
**Çözüm:** Numarayı `+90XXXXXXXXXX` formatında gir

---

## 📚 Kaynak Linkler

- **Twilio Console:** https://www.twilio.com/console
- **WhatsApp Sandbox:** https://www.twilio.com/console/sms/whatsapp/sandbox
- **API Docs:** https://www.twilio.com/docs/whatsapp
- **Pricing:** https://www.twilio.com/en/pricing

---

## ✅ Kontrol Listesi

- [ ] Twilio hesabı oluşturdum
- [ ] Account SID kopyaladım
- [ ] Auth Token kopyaladım
- [ ] WhatsApp Sandbox'ı etkinleştirdim
- [ ] TWILIO_WHATSAPP_FROM kopyaladım
- [ ] .env.local dosyasını güncelledim
- [ ] Dev server'ı restart ettim
- [ ] Test mesajı gönderdim ✓

---

**Twilio Setup: ✅ HAZIR**

Soruların varsa sor! 🚀
