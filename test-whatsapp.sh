#!/bin/bash

# Daire Satış Programı - Taksit Sistemi ve WhatsApp Test Script
# Bu script, Twilio WhatsApp API'sini test etmek için kullanılan örnek isteği gönderir.

# API endpoint
API_URL="http://localhost:3000/api/send-whatsapp"

# Test verisi
TEST_DATA='{
  "customerPhone": "905551234567",
  "customerName": "Ahmet Yılmaz",
  "block": "A",
  "apartmentNumber": 5,
  "price": 4500000,
  "saleType": "sold",
  "monthlyPayment": 405000,
  "installmentMonths": 12
}'

echo "🚀 Daire Satış Programı - WhatsApp API Test"
echo "=========================================="
echo ""
echo "📝 Test Verisi:"
echo "$TEST_DATA" | jq '.'
echo ""
echo "📤 API'ye İstek Gönderiliyor..."
echo "Endpoint: $API_URL"
echo ""

# POST isteği gönder
RESPONSE=$(curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d "$TEST_DATA")

echo "📥 API Yanıtı:"
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
echo ""
echo "✅ Test Tamamlandı!"
echo ""
echo "💡 Twilio yapılandırılmamışsa, yanıt:"
echo '{ "message": "Twilio not configured, message skipped", "status": 200 }'
echo ""
echo "⚙️  Twilio Kurulumu İçin:"
echo "1. .env.local dosyasını açın"
echo "2. TWILIO_ACCOUNT_SID ve TWILIO_AUTH_TOKEN ekleyin"
echo "3. npm run dev ile sunucuyu yeniden başlatın"
