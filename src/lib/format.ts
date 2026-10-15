const vndFmt = new Intl.NumberFormat('vi-VN')

/** Format VND as `1.234.567 ₫`. */
export function vnd(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—'
  return `${vndFmt.format(Math.round(n))} ₫`
}

/** Format `yyyy-mm-dd` or ISO datetime as `dd/mm/yyyy`. */
export function fd(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const d = typeof value === 'string' ? new Date(value.includes('T') ? value : `${value}T12:00:00`) : value
  if (Number.isNaN(d.getTime())) return '—'
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()}`
}

export function dec(n: number): string {
  return String(n).replace('.', ',')
}
