import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const data = await request.json()

    // PDF içeriğini oluştur
    const html = `
      <!DOCTYPE html>
      <html lang="tr">
      <head>
        <meta charset="UTF-8">
        <title>Taksit Raporu</title>
        <style>
          body {
            font-family: 'Trebuchet MS', sans-serif;
            margin: 20px;
            color: #333;
          }
          h1 {
            color: #1f2937;
            border-bottom: 3px solid #4f46e5;
            padding-bottom: 10px;
          }
          .section {
            margin-bottom: 30px;
          }
          .section h2 {
            color: #4f46e5;
            margin-top: 20px;
            font-size: 16px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
          }
          th {
            background-color: #e0e7ff;
            color: #1f2937;
            padding: 10px;
            text-align: left;
            font-weight: bold;
            border: 1px solid #c7d2fe;
          }
          td {
            padding: 8px 10px;
            border: 1px solid #e5e7eb;
          }
          tr:nth-child(even) {
            background-color: #f9fafb;
          }
          .summary-box {
            background-color: #f0f9ff;
            border: 2px solid #0284c7;
            border-radius: 6px;
            padding: 15px;
            margin-top: 10px;
          }
          .summary-row {
            display: flex;
            justify-content: space-between;
            margin: 8px 0;
            font-size: 14px;
          }
          .summary-label {
            font-weight: bold;
            color: #1f2937;
          }
          .summary-value {
            text-align: right;
            color: #059669;
            font-weight: bold;
          }
          .status-overdue {
            color: #dc2626;
            font-weight: bold;
          }
          .status-upcoming {
            color: #ea580c;
            font-weight: bold;
          }
          .status-paid {
            color: #059669;
            font-weight: bold;
          }
          .report-date {
            text-align: right;
            color: #6b7280;
            font-size: 12px;
            margin-top: 20px;
          }
        </style>
      </head>
      <body>
        <h1>📊 Taksit Raporu</h1>
        
        <div class="section">
          <h2>Genel Bilgiler</h2>
          <div class="summary-box">
            <div class="summary-row">
              <span class="summary-label">Hazırlama Tarihi:</span>
              <span>${new Date().toLocaleDateString('tr-TR')}</span>
            </div>
            <div class="summary-row">
              <span class="summary-label">Rapor Türü:</span>
              <span>${data.reportType || 'Genel Taksit Raporu'}</span>
            </div>
          </div>
        </div>

        ${data.summary ? `
        <div class="section">
          <h2>Özet İstatistikler</h2>
          <div class="summary-box">
            <div class="summary-row">
              <span class="summary-label">Toplam Daire Sayısı:</span>
              <span class="summary-value">${data.summary.totalApartments || 0}</span>
            </div>
            <div class="summary-row">
              <span class="summary-label">Taksit Yapılan:</span>
              <span class="summary-value">${data.summary.installedApartments || 0}</span>
            </div>
            <div class="summary-row">
              <span class="summary-label">Peşin Ödenen:</span>
              <span class="summary-value">${data.summary.cashApartments || 0}</span>
            </div>
            <div class="summary-row">
              <span class="summary-label">Toplam Tahsilat:</span>
              <span class="summary-value">${data.summary.totalPaid?.toLocaleString('tr-TR') || 0} ₺</span>
            </div>
            <div class="summary-row">
              <span class="summary-label">Toplam Kalan Vade:</span>
              <span class="summary-value" style="color: #dc2626;">${data.summary.totalDue?.toLocaleString('tr-TR') || 0} ₺</span>
            </div>
            <div class="summary-row">
              <span class="summary-label">Vade Geçmiş Daire:</span>
              <span class="summary-value" style="color: #dc2626;">${data.summary.overdueApartments || 0}</span>
            </div>
          </div>
        </div>
        ` : ''}

        ${data.items && data.items.length > 0 ? `
        <div class="section">
          <h2>Detaylı Listesi</h2>
          <table>
            <thead>
              <tr>
                <th>Blok-Daire</th>
                <th>Müşteri</th>
                <th>Aylık Ödeme</th>
                <th>Taksit Ay</th>
                <th>Yapılan Ödeme</th>
                <th>Kalan Vade</th>
                <th>Durum</th>
              </tr>
            </thead>
            <tbody>
              ${data.items.map((item: any) => `
                <tr>
                  <td>${item.block}-${item.number}</td>
                  <td>${item.customerName}</td>
                  <td>${item.monthlyPayment?.toLocaleString('tr-TR') || 0} ₺</td>
                  <td>${item.installmentMonths} ay</td>
                  <td>${item.totalPaid?.toLocaleString('tr-TR') || 0} ₺</td>
                  <td>${item.remainingBalance?.toLocaleString('tr-TR') || 0} ₺</td>
                  <td class="status-${item.status}">${item.statusLabel || item.status}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ` : ''}

        <div class="section">
          <p class="report-date">
            Sistem tarafından otomatik oluşturulmuştur. ${new Date().toLocaleString('tr-TR')}
          </p>
        </div>
      </body>
      </html>
    `

    return NextResponse.json({
      html,
      filename: `taksit-raporu-${new Date().toISOString().split('T')[0]}.html`,
    })
  } catch (error) {
    console.error('PDF export error:', error)
    return NextResponse.json({ error: 'PDF export failed' }, { status: 500 })
  }
}
