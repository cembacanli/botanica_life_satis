# 📖 Daire Satış Programı - Kullanım Rehberi

## 🎯 Genel Bakış

Bu sistem, 360 dairelik bir konut projesinin satışlarını yönetmek için tasarlanmıştır. 4 blok (A, B, C, D) ve 10 katın dairelerini izleyebilir, müşterileri yönetebilir ve satış işlemlerini kaydedebilirsiniz.

---

## 🏠 Ana Sayfadan Başlayalım

### Dashboard Ekranı
Uygulamayı açtığınızda **Dashboard** sayfasını görürsünüz. Bu sayfada:

- **4 Blok Kartı**: Her blok bir buton olarak gösterilir
- **İstatistikler**: Toplam daire, blok ve kat sayıları
- **Raporlar Butonu**: Sağ üst köşede satış raporlarını görmek için

### Blok Seçme

Herhangi bir blok kartına tıklayarak o bloğa girebilirsiniz:

```
A Blok → 60 daire, 2+1, 90 m²
B Blok → 60 daire, 2+1, 90 m²
C Blok → 60 daire, 1+1, 45 m²
D Blok → 60 daire, 1+1, 45 m²
```

---

## 🏢 Blok İçinde Daireleri Görüntüleme

### Blok Sayfası

Blok kartına tıkladıktan sonra:

1. **İstatistikler**: O blokta kaç daire müsait, kaç satıldı vs görebilirsiniz
   - 🟢 Müsait
   - 🔵 Rezerve
   - 🟡 Kapora
   - 🔴 Satıldı

2. **Kata Göre Filtrele**: 
   - Tüm daireleri görmek için "Tümü" butonuna basın
   - Belirli bir katı görmek için kat butonlarına basın

3. **Daire Kartları**: Her daire aşağıdaki bilgilerle gösterilir
   - Daire numarası
   - Kat
   - Daire tipi (2+1 veya 1+1)
   - Alan (m²)
   - Cephe türü (Ana Yol veya Arka)
   - Fiyat (TL)
   - Durumu
   - Satış yapılan müşteri bilgileri (varsa)

---

## 💰 Satış İşlemi Yapmak

### Satış Modalını Açma

Herhangi bir dairenin "Satış Yap" butonuna tıklayarak satış modalını açabilirsiniz.

**Not**: Satıldı durumundaki daireler için bu buton devre dışı bırakılmıştır.

### Satış Türü Seçme

Modalda 3 satış türü vardır:

#### 1️⃣ **Rezervasyon** (📅)
- Müşteri dairenin ayrılmasını ister
- Henüz ödeme yapılmamış
- Daire "Rezerve" durumuna geçer
- Amaç: Müşteriye zaman kazandırmak

#### 2️⃣ **Kapora** (💰)
- Müşteri %20 kapora yatırır
- Satış resmi olarak başlar
- Daire "Kapora" durumuna geçer
- Tipik kapora: Fiyatın %20'si (sistem tarafından hesaplanır)

#### 3️⃣ **Satış Tamamı** (✅)
- Tam satış ve sözleşme imzalanır
- Daire "Satıldı" durumuna geçer
- Müşteri tam miktarı ödemiştir

### Müşteri Bilgilerini Doldurma

Satış modalında aşağıdaki bilgileri girilmesi zorunludur:

```
Müşteri Adı*        : Ad Soyad
Telefon*            : 05XX XXX XXXX
Email*              : email@example.com
```

### Ödeme Bilgilerini Girme

- **Rezervasyon**: Ödeme bilgisi girilmez
- **Kapora**: Kapora tutarını girin (sistem %20 tavsiye eder)
- **Satış**: Tam ödeme tutarını girin

### İlave Notlar

Gerekirse müşteri hakkında notlar ekleyebilirsiniz:
- Ödeme şekli
- Sözleşme tarihi
- Özel istekler
- Vb.

---

## 📊 Satış Raporlarını Görüntüleme

### Rapor Sayfasına Gitme

Dashboard'dan **Raporlar** butonuna tıklayarak rapor sayfasına gidebilirsiniz.

### Raporlarda Görebileceğiniz Veriler

**İstatistikler Kutusu:**
- Toplam İşlem Sayısı
- Rezervasyon Sayısı
- Kapora Sayısı
- Satış Tamamı Sayısı
- Satış Oranı (%)

**Satış Türüne Göre Filtrele:**
- **Tümü**: Bütün satış işlemlerini göster
- **Rezervasyon**: Sadece rezervasyonları göster
- **Kapora**: Sadece kapora işlemlerini göster
- **Satış**: Sadece tamamlanan satışları göster

**Rapor Tablosu:**
Aşağıdaki sütunlarla tablo halinde gösterilir:
- Müşteri Adı
- Daire (Blok ve Daire No)
- Satış Türü
- Tarih ve Saat

---

## 🎯 Örnek Senaryo

