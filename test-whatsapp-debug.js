// WhatsApp Debug Script
// Bu script Twilio ayarlarınızı test eder

const twilio = require('twilio');
require('dotenv').config({ path: '.env.local' });

async function testWhatsApp() {
  console.log('🔍 WHATSAPP ENTEGRASYON TEST\n');
  console.log('='.repeat(50));
  
  // 1. Environment Variables Kontrolü
  console.log('\n📋 1. ENVIRONMENT VARIABLES:');
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioFrom = process.env.TWILIO_WHATSAPP_FROM;
  const salespersonPhone = process.env.NEXT_PUBLIC_SALESPERSON_WHATSAPP;
  
  console.log(`   TWILIO_ACCOUNT_SID: ${accountSid ? '✅ ' + accountSid.substring(0, 10) + '...' : '❌ YOK'}`);
  console.log(`   TWILIO_AUTH_TOKEN: ${authToken ? '✅ Ayarlanmış (' + authToken.length + ' karakter)' : '❌ YOK'}`);
  console.log(`   TWILIO_WHATSAPP_FROM: ${twilioFrom ? '✅ ' + twilioFrom : '❌ YOK'}`);
  console.log(`   SALESPERSON_WHATSAPP: ${salespersonPhone ? '✅ ' + salespersonPhone : '❌ YOK'}`);
  
  if (!accountSid || !authToken || !twilioFrom || !salespersonPhone) {
    console.log('\n❌ HATA: Bazı environment variables eksik!');
    console.log('   .env.local dosyasını kontrol edin.');
    return;
  }
  
  // 2. Twilio Bağlantı Testi
  console.log('\n🔌 2. TWILIO BAĞLANTI TEST:');
  try {
    const client = twilio(accountSid, authToken);
    const account = await client.api.accounts(accountSid).fetch();
    console.log(`   ✅ Bağlantı başarılı!`);
    console.log(`   Hesap: ${account.friendlyName}`);
    console.log(`   Status: ${account.status}`);
  } catch (error) {
    console.log(`   ❌ Bağlantı hatası: ${error.message}`);
    console.log('   Account SID veya Auth Token hatalı olabilir.');
    return;
  }
  
  // 3. Telefon Numarası Format Kontrolü
  console.log('\n📱 3. TELEFON NUMARASI FORMAT:');
  let phoneNumber = salespersonPhone.trim();
  
  if (phoneNumber.startsWith('+90')) {
    console.log(`   ✅ Format doğru: ${phoneNumber}`);
  } else if (phoneNumber.startsWith('0')) {
    phoneNumber = '+90' + phoneNumber.substring(1);
    console.log(`   ⚠️ Format düzeltildi: ${phoneNumber}`);
  } else {
    console.log(`   ❌ Format hatalı: ${phoneNumber}`);
    console.log('   +90 ile başlamalı (örn: +905439660666)');
  }
  
  const toNumber = `whatsapp:${phoneNumber}`;
  console.log(`   WhatsApp format: ${toNumber}`);
  
  // 4. Test Mesajı Gönderme
  console.log('\n📤 4. TEST MESAJI GÖNDERME:');
  console.log(`   From: ${twilioFrom}`);
  console.log(`   To: ${toNumber}`);
  console.log('   Mesaj gönderiliyor...\n');
  
  try {
    const client = twilio(accountSid, authToken);
    const message = await client.messages.create({
      from: twilioFrom,
      to: toNumber,
      body: '🧪 TEST MESAJI\n\nBu bir Daire Satış Programı test mesajıdır.\n\nEğer bu mesajı aldıysanız, WhatsApp entegrasyonu çalışıyor! ✅',
    });
    
    console.log('   ✅ MESAJ GÖNDERİLDİ!');
    console.log(`   Message SID: ${message.sid}`);
    console.log(`   Status: ${message.status}`);
    console.log(`   To: ${message.to}`);
    console.log('\n🎉 WhatsApp entegrasyonu çalışıyor!');
    console.log(`   ${phoneNumber} numarasını kontrol edin.\n`);
    
  } catch (error) {
    console.log('   ❌ MESAJ GÖNDERİLEMEDİ!\n');
    console.log(`   Hata Kodu: ${error.code}`);
    console.log(`   Hata: ${error.message}`);
    console.log(`   Detay: ${error.moreInfo}\n`);
    
    if (error.code === 21910) {
      console.log('   🚨 ÇÖZÜM: SANDBOX ONAYI GEREKLİ!');
      console.log('   ================================');
      console.log(`   1. WhatsApp'ı açın: ${phoneNumber}`);
      console.log(`   2. Yeni mesaj: ${twilioFrom.replace('whatsapp:', '')}`);
      console.log('   3. Sandbox kodunu gönderin (örn: "join shadow-mountain")');
      console.log('   4. Sandbox kodu için: https://www.twilio.com/console/sms/whatsapp/sandbox');
      console.log('   5. Onay mesajını bekleyin, sonra tekrar test edin.\n');
    } else if (error.code === 20003) {
      console.log('   🚨 ÇÖZÜM: TWILIO CREDENTIALS HATALI!');
      console.log('   Account SID veya Auth Token yanlış.');
      console.log('   https://www.twilio.com/console adresinden kontrol edin.\n');
    }
  }
  
  console.log('='.repeat(50));
}

testWhatsApp().catch(console.error);
