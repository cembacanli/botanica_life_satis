# 🚀 Hızlı Başlangıç Rehberi

## Daire Satış Programı - 5 Dakikada Çalıştırmak

### Adım 1: Terminal'i Açın
```bash
cd C:\Users\CEM\Desktop\YENI_SATIS_PROGRAMI
```

### Adım 2: Bağımlılıkları Kurun (İlk Defada)
```bash
npm install
```

### Adım 3: Sunucuyu Başlatın
```bash
npm run dev
```

### Adım 4: Tarayıcıda Açın
- **URL:** http://localhost:3000
- Veya tarayıcınıza http://localhost:3000 yazın

### 🎉 Hepsi Bu Kadar!

Artık aşağıdakileri yapabilirsiniz:
- ✅ Tüm 360 dairenin listesini görebilirsiniz
- ✅ Blok, kat ve cepheye göre filtreleyebilirsiniz
- ✅ Her dairenin fiyatını ve özelliklerini görebilirsiniz

---

## 📱 Özellikler

### Daire Türleri
| Blok | Tip | Alan | Kat | Fiyat Aralığı |
|------|-----|------|-----|----------------|
| A, B | 2+1 | 90m² | 1-10 | 4.35M - 4.80M TL |
| C, D | 1+1 | 45m² | 1-10 | 2.35M - 2.80M TL |

### Filtreleme Seçenekleri
- **Blok:** A, B, C, D
- **Kat:** 1-10
- **Cephe Türü:** Ana Yol, Arka Cephe

---

## 🛠️ Kullanışlı Komutlar

```bash
# Geliştirme modunda çalıştır
npm run dev

# Production build oluştur
npm run build

# Production sunucusunu başlat
npm start

# Linter çalıştır
npm run lint
```

---

## 💡 İpuçları

### 1. Sunucuyu Durdur
Terminal'de `CTRL + C` tuşlarına basın

### 2. Portun Değiştirilmesi
Eğer 3000 portu kullanılıyorsa:
```bash
npm run dev -- -p 3001
```

### 3. Üretim İçin Deploy Etme
```bash
npm run build
npm start
```

---

## 🐛 Sık Karşılaşılan Sorunlar

### Sorun: "Port 3000 zaten kullanılıyor"
**Çözüm:** 
```bash
npm run dev -- -p 3001
```

### Sorun: "Module not found"
**Çözüm:** 
```bash
npm install
```

### Sorun: Sunucu 0.0.0.0 adresinde çalışmıyor
**Çözüm:** Terminal'i yeniden başlatın veya port değiştirin

---

## 📚 Öğrenme Kaynakları

- [Next.js Dokümantasyon](https://nextjs.org/docs)
- [React Dokümantasyon](https://react.dev)
- [Tailwind CSS](https://tailwindcss.com)
- [TypeScript](https://www.typescriptlang.org)

---

## ❓ Yardıma mı ihtiyacınız var?

1. README.md dosyasını kontrol edin
2. `.github/copilot-instructions.md` dosyasına bakın
3. Terminal'de hata mesajını okuyun

---

**Sürüm:** 1.0.0  
**Son Güncelleme:** 27 Ocak 2026

Happy coding! 🎉
