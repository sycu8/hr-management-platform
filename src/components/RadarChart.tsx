const COLORS = {
  self: 'var(--accent, #534ab7)',
  mgr: 'var(--info, #2f6fed)',
  peer: 'var(--good, #1f8a5b)',
  report: 'var(--warn, #c47a00)',
  avg: 'var(--muted, #888)',
}

export type RadarSeries = {
  key: keyof typeof COLORS
  label: string
  values: Array<number | null>
  dashed?: boolean
}

/** SVG radar / spider chart for 360 competency scores (0–5). */
export function RadarChart({
  labels,
  series,
  max = 5,
  size = 320,
}: {
  labels: string[]
  series: RadarSeries[]
  max?: number
  size?: number
}) {
  if (labels.length < 3) {
    return <p className="muted">Cần ≥3 năng lực để vẽ radar.</p>
  }

  const cx = size / 2
  const cy = size / 2
  const radius = size * 0.36
  const n = labels.length

  function point(i: number, value: number) {
    const angle = -Math.PI / 2 + (i / n) * Math.PI * 2
    const r = (Math.min(max, Math.max(0, value)) / max) * radius
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    }
  }

  function ringPath(level: number) {
    const pts = labels.map((_, i) => point(i, level))
    return pts
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(' ') + ' Z'
  }

  function seriesPath(values: Array<number | null>) {
    const pts = values.map((v, i) => point(i, v ?? 0))
    return pts
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(' ') + ' Z'
  }

  return (
    <div className="radar-wrap">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width="100%"
        height={size}
        role="img"
        aria-label="Biểu đồ radar 360"
      >
        {[1, 2, 3, 4, 5].map((lvl) => (
          <path
            key={lvl}
            d={ringPath(lvl)}
            fill="none"
            stroke="var(--line)"
            strokeWidth={1}
            opacity={0.7}
          />
        ))}
        {labels.map((label, i) => {
          const tip = point(i, max)
          const lab = point(i, max * 1.18)
          return (
            <g key={label}>
              <line
                x1={cx}
                y1={cy}
                x2={tip.x}
                y2={tip.y}
                stroke="var(--line)"
                strokeWidth={1}
              />
              <text
                x={lab.x}
                y={lab.y}
                textAnchor="middle"
                dominantBaseline="middle"
                className="radar-label"
                fontSize={11}
                fill="var(--muted)"
              >
                {label.length > 14 ? `${label.slice(0, 12)}…` : label}
              </text>
            </g>
          )
        })}
        {series.map((s) => {
          if (!s.values.some((v) => v != null && v > 0)) return null
          return (
            <path
              key={s.key}
              d={seriesPath(s.values)}
              fill={COLORS[s.key]}
              fillOpacity={0.12}
              stroke={COLORS[s.key]}
              strokeWidth={2}
              strokeDasharray={s.dashed ? '5 4' : undefined}
            />
          )
        })}
      </svg>
      <div className="chart-legend">
        {series.map((s) => (
          <span key={s.key}>
            <i
              className="swatch"
              style={{ background: COLORS[s.key] }}
              aria-hidden
            />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  )
}
