import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'

interface WhatsAppMessageData {
  customerPhone: string
  customerName: string
  block: string
  apartmentNumber: number
  price: number
  depositAmount?: number
  saleType: 'reservation' | 'deposit' | 'sold' | 'cancelled'
  monthlyPayment?: number
  installmentMonths?: number
  notificationType?: 'sale' | 'cancellation'
  // Çoklu daire desteği
  isMultiple?: boolean
  apartmentNumbers?: number[]
  blocks?: string[]
  totalPrice?: number
}

export async function POST(request: NextRequest) {
  console.log('🔵 [SEND-WHATSAPP] API çağrıldı')
  
  try {
    console.log('🔵 [SEND-WHATSAPP] JSON parse ediliyor...')
    const data: WhatsAppMessageData = await request.json()
    console.log('✅ [SEND-WHATSAPP] JSON başarıyla parse edildi')
    
    console.log('📥 WhatsApp request received:', {
      customer: data.customerName,
      phone: data.customerPhone,
      block: data.block,
      apartment: data.apartmentNumber,
    })

    // Mock mode check - test için
    const mockMode = process.env.NEXT_PUBLIC_MOCK_WHATSAPP === 'true'
    if (mockMode) {
      console.log('🎭 [MOCK MODE] Twilio çağrısı simüle ediliyor...')
      
      // Fake mesajı log'la
      const messageBody = buildWhatsAppMessage(data)
      console.log('📨 [MOCK] Mesaj İçeriği:')
      console.log(messageBody)
      
      // Fake success dön
      return NextResponse.json(
        {
          success: true,
          messageSid: 'mock-' + Date.now(),
          message: '✅ [MOCK MODE] WhatsApp mesajı simüle edildi', 
          to: data.customerPhone,
          debug: {
            mockMode: true,
            message: buildWhatsAppMessage(data),
          }
        },
        { status: 200 }
      )
    }

    // Twilio credentials
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    let twilioWhatsAppFrom = process.env.TWILIO_WHATSAPP_FROM
    const salespersonWhatsApp = process.env.NEXT_PUBLIC_SALESPERSON_WHATSAPP
    
    // Format kontrolü ve düzeltme
    if (twilioWhatsAppFrom && !twilioWhatsAppFrom.startsWith('whatsapp:')) {
      twilioWhatsAppFrom = `whatsapp:${twilioWhatsAppFrom}`
    }
    
    console.log('🔑 Environment check:', {
      hasSid: !!accountSid,
      hasToken: !!authToken,
      hasFrom: !!twilioWhatsAppFrom,
      hasSalesperson: !!salespersonWhatsApp,
      actualSid: accountSid?.substring(0, 10) + '...',
      actualFrom: twilioWhatsAppFrom,
      actualSalesperson: salespersonWhatsApp,
    })

    if (!accountSid || !authToken || !twilioWhatsAppFrom) {
      console.warn('⚠️ Twilio credentials not configured properly')
      return NextResponse.json(
        { 
          success: false, 
          message: 'Twilio credentials not configured. Please set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_WHATSAPP_FROM in .env.local',
          error: 'Missing credentials'
        },
        { status: 200 }
      )
    }
    
    if (!salespersonWhatsApp) {
      console.warn('⚠️ Salesperson phone not configured')
      return NextResponse.json(
        { 
          success: false, 
          message: 'Salesperson phone not configured. Please set NEXT_PUBLIC_SALESPERSON_WHATSAPP in .env.local',
          error: 'Missing salesperson phone'
        },
        { status: 200 }
      )
    }

    const client = twilio(accountSid, authToken)

    // Satış temsilcisine (salesperson) gönder
    // Müşteri telefon numarası yerine satış temsilcisinin numarasını kullan
    let phoneNumber = salespersonWhatsApp?.trim() || data.customerPhone.trim()
    
    // Eğer +90 ile başlarsa, olduğu gibi kullan
    if (phoneNumber.startsWith('+90')) {
      // Zaten doğru format
    } 
    // Eğer 0 ile başlarsa, 0'ı kaldır ve +90 ekle
    else if (phoneNumber.startsWith('0')) {
      phoneNumber = '+90' + phoneNumber.substring(1)
    }
    // Eğer sadece rakamlarsa ve 10 basamak + 0'ı kaldırıp +90 ekle
    else if (!phoneNumber.startsWith('+')) {
      const digits = phoneNumber.replace(/[^0-9]/g, '')
      if (digits.startsWith('0')) {
        phoneNumber = '+90' + digits.substring(1)
      } else {
        phoneNumber = '+90' + digits.slice(-10)
      }
    }
    
    const toNumber = `whatsapp:${phoneNumber}`
    
    console.log('📤 Sending Twilio message:')
    console.log(`   From: ${twilioWhatsAppFrom}`)
    console.log(`   To: ${toNumber}`)
    console.log(`   ToNumber (raw): ${phoneNumber}`)
    console.log(`   FromType: ${typeof twilioWhatsAppFrom}`)
    console.log(`   ToType: ${typeof toNumber}`)

    // Mesaj içeriğini oluştur
    let messageBody = buildWhatsAppMessage(data)

    // WhatsApp mesajı gönder
    console.log('⏳ Creating Twilio message...')
    const message = await client.messages.create({
      from: twilioWhatsAppFrom,
      to: toNumber,
      body: messageBody,
    })

    console.log(`✅ WhatsApp message sent successfully!`)
    console.log(`   To: ${phoneNumber}`)
    console.log(`   SID: ${message.sid}`)
    console.log(`   Status: ${message.status}`)

    return NextResponse.json(
      {
        success: true,
        messageSid: message.sid,
        message: 'WhatsApp mesajı başarıyla gönderildi',
        to: phoneNumber,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('❌ WhatsApp message error:', error)
    
    let errorMessage = 'Bilinmeyen hata'
    let errorDetails = ''
    
    if (error instanceof Error) {
      errorMessage = error.message
      errorDetails = error.stack || ''
      
      // Twilio specific errors
      if (errorMessage.includes('exceeded the 50 daily messages limit')) {
        errorMessage = '⚠️ TWILIO SANDBOX GÜNLÜK LİMİT AŞILDI!\n\nSandbox hesaplar günde maksimum 50 mesaj gönderebilir. UTC sıfırlanmasını (00:00 UTC) bekleyin veya production Twilio hesabına geçin.'
      } else if (errorMessage.includes('Unable to create record')) {
        errorMessage = 'Twilio hesabı ya da sandbox ayarları hatalı. Lütfen Twilio Console kontrol edin.'
      } else if (errorMessage.includes('not a valid phone number')) {
        errorMessage = 'Geçersiz telefon numarası formatı.'
      } else if (errorMessage.includes('permission')) {
        errorMessage = 'Twilio sandbox onayı gerekiyor. Lütfen WhatsApp\'tan sandbox mesajına katılın.'
      } else if (errorMessage.includes('Invalid From and To pair') || errorMessage.includes('same channel')) {
        errorMessage = `🚨 TWILIO SANDBOX ONAYI GEREKLİ!\n\nAdımlar:\n1. WhatsApp'ı açın (${process.env.NEXT_PUBLIC_SALESPERSON_WHATSAPP})\n2. +14155238886 numarasına mesaj gönderin\n3. "join shadow-mountain" yazın\n4. Onay mesajını bekleyin`
      } else if (errorMessage.includes('Connection refused') || errorMessage.includes('ECONNREFUSED')) {
        errorMessage = 'Twilio API serveri erişilemiyor. Lütfen internet bağlantısını kontrol edin.'
      } else if (errorMessage.includes('Invalid AccountSid')) {
        errorMessage = 'Twilio Account SID yanlış veya boş. Lütfen .env.local dosyasını kontrol edin.'
      }
    }
    
    console.error('Error details:', errorDetails)
    console.error('Full error object:', JSON.stringify(error, null, 2))

    // Hata olsa da satış devam etsin - ama hata detayını log'a yazalım
    console.error('📊 WhatsApp Error Summary:', {
      accountSid: process.env.TWILIO_ACCOUNT_SID ? 'CONFIGURED' : 'MISSING',
      authToken: process.env.TWILIO_AUTH_TOKEN ? 'CONFIGURED' : 'MISSING',
      twilioFrom: process.env.TWILIO_WHATSAPP_FROM ? 'CONFIGURED' : 'MISSING',
      salespersonPhone: process.env.NEXT_PUBLIC_SALESPERSON_WHATSAPP ? 'CONFIGURED' : 'MISSING',
      errorMessage: errorMessage,
    })

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        message: 'Mesaj gönderilemedi ama satış kaydedildi',
        debug: process.env.NODE_ENV === 'development' ? {
          errorMessage: errorMessage,
          credentialsConfigured: {
            accountSid: !!process.env.TWILIO_ACCOUNT_SID,
            authToken: !!process.env.TWILIO_AUTH_TOKEN,
            twilioFrom: !!process.env.TWILIO_WHATSAPP_FROM,
            salespersonPhone: !!process.env.NEXT_PUBLIC_SALESPERSON_WHATSAPP,
          }
        } : undefined
      },
      { status: 200 }
    )
  }
}

