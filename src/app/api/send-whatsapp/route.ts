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
}

export async function POST(request: NextRequest) {
  try {
    const data: WhatsAppMessageData = await request.json()

    // Twilio credentials
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const twilioWhatsAppFrom = process.env.TWILIO_WHATSAPP_FROM
    const salespersonWhatsApp = process.env.NEXT_PUBLIC_SALESPERSON_WHATSAPP

    if (!accountSid || !authToken || !twilioWhatsAppFrom) {
      console.warn('Twilio credentials not configured')
      return NextResponse.json(
        { message: 'Twilio not configured, message skipped' },
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

    // Mesaj içeriğini oluştur
    let messageBody = buildWhatsAppMessage(data)

    // WhatsApp mesajı gönder
    const message = await client.messages.create({
      from: twilioWhatsAppFrom,
      to: toNumber,
      body: messageBody,
    })

    console.log(`WhatsApp message sent to: ${phoneNumber} (${message.sid})`)

    return NextResponse.json({
      success: true,
      messageSid: message.sid,
      message: 'WhatsApp mesajı başarıyla gönderildi',
    })
  } catch (error) {
    console.error('WhatsApp message error:', error)

    // Hata olsa da satış devam etsin
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      message: 'Mesaj gönderilemedi ama satış kaydedildi',
    })
  }
}

function buildWhatsAppMessage(data: WhatsAppMessageData): string {
  // İptal bildirimi (Satış Temsilcisine)
  if (data.saleType === 'cancelled' || data.notificationType === 'cancellation') {
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