### Senaryo: A Bloğu, 1. Kat, Daire 101'in Satışı

1. **Dashboard'dan A Bloğunu açın**
   - "A Blok" kartına tıklayın

2. **1. Katı filtreleyin**
   - "1. Kat" butonuna tıklayın

3. **Daire 101'i bulun**
   - "Daire 101" kartını görürsünüz
   - Fiyat: 4.400.000 TL (1. Kat Ana Yol)

4. **Satış Yap butonuna tıklayın**
   - Satış modalı açılır

5. **İşlemi adım adım yapın**
   ```
   Step 1: Satış Türü Seçin
   → Kapora'yı seçin
   
   Step 2: Müşteri Bilgileri
   → Ahmet Yılmaz
   → 05301234567
   → ahmet@email.com
   
   Step 3: Ödeme
   → Kapora Tutarı: 880.000 TL (Fiyatın %20'si)
   
   Step 4: Notlar
   → 15 Şubat'ta sözleşme imzalanması planlanıyor
   ```

6. **"Satışı Tamamla" butonuna tıklayın**
   - İşlem kaydedilir
   - Daire 101'in durumu "Kapora" olur
   - Müşteri bilgileri daire kartında görünür

7. **Raporlarda kontrol edin**
   - Dashboard'a geri dönün
   - "Raporlar" butonuna tıklayın
   - Kapora filtresini seçin
   - Ahmet Yılmaz'ın işlemini görürsünüz

---

## 💾 Veriler Nerede Saklanıyor?

Tüm satış verileriniz **tarayıcının yerel hafızasında (localStorage)** saklanmaktadır.

**Önemli Not:**
- Verileri kaybetmemek için tarayıcı verilerini temizlemeyin
- Verileri yedeklemek istiyorsanız, [Supabase](https://supabase.com) ile bağlantı kurun
- Farklı tarayıcılar veya cihazlar arasında veriler eşitlenmez

---

## ⚙️ Teknik Bilgiler

### Sistem İstatistikleri

| Öğe | Miktar |
|-----|--------|
| Toplam Daire | 360 |
| Blok Sayısı | 4 |
| Kat Sayısı | 10 |
| Daire Tipi | 2 (2+1 ve 1+1) |
| Cephe Tipi | 2 (Ana Yol ve Arka) |
| Satış Türü | 3 (Rezervasyon, Kapora, Satış) |

### Fiyatlandırma

**A ve B Blokları (2+1, 90 m²):**
- Başlangıç: 4.350.000 TL
- Kat artışı: +50.000 TL
- Ana yol: +50.000 TL
- Maksimum: 4.800.000 TL

**C ve D Blokları (1+1, 45 m²):**
- Başlangıç: 2.350.000 TL
- Kat artışı: +50.000 TL
- Ana yol: +50.000 TL
- Maksimum: 2.800.000 TL

---

## 🆘 Sık Sorulan Sorular

### S: Verilerimi nasıl yedeğe alabilirim?
**C:** Şu anda localStorage kullanıyoruz. Supabase entegrasyonu ile ilerleyen günlerde veritabanında saklanabilir.

### S: Satış işlemini geri alabilir miyim?
**C:** Henüz geri alma özelliği yok. Silinmiş dairenin durumu "Müsait" olarak sıfırlamak için lütfen yöneticiyle iletişime geçin.

### S: Kaç kullanıcı aynı anda kullanabilir?
**C:** Şu anda tek cihazdan kullanılır. Çoklu kullanıcı desteği için Supabase'e geçilmesi gerekir.

### S: Telefondan kullanabilir miyim?
**C:** Evet! Sistem tamamen mobil uyumludur (responsive).

### S: En yüksek fiyatlı daire hangidir?
**C:** Blok A veya B'nin 10. katı, ana yol cephesi: 4.800.000 TL

### S: En düşük fiyatlı daire hangidir?
**C:** Blok C veya D'nin 1. katı, arka cephe: 2.350.000 TL

---

## 📞 Destek

Sorunlarla karşılaşırsanız:

1. **Sayfa Sorunları**: F5 ile sayfayı yenileyin
2. **Veri Kayıp**: Tarayıcı geçmişini temizlemeyin
3. **Satış Modal**: Dairenin "Satıldı" durumda olmadığından emin olun

---

## 🚀 İpuçları

✅ **Yapılması Gerekenler:**
- Düzenli olarak raporları kontrol edin
- Müşteri bilgilerini tam doldurun
- Önemli notları yazın

❌ **Yapılmaması Gerekenler:**
- Aynı dairenin satışını 2 kere kaydetmeyin
- Tarayıcı verilerini temizlemeyin
- Yanlış tarih veya fiyat girmemeyin

---

**Versiyon:** 1.0.0  
**Son Güncelleme:** 27 Ocak 2026  

Başarılı satışlar diliyoruz! 🎉
