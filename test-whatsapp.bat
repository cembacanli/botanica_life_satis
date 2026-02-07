@echo off
REM Daire Satış Programı - Taksit Sistemi ve WhatsApp Test Script (Windows)
REM Bu script, Twilio WhatsApp API'sini test etmek için kullanılan örnek isteği gönderir.

setlocal enabledelayedexpansion
set "API_URL=http://localhost:3000/api/send-whatsapp"

echo.
echo 🚀 Daire Satış Programı - WhatsApp API Test (Windows)
echo =====================================================
echo.
echo 📝 Test Verileri:
echo   - Müşteri Adı: Ahmet Yılmaz
echo   - Telefon: 905551234567
echo   - Blok: A
echo   - Daire No: 5
echo   - Fiyat: 4.500.000 TL
echo   - Taksit: 12 Ay (%s8 faiz)
echo   - Aylık Ödeme: 405.000 TL
echo.
echo 📤 API'ye POST isteği gönderiliyor...
echo    Endpoint: %API_URL%
echo.

REM JSON veri hazırlama
set "JSON={
set "JSON=!JSON!"customerPhone": "905551234567","
set "JSON=!JSON!"customerName": "Ahmet Yılmaz","
set "JSON=!JSON!"block": "A","
set "JSON=!JSON!"apartmentNumber": 5,"
set "JSON=!JSON!"price": 4500000,"
set "JSON=!JSON!"saleType": "sold","
set "JSON=!JSON!"monthlyPayment": 405000,"
set "JSON=!JSON!"installmentMonths": 12
set "JSON=!JSON!}"

REM curl komutu gönder
echo.
echo 📥 API Yanıtı:
echo ---------------
curl -s -X POST %API_URL% ^
  -H "Content-Type: application/json" ^
  -d "%JSON%"

echo.
echo.
echo ✅ Test Tamamlandı!
echo.
echo 💡 Beklenen Yanıtlar:
echo.
echo SEÇENEK 1: Twilio Yapılandırılmamış (Standart)
echo   Status: 200
echo   Yanıt: { "message": "Twilio not configured, message skipped" }
echo.
echo SEÇENEK 2: Twilio Başarılı (Yapılandırıldıktan sonra)
echo   Status: 200
echo   Yanıt: { "success": true, "messageSid": "SMXXXXXXXXXXXXXXXX" }
echo.
echo ⚙️  Twilio Kurulumu İçin:
echo   1. .env.local dosyasını açın
echo   2. TWILIO_ACCOUNT_SID değerini doldurun
echo   3. TWILIO_AUTH_TOKEN değerini doldurun
echo   4. npm run dev ile sunucuyu yeniden başlatın
echo.
echo 📚 Daha Fazla Bilgi:
echo   - Rehber: INSTALLMENT_WHATSAPP_GUIDE.md
echo   - API Endpoint: src/app/api/send-whatsapp/route.ts
echo   - Modal: src/components/SalesModal.tsx
echo.
echo 🔗 Twilio Kurulumu:
echo   https://www.twilio.com/console
echo   https://www.twilio.com/docs/whatsapp
echo.
pause