function buildWhatsAppMessage(data: WhatsAppMessageData): string {
  // İptal bildirimi (Satış Temsilcisine)
  if (data.saleType === 'cancelled' || data.notificationType === 'cancellation') {
    // Çoklu daire iptali
    if (data.isMultiple && data.apartmentNumbers && data.apartmentNumbers.length > 1) {
      const totalPrice = new Intl.NumberFormat('tr-TR', {
        style: 'currency',
        currency: 'TRY',
        minimumFractionDigits: 0,
      }).format(data.totalPrice || data.price)

      let message = `⚠️ *ÇOKLU DAİRE SATIŞI İPTAL EDİLDİ*\n\n`
      message += `*Müşteri:* ${data.customerName}\n`
      message += `*Müşteri Tel:* ${data.customerPhone}\n\n`
      message += `*Daire Detayları:*\n`
      message += `📊 Toplam ${data.apartmentNumbers.length} Daire\n`
      message += `🏠 Daire Numaraları: ${data.apartmentNumbers.join(', ')}\n`
      if (data.blocks && data.blocks.length > 0) {
        message += `🏢 Bloklar: ${data.blocks.join(', ')}\n`
      }
      message += `💰 Toplam Tutar: ${totalPrice}\n`
      message += `\n📌 İptal edilen satış işlemleri kaydedilmiştir.\n`
      message += `Müşteri ile iletişime geçin.`

      return message
    }
    
    // Tekli daire iptali
    const price = new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 0,
    }).format(data.price)

    let message = `⚠️ *SATIŞI İPTAL EDİLDİ*\n\n`
    message += `*Müşteri:* ${data.customerName}\n`
    message += `*Müşteri Tel:* ${data.customerPhone}\n\n`
    message += `*Daire Detayları:*\n`
    message += `🏢 Blok: ${data.block}\n`
    message += `🏠 Daire No: ${data.apartmentNumber}\n`
    message += `💰 Fiyat: ${price}\n`
    message += `\n📌 İptal edilen satış işlemi kaydedilmiştir.\n`
    message += `Müşteri ile iletişime geçin.`

    return message
  }

  // Satış onayı (Satış Temsilcisine)
  const saleTypeLabel = {
    reservation: '📅 Rezervasyon',
    deposit: '💰 Kapora',
    sold: '✅ Satış Tamamı',
  }[data.saleType]

  // Çoklu daire satışı
  if (data.isMultiple && data.apartmentNumbers && data.apartmentNumbers.length > 1) {
    const totalPrice = new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 0,
    }).format(data.totalPrice || data.price)

    let message = `🎉 *ÇOKLU DAİRE SATIŞI ONAYLANDI*\n\n`
    message += `*Müşteri:* ${data.customerName}\n`
    message += `*Müşteri Tel:* ${data.customerPhone}\n\n`
    message += `*Daire Detayları:*\n`
    message += `📊 Toplam ${data.apartmentNumbers.length} Daire\n`
    message += `🏠 Daire Numaraları: ${data.apartmentNumbers.join(', ')}\n`
    if (data.blocks && data.blocks.length > 0) {
      message += `🏢 Bloklar: ${data.blocks.join(', ')}\n`
    }
    message += `💰 Toplam Tutar: ${totalPrice}\n`
    
    if (data.depositAmount && data.depositAmount > 0) {
      const depositFormatted = new Intl.NumberFormat('tr-TR', {
        style: 'currency',
        currency: 'TRY',
        minimumFractionDigits: 0,
      }).format(data.depositAmount)
      message += `🏦 Alınan Peşinat: ${depositFormatted}\n`
    }
    
    message += `📋 Satış Türü: ${saleTypeLabel}\n`

    if (data.installmentMonths && data.monthlyPayment) {
      const monthlyPayment = new Intl.NumberFormat('tr-TR', {
        style: 'currency',
        currency: 'TRY',
        minimumFractionDigits: 0,
      }).format(data.monthlyPayment)
      message += `📅 Taksit: ${data.installmentMonths} ay\n`
      message += `📊 Aylık Ödeme: ${monthlyPayment}\n`
    }

    message += `\n✅ Satışlar başarıyla kaydedilmiştir!\n`
    message += `Sözleşme hazırlama adımlarına devam edin.`

    return message
  }

  // Tekli daire satışı
  const price = new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 0,
  }).format(data.price)

  let message = `🎉 *DAİRE SATIŞI ONAYLANDI*\n\n`
  message += `*Müşteri:* ${data.customerName}\n`
  message += `*Müşteri Tel:* ${data.customerPhone}\n\n`
  message += `*Daire Detayları:*\n`
  message += `🏢 Blok: ${data.block}\n`
  message += `🏠 Daire No: ${data.apartmentNumber}\n`
  message += `💰 Fiyat: ${price}\n`
  
  if (data.depositAmount && data.depositAmount > 0) {
    const depositFormatted = new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 0,
    }).format(data.depositAmount)
    message += `🏦 Alınan Peşinat: ${depositFormatted}\n`
  }
  
  message += `📋 Satış Türü: ${saleTypeLabel}\n`

  if (data.installmentMonths && data.monthlyPayment) {
    const monthlyPayment = new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 0,
    }).format(data.monthlyPayment)
    message += `📅 Taksit: ${data.installmentMonths} ay\n`
    message += `📊 Aylık Ödeme: ${monthlyPayment}\n`
  }

  message += `\n✅ Satış başarıyla kaydedilmiştir!\n`
  message += `Sözleşme hazırlama adımlarına devam edin.`

  return message
}
