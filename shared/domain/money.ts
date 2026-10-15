/** Round to nearest VND (legacy `Math.round`). */
export function roundVnd(n: number): number {
  return Math.round(n || 0)
}

const vndFormatter = new Intl.NumberFormat('vi-VN')

/** Legacy `vnd(n)` — `1.234.567 ₫`. */
export function formatVnd(n: number): string {
  return `${vndFormatter.format(roundVnd(n))} ₫`
}

/** Legacy `dec(n)` — decimal point as comma. */
export function formatDec(n: number): string {
  return String(n).replace('.', ',')
}

/** Non-negative clamp used by travel hotel excess (legacy `cap`). */
export function capNonNeg(n: number): number {
  return Math.max(0, n)
}
