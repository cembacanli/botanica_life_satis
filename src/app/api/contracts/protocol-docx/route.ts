import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import PizZip from 'pizzip'

function escapeXml(value: string) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

const DOC_RUN_STYLE = '<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:color w:val="1F497D" w:themeColor="text2"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>'

function buildParagraph(label: string, value: string) {
  return `<w:p><w:r>${DOC_RUN_STYLE}<w:t xml:space="preserve">${escapeXml(label)} ${escapeXml(value)}</w:t></w:r></w:p>`
}

function insertAfterHeading(xml: string, token: string, injection: string) {
  const idx = xml.indexOf(token)
  if (idx < 0) return xml
  const paraEnd = xml.indexOf('</w:p>', idx)
  if (paraEnd < 0) return xml
  return `${xml.slice(0, paraEnd + 6)}${injection}${xml.slice(paraEnd + 6)}`
}

function buildRightAlignedTextParagraph(value: string) {
  return `<w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r>${DOC_RUN_STYLE}<w:t xml:space="preserve">${escapeXml(value)}</w:t></w:r></w:p>`
}

function replaceFirstDatePlaceholder(xml: string, saleDate: string) {
  return xml.replace(
    /(<w:t[^>]*>)[^<]*\.{2,}\s*\/\s*\.{2,}\s*\/\s*\.{2,}[^<]*(<\/w:t>)/,
    `$1${escapeXml(saleDate)}$2`
  )
}

function fillRightCellByRowLabel(xml: string, label: string, value: string, occurrence = 1, forceLeft = false) {
  const rows = xml.match(/<w:tr[\s\S]*?<\/w:tr>/g) || []
  let seen = 0

  for (const row of rows) {
    if (!row.includes(`>${label}<`)) continue
    seen += 1
    if (seen < occurrence) continue

    const cells = row.match(/<w:tc[\s\S]*?<\/w:tc>/g) || []
    if (cells.length === 0) continue

    // 3 kolonlu satırlarda ":" kolonu yerine son (değer) kolonunu doldur.
    const targetCell = cells[cells.length - 1]
    const paragraphContent = forceLeft
      ? `<w:p><w:pPr><w:jc w:val="left"/></w:pPr><w:r>${DOC_RUN_STYLE}<w:t xml:space="preserve">${escapeXml(value)}</w:t></w:r></w:p>`
      : `<w:p><w:r>${DOC_RUN_STYLE}<w:t xml:space="preserve">${escapeXml(value)}</w:t></w:r></w:p>`

    const updatedTargetCell = targetCell.replace(
      /<w:p[\s\S]*?<\/w:p>/,
      paragraphContent
    )

    const updatedRow = row.replace(targetCell, updatedTargetCell)
    return xml.replace(row, updatedRow)
  }

  return xml
}

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams
    const block = sp.get('block') || '-'
    const apartmentNo = sp.get('apartmentNo') || '-'
    const floor = sp.get('floor') || '-'
    const saleDate = sp.get('saleDate') || '-'
    const amount = sp.get('amount') || '-'
    const customer = sp.get('customer') || '-'
    const phone = sp.get('phone') || '-'
    const title = sp.get('title') || customer || '-'
    const address = sp.get('address') || '-'
    const identityNo = sp.get('identityNo') || '-'
    const deposit = sp.get('deposit') || '-'
    const received = sp.get('received') || '-'
    const remaining = sp.get('remaining') || '-'
    const total = sp.get('total') || amount || '-'

    const templatePath = path.join(process.cwd(), 'public', 'protokoller', 'botanica-life-satis-protokolu.docx')
    const templateBuffer = await readFile(templatePath)

    const zip = new PizZip(templateBuffer)
    const docXmlFile = zip.file('word/document.xml')

    if (!docXmlFile) {
      return NextResponse.json({ error: 'Template document.xml not found' }, { status: 500 })
    }

    const docXml = docXmlFile.asText()

    const sectionMadde3 = [
      buildParagraph('BAĞIMSIZ NO:', apartmentNo),
      buildParagraph('BLOK:', block),
      buildParagraph('KAT:', floor),
    ].join('')

    let updatedXml = docXml
    const dateReplacedXml = replaceFirstDatePlaceholder(updatedXml, saleDate)
    updatedXml =
      dateReplacedXml !== updatedXml
        ? dateReplacedXml
        : insertAfterHeading(updatedXml, 'SATIŞ PROTOKOLÜ', buildRightAlignedTextParagraph(saleDate))
    updatedXml = insertAfterHeading(updatedXml, 'MADDE 3:', sectionMadde3)
    // MADDE 6: Değerleri doğrudan mevcut tablo hücrelerine yaz.
    updatedXml = insertAfterHeading(updatedXml, 'MADDE 6:', buildParagraph('PEŞİNAT:', deposit))
    updatedXml = fillRightCellByRowLabel(updatedXml, 'SATIŞ BEDELİ', total)
    updatedXml = fillRightCellByRowLabel(updatedXml, 'ALINAN ÖDEME', received)
    updatedXml = fillRightCellByRowLabel(updatedXml, 'KALAN ÖDEME', remaining)
    updatedXml = fillRightCellByRowLabel(updatedXml, 'GENEL TOPLAM', total)

    // B-ALICI tablosu: Alıcı bilgilerini doğrudan tabloya işle.
    // A-SATICI bölümünü bozmamak için B-ALICI tarafındaki (2. eşleşme) satırları doldur.
    updatedXml = fillRightCellByRowLabel(updatedXml, 'Adı / Unvanı', title, 2)
    updatedXml = fillRightCellByRowLabel(updatedXml, 'Adresi', address, 2)
    updatedXml = fillRightCellByRowLabel(updatedXml, 'Telefon', phone, 2, true)
    updatedXml = fillRightCellByRowLabel(updatedXml, 'T.C Kimlik', identityNo, 2)
    if (updatedXml === docXml) {
      const fallback = [
        '<w:p><w:r><w:t> </w:t></w:r></w:p>',
        '<w:p><w:r><w:t>--- SISTEMDEN OTOMATIK DOLDURULAN SATIS BILGILERI ---</w:t></w:r></w:p>',
        ...sectionMadde3.split('</w:p>').filter(Boolean).map(s => `${s}</w:p>`),
        buildParagraph('PEŞİNAT:', deposit),
        buildParagraph('SATIŞ BEDELİ:', total),
        buildParagraph('ALINAN ÖDEME:', received),
        buildParagraph('KALAN ÖDEME:', remaining),
        buildParagraph('GENEL TOPLAM:', total),
        buildParagraph('Adı / Unvanı:', title),
        buildParagraph('Adresi:', address),
        buildParagraph('Telefon:', phone),
        buildParagraph('T.C Kimlik:', identityNo),
      ].join('')
      updatedXml = docXml.replace('</w:body>', `${fallback}</w:body>`)
    }
    zip.file('word/document.xml', updatedXml)

    const outputBuffer = zip.generate({ type: 'nodebuffer' })

    return new NextResponse(new Uint8Array(outputBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': 'attachment; filename="botanica-life-satis-protokolu-doldurulmus.docx"',
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('Protocol DOCX generate error:', error)
    return NextResponse.json({ error: 'Failed to generate protocol docx' }, { status: 500 })
  }
}
