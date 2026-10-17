type Point = { label: string; value: number }
type SeriesPoint = { month: string; value: number }

const PALETTE = [
  'var(--accent)',
  'var(--info)',
  'var(--good)',
  'var(--warn)',
  '#6b5b95',
  '#88b04b',
  '#955251',
  '#009b77',
]

const FUNNEL_ORDER = [
  'new',
  'Mới',
  'screen',
  'Sàng lọc',
  'interview',
  'Phỏng vấn',
  'offer',
  'Offer',
  'hired',
  'Nhận việc',
  'rejected',
  'Loại',
]

const STAGE_LABEL: Record<string, string> = {
  new: 'Mới',
  screen: 'Sàng lọc',
  interview: 'Phỏng vấn',
  offer: 'Offer',
  hired: 'Nhận việc',
  rejected: 'Loại',
}

function maxOf(values: number[], fallback = 1): number {
  const m = Math.max(0, ...values)
  return m > 0 ? m : fallback
}

function shortMonth(ym: string): string {
  const m = ym.slice(5, 7)
  return `T${Number(m) || m}`
}

function formatCompact(n: number): string {
  if (Math.abs(n) >= 1_000_000_000) {
    return `${(n / 1_000_000_000).toFixed(1)}tỷ`
  }
  if (Math.abs(n) >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}tr`
  }
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(Math.round(n * 10) / 10)
}

/** Vertical column chart — HTML bars so value labels stay readable. */
export function BarChart({
  data,
  height = 200,
  valueFormat = formatCompact,
}: {
  data: SeriesPoint[]
  height?: number
  valueFormat?: (n: number) => string
}) {
  if (data.length === 0) return <p className="empty">Không có dữ liệu</p>
  const max = maxOf(data.map((d) => d.value))

  return (
    <div className="vbar" style={{ minHeight: height }}>
      <div className="vbar-plot">
        {data.map((d) => {
          const pct = max > 0 ? (d.value / max) * 100 : 0
          return (
            <div key={d.month} className="vbar-col">
              <div className="vbar-val">{valueFormat(d.value)}</div>
              <div className="vbar-track">
                <div
                  className="vbar-fill"
                  style={{ height: `${Math.max(pct, d.value > 0 ? 4 : 0)}%` }}
                  title={`${shortMonth(d.month)}: ${valueFormat(d.value)}`}
                />
              </div>
              <div className="vbar-label">{shortMonth(d.month)}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function DualBarChart({
  a,
  b,
  aLabel,
  bLabel,
  height = 200,
}: {
  a: SeriesPoint[]
  b: SeriesPoint[]
  aLabel: string
  bLabel: string
  height?: number
}) {
  const months = a.map((x) => x.month)
  if (months.length === 0) return <p className="empty">Không có dữ liệu</p>
  const max = maxOf([...a.map((x) => x.value), ...b.map((x) => x.value)])

  return (
    <div>
      <div className="vbar dual" style={{ minHeight: height }}>
        <div className="vbar-plot">
          {months.map((month, i) => {
            const av = a[i]?.value ?? 0
            const bv = b[i]?.value ?? 0
            const ap = max > 0 ? (av / max) * 100 : 0
            const bp = max > 0 ? (bv / max) * 100 : 0
            return (
              <div key={month} className="vbar-col dual-col">
                <div className="vbar-pair-vals">
                  <span className="vbar-val a">{av || '—'}</span>
                  <span className="vbar-val b">{bv || '—'}</span>
                </div>
                <div className="vbar-pair">
                  <div className="vbar-track thin">
                    <div
                      className="vbar-fill"
                      style={{ height: `${Math.max(ap, av > 0 ? 4 : 0)}%` }}
                    />
                  </div>
                  <div className="vbar-track thin">
                    <div
                      className="vbar-fill alt"
                      style={{ height: `${Math.max(bp, bv > 0 ? 4 : 0)}%` }}
                    />
                  </div>
                </div>
                <div className="vbar-label">{shortMonth(month)}</div>
              </div>
            )
          })}
        </div>
      </div>
      <div className="chart-legend">
        <span>
          <i className="swatch" /> {aLabel}
        </span>
        <span>
          <i className="swatch alt" /> {bLabel}
        </span>
      </div>
    </div>
  )
}

export function HBarChart({
  data,
  maxItems = 8,
}: {
  data: Point[]
  maxItems?: number
}) {
  const rows = data.slice(0, maxItems)
  if (rows.length === 0) return <p className="empty">Không có dữ liệu</p>
  const max = maxOf(rows.map((d) => d.value))
  return (
    <ul className="hbar-list">
      {rows.map((d, i) => (
        <li key={`${d.label}-${i}`}>
          <div className="hbar-meta">
            <span className="hbar-label" title={d.label}>
              {d.label}
            </span>
            <strong>{d.value}</strong>
          </div>
          <div className="hbar-track">
            <div
              className="hbar-fill"
              style={{
                width: `${(d.value / max) * 100}%`,
                background: PALETTE[i % PALETTE.length],
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

export function DonutChart({
  data,
  labelMap,
  size = 148,
  centerLabel,
  centerValue,
}: {
  data: Point[]
  labelMap?: Record<string, string>
  size?: number
  centerLabel?: string
  centerValue?: string | number
}) {
  const filtered = data.filter((d) => d.value > 0)
  if (filtered.length === 0) return <p className="empty">Không có dữ liệu</p>
  const total = filtered.reduce((s, d) => s + d.value, 0)
  const r = 38
  const c = 2 * Math.PI * r
  let offset = 0

  return (
    <div className="donut-wrap">
      <svg width={size} height={size} viewBox="0 0 100 100" role="img">
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="var(--line)"
          strokeWidth="14"
        />
        {filtered.map((d, i) => {
          const len = (d.value / total) * c
          const el = (
            <circle
              key={d.label}
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke={PALETTE[i % PALETTE.length]}
              strokeWidth="14"
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 50 50)"
            />
          )
          offset += len
          return el
        })}
        <text x="50" y="48" textAnchor="middle" className="donut-center-v">
          {centerValue ?? total}
        </text>
        {centerLabel ? (
          <text x="50" y="58" textAnchor="middle" className="donut-center-l">
            {centerLabel}
          </text>
        ) : null}
      </svg>
      <ul className="donut-legend">
        {filtered.map((d, i) => (
          <li key={d.label}>
            <i style={{ background: PALETTE[i % PALETTE.length] }} />
            <span>{labelMap?.[d.label] ?? d.label}</span>
            <strong>
              {d.value}
              <em> · {Math.round((d.value / total) * 100)}%</em>
            </strong>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Line chart for scores over labeled cycles (fixed Y domain, point labels).
 * Defaults to score scale 1–5 when yMin/yMax omitted.
 */
export function LineChart({
  data,
  height = 220,
  yMin = 1,
  yMax = 5,
  valueFormat = (n) => String(Math.round(n * 10) / 10),
}: {
  data: Point[]
  height?: number
  yMin?: number
  yMax?: number
  valueFormat?: (n: number) => string
}) {
  const points = data.filter((d) => Number.isFinite(d.value))
  if (points.length === 0) return <p className="empty">Không có dữ liệu</p>

  const padL = 36
  const padR = 16
  const padT = 28
  const padB = 36
  const width = Math.max(280, points.length * 120)
  const plotW = width - padL - padR
  const plotH = height - padT - padB
  const range = yMax - yMin || 1

  const coords = points.map((d, i) => {
    const x =
      points.length === 1
        ? padL + plotW / 2
        : padL + (i / (points.length - 1)) * plotW
    const y = padT + (1 - (d.value - yMin) / range) * plotH
    return { ...d, x, y }
  })

  const path = coords
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ')

  const ticks = [yMin, yMin + range / 2, yMax].map((v) => Math.round(v * 10) / 10)

  return (
    <div className="line-chart" style={{ minHeight: height }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        role="img"
        aria-label="Biểu đồ điểm theo chu kỳ"
      >
        {ticks.map((t) => {
          const y = padT + (1 - (t - yMin) / range) * plotH
          return (
            <g key={`t-${t}`}>
              <line
                x1={padL}
                x2={width - padR}
                y1={y}
                y2={y}
                className="line-chart-grid"
              />
              <text x={padL - 8} y={y + 4} textAnchor="end" className="line-chart-tick">
                {t}
              </text>
            </g>
          )
        })}
        <path d={path} className="line-chart-path" fill="none" />
        {coords.map((p) => (
          <g key={p.label}>
            <circle cx={p.x} cy={p.y} r={5} className="line-chart-dot" />
            <text
              x={p.x}
              y={p.y - 12}
              textAnchor="middle"
              className="line-chart-val"
            >
              {valueFormat(p.value)}
            </text>
            <text
              x={p.x}
              y={height - 12}
              textAnchor="middle"
              className="line-chart-xlabel"
            >
              {p.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}

/** Recruitment funnel — ordered stages, full-width rows, large numbers. */
export function FunnelChart({ data }: { data: Point[] }) {
  if (data.length === 0) return <p className="empty">Không có dữ liệu</p>

  const ordered = [...data].sort((x, y) => {
    const ix = FUNNEL_ORDER.indexOf(x.label)
    const iy = FUNNEL_ORDER.indexOf(y.label)
    if (ix === -1 && iy === -1) return y.value - x.value
    if (ix === -1) return 1
    if (iy === -1) return -1
    return ix - iy
  })
  const max = maxOf(ordered.map((d) => d.value))
  const total = ordered.reduce((s, d) => s + d.value, 0)

  return (
    <ul className="funnel-list">
      {ordered.map((d, i) => {
        const pct = max > 0 ? Math.max(28, (d.value / max) * 100) : 28
        const share = total > 0 ? Math.round((d.value / total) * 100) : 0
        return (
          <li key={d.label}>
            <div
              className="funnel-row"
              style={{
                ['--funnel-w' as string]: `${pct}%`,
                ['--funnel-c' as string]: PALETTE[i % PALETTE.length],
              }}
            >
              <div className="funnel-bar">
                <span className="funnel-stage">
                  {STAGE_LABEL[d.label] ?? d.label}
                </span>
              </div>
              <div className="funnel-nums">
                <strong>{d.value}</strong>
                <em>{share}%</em>
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
