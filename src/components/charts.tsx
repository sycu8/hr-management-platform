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

export function BarChart({
  data,
  height = 180,
  valueFormat = formatCompact,
}: {
  data: SeriesPoint[]
  height?: number
  valueFormat?: (n: number) => string
}) {
  if (data.length === 0) return <p className="empty">Không có dữ liệu</p>
  const max = maxOf(data.map((d) => d.value))
  const pad = { t: 16, r: 8, b: 28, l: 8 }
  const w = 100
  const innerH = height - pad.t - pad.b
  const gap = 0.28
  const barW = (w - pad.l - pad.r) / data.length

  return (
    <svg
      className="chart-svg"
      viewBox={`0 0 ${w} ${height}`}
      preserveAspectRatio="none"
      role="img"
    >
      {[0.25, 0.5, 0.75, 1].map((p) => {
        const y = pad.t + innerH * (1 - p)
        return (
          <line
            key={p}
            x1={pad.l}
            x2={w - pad.r}
            y1={y}
            y2={y}
            className="chart-grid"
          />
        )
      })}
      {data.map((d, i) => {
        const h = (d.value / max) * innerH
        const x = pad.l + i * barW + (barW * gap) / 2
        const y = pad.t + innerH - h
        return (
          <g key={d.month}>
            <rect
              x={x}
              y={y}
              width={barW * (1 - gap)}
              height={Math.max(h, d.value > 0 ? 1.2 : 0)}
              rx={1.2}
              className="chart-bar"
            />
            <text
              x={x + (barW * (1 - gap)) / 2}
              y={height - 8}
              textAnchor="middle"
              className="chart-axis"
            >
              {shortMonth(d.month)}
            </text>
            {d.value > 0 ? (
              <text
                x={x + (barW * (1 - gap)) / 2}
                y={y - 3}
                textAnchor="middle"
                className="chart-val"
              >
                {valueFormat(d.value)}
              </text>
            ) : null}
          </g>
        )
      })}
    </svg>
  )
}

export function DualBarChart({
  a,
  b,
  aLabel,
  bLabel,
  height = 180,
}: {
  a: SeriesPoint[]
  b: SeriesPoint[]
  aLabel: string
  bLabel: string
  height?: number
}) {
  const months = a.map((x) => x.month)
  const max = maxOf([...a.map((x) => x.value), ...b.map((x) => x.value)])
  const pad = { t: 16, r: 8, b: 28, l: 8 }
  const w = 100
  const innerH = height - pad.t - pad.b
  const groupW = (w - pad.l - pad.r) / months.length

  return (
    <div>
      <svg
        className="chart-svg"
        viewBox={`0 0 ${w} ${height}`}
        preserveAspectRatio="none"
        role="img"
      >
        {months.map((month, i) => {
          const av = a[i]?.value ?? 0
          const bv = b[i]?.value ?? 0
          const x0 = pad.l + i * groupW + groupW * 0.12
          const bw = groupW * 0.32
          const ha = (av / max) * innerH
          const hb = (bv / max) * innerH
          return (
            <g key={month}>
              <rect
                x={x0}
                y={pad.t + innerH - ha}
                width={bw}
                height={Math.max(ha, av > 0 ? 1 : 0)}
                rx={1}
                className="chart-bar"
              />
              <rect
                x={x0 + bw + groupW * 0.08}
                y={pad.t + innerH - hb}
                width={bw}
                height={Math.max(hb, bv > 0 ? 1 : 0)}
                rx={1}
                className="chart-bar alt"
              />
              <text
                x={pad.l + i * groupW + groupW / 2}
                y={height - 8}
                textAnchor="middle"
                className="chart-axis"
              >
                {shortMonth(month)}
              </text>
            </g>
          )
        })}
      </svg>
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
  size = 160,
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
  const r = 42
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
          strokeWidth="12"
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
              strokeWidth="12"
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 50 50)"
            />
          )
          offset += len
          return el
        })}
        <text x="50" y="47" textAnchor="middle" className="donut-center-v">
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
              <em>
                {' '}
                ({Math.round((d.value / total) * 100)}%)
              </em>
            </strong>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function FunnelChart({ data }: { data: Point[] }) {
  if (data.length === 0) return <p className="empty">Không có dữ liệu</p>
  const max = maxOf(data.map((d) => d.value))
  return (
    <ul className="funnel-list">
      {data.map((d, i) => {
        const pct = Math.max(18, (d.value / max) * 100)
        return (
          <li key={d.label}>
            <div
              className="funnel-bar"
              style={{
                width: `${pct}%`,
                background: PALETTE[i % PALETTE.length],
              }}
            >
              <span>{d.label}</span>
              <strong>{d.value}</strong>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
