function normalizeWhitespace(value: string) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
}

function capitalizeTurkishWord(value: string) {
  const lowered = value.toLocaleLowerCase('tr-TR')
  const [first = '', ...rest] = lowered
  return `${first.toLocaleUpperCase('tr-TR')}${rest.join('')}`
}

function capitalizeSegment(value: string) {
  return value
    .split('-')
    .map(part => capitalizeTurkishWord(part))
    .join('-')
}

export function formatCustomerName(value: string) {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return ''

  const parts = normalized.split(' ').filter(Boolean)
  if (parts.length === 1) {
    return capitalizeSegment(parts[0])
  }

  const givenNames = parts.slice(0, -1).map(capitalizeSegment).join(' ')
  const surname = parts[parts.length - 1].toLocaleUpperCase('tr-TR')
  return `${givenNames} ${surname}`.trim()
}
