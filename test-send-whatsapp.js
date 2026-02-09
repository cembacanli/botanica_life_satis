// Test WhatsApp API endpoint
const testData = {
  customerPhone: "+905439660666",
  customerName: "Test Müşteri",
  block: "A",
  apartmentNumber: 101,
  price: 4350000,
  depositAmount: 500000,
  monthlyPayment: 0,
  installmentMonths: 0,
  saleType: "sold",
  notificationType: "sale",
  isMultiple: false,
};

console.log("📤 Test WhatsApp API isteği gönderiliyor...");
console.log("📋 Veri:", testData);

fetch("http://localhost:3001/api/send-whatsapp", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(testData),
})
  .then((response) => {
    console.log("📥 Yanıt status:", response.status);
    console.log("📥 Yanıt headers:", {
      contentType: response.headers.get("content-type"),
    });
    return response.json();
  })
  .then((data) => {
    console.log("✅ Başarısız/Başarılı:", data);
    console.log("📊 Sonuç:", JSON.stringify(data, null, 2));
  })
  .catch((err) => {
    console.error("❌ Hata:", err);
    console.error("📊 Hata detayı:", err.message);
  });
