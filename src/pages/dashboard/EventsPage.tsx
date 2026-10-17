import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchJson } from '../../lib/api'

type EventKind =
  | 'leave'
  | 'trip'
  | 'interview'
  | 'birthday'
  | 'onboard'
  | 'learning'
  | 'contract'
  | 'review'

type CalEvent = {
  id: string
  kind: EventKind
  date: string
  endDate?: string
  title: string
  detail: string
  href?: string
  person?: string
}

type DayStat = {
  date: string
  leaveCount: number
  tripCount: number
  leaveNames: string[]
  tripNames: string[]
}

type EventsPayload = {
  from: string
  to: string
  days: number
  summary: {
    peopleOnLeave: number
    peopleOnTrip: number
    leaveToday: number
    tripToday: number
    eventCount: number
  }
  dayStats: DayStat[]
  events: CalEvent[]
}

type LoadState =
  | { status: 'loading' }
  | { status: 'ok'; data: EventsPayload }
  | { status: 'error'; message: string }

const KIND_LABEL: Record<EventKind, string> = {
  leave: 'Nghỉ phép',
  trip: 'Công tác',
  interview: 'Phỏng vấn',
  birthday: 'Sinh nhật',
  onboard: 'Nhận việc',
  learning: 'Hạn học',
  contract: 'Hợp đồng',
  review: 'Đánh giá',
}

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

function formatVi(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split('-')
  return `Tháng ${Number(m)}/${y}`
}

function monthsInRange(from: string, to: string): string[] {
  const out: string[] = []
  let y = Number(from.slice(0, 4))
  let m = Number(from.slice(5, 7))
  const endY = Number(to.slice(0, 4))
  const endM = Number(to.slice(5, 7))
  while (y < endY || (y === endY && m <= endM)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`)
    m += 1
    if (m > 12) {
      m = 1
      y += 1
    }
  }
  return out
}

/** Monday-first grid cells for a calendar month (null = padding). */
function monthCells(ym: string): (string | null)[] {
  const y = Number(ym.slice(0, 4))
  const m = Number(ym.slice(5, 7))
  const first = new Date(y, m - 1, 1)
  const dim = new Date(y, m, 0).getDate()
  // JS: 0=Sun … 6=Sat → Mon-first offset
  const offset = (first.getDay() + 6) % 7
  const cells: (string | null)[] = Array.from({ length: offset }, () => null)
  for (let d = 1; d <= dim; d++) {
    cells.push(
      `${ym}-${String(d).padStart(2, '0')}`,
    )
  }
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

function eventListText(ev: CalEvent): string {
  switch (ev.kind) {
    case 'leave':
      return `${ev.title} nghỉ ${formatVi(ev.date)}${
        ev.endDate && ev.endDate !== ev.date ? ` – ${formatVi(ev.endDate)}` : ''
      }`
    case 'trip':
      return `${ev.title} đi ${ev.detail.split(' · ')[0] ?? ''}`
    case 'interview':
      return `Phỏng vấn ${ev.title}${ev.detail.includes('lúc') ? ` ${ev.detail.replace('Phỏng vấn ', '')}` : ''}`
    case 'birthday':
      return `Sinh nhật ${ev.title}${
        ev.detail.includes('·') ? ` (${ev.detail.split('·')[1]?.trim()})` : ''
      }`
    case 'onboard':
      return `${ev.title} nhận việc${
        ev.detail.includes('·') ? `, ${ev.detail.split('·')[1]?.trim()}` : ''
      }`
    case 'learning':
      return `${ev.title} · ${ev.detail}`
    case 'contract':
      return `${ev.detail} của ${ev.title}`
    case 'review':
      return ev.detail
    default:
      return `${ev.title} — ${ev.detail}`
  }
}

export function EventsPage() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchJson<EventsPayload>('/api/dashboard/events?days=45')
      .then((data) => {
        if (cancelled) return
        setState({ status: 'ok', data })
        setSelected(data.from)
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setState({
            status: 'error',
            message: e instanceof Error ? e.message : 'Không tải được',
          })
      })
    return () => {
      cancelled = true
    }
  }, [])

  const dayStatMap = useMemo(() => {
    if (state.status !== 'ok') return new Map<string, DayStat>()
    return new Map(state.data.dayStats.map((d) => [d.date, d]))
  }, [state])

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalEvent[]>()
    if (state.status !== 'ok') return map
    for (const ev of state.data.events) {
      const list = map.get(ev.date) ?? []
      list.push(ev)
      map.set(ev.date, list)
      if (ev.endDate && (ev.kind === 'leave' || ev.kind === 'trip')) {
        // already counted via dayStats; list shows on start date only
      }
    }
    return map
  }, [state])

  if (state.status === 'loading') {
    return <div className="card empty">Đang tải lịch sự kiện…</div>
  }
  if (state.status === 'error') {
    return (
      <div className="card empty">
        <h2>Không tải được dữ liệu</h2>
        <p>{state.message}</p>
      </div>
    )
  }

  const { data } = state
  const selectedStat = selected ? dayStatMap.get(selected) : undefined
  const selectedEvents = selected ? (eventsByDay.get(selected) ?? []) : []
  const months = monthsInRange(data.from, data.to)

  return (
    <div className="stack dash events-page">
      <div className="dash-intro">
        <p className="page-lead muted">
          Lịch {data.days} ngày tới — sự kiện công ty, nghỉ phép và công tác
          (kiểu Google Calendar).
        </p>
        <div className="dash-actions">
          <Link className="btn ghost" to="/leave/calendar">
            Lịch nghỉ
          </Link>
          <Link className="btn ghost" to="/travel/trips">
            Công tác
          </Link>
        </div>
      </div>

      <div className="grid g4 events-summary">
        <div className="tile">
          <div className="v">{data.summary.peopleOnLeave}</div>
          <div className="muted small">Người có nghỉ phép (cửa sổ)</div>
        </div>
        <div className="tile">
          <div className="v">{data.summary.peopleOnTrip}</div>
          <div className="muted small">Người đi công tác (cửa sổ)</div>
        </div>
        <div className="tile">
          <div className="v">
            {data.summary.leaveToday}
            <span className="muted small"> / {data.summary.tripToday}</span>
          </div>
          <div className="muted small">Hôm nay · nghỉ / công tác</div>
        </div>
        <div className="tile">
          <div className="v">{data.summary.eventCount}</div>
          <div className="muted small">Mốc sự kiện trong {data.days} ngày</div>
        </div>
      </div>

      <div className="card gcal-card">
        <div className="gcal-toolbar">
          <h2>Lịch {data.days} ngày tới</h2>
          <div className="gcal-legend" aria-label="Chú thích">
            <span className="gcal-leg gcal-leg--leave">Nghỉ phép</span>
            <span className="gcal-leg gcal-leg--trip">Công tác</span>
            <span className="gcal-leg gcal-leg--other">Sự kiện khác</span>
          </div>
        </div>

        <div className="gcal-months">
          {months.map((ym) => (
            <div key={ym} className="gcal-month">
              <div className="gcal-month-title">{monthLabel(ym)}</div>
              <div className="gcal-weekdays">
                {WEEKDAYS.map((w) => (
                  <div key={w} className="gcal-wd">
                    {w}
                  </div>
                ))}
              </div>
              <div className="gcal-grid">
                {monthCells(ym).map((iso, i) => {
                  if (!iso) {
                    return <div key={`pad-${ym}-${i}`} className="gcal-day gcal-day--pad" />
                  }
                  const inWindow = iso >= data.from && iso <= data.to
                  const stat = dayStatMap.get(iso)
                  const dayEvents = eventsByDay.get(iso) ?? []
                  const otherCount = dayEvents.filter(
                    (e) => e.kind !== 'leave' && e.kind !== 'trip',
                  ).length
                  const isToday = iso === data.from
                  const isSel = iso === selected
                  return (
                    <button
                      key={iso}
                      type="button"
                      className={[
                        'gcal-day',
                        inWindow ? '' : 'gcal-day--out',
                        isToday ? 'gcal-day--today' : '',
                        isSel ? 'gcal-day--selected' : '',
                        (stat?.leaveCount ?? 0) > 0 ? 'gcal-day--has-leave' : '',
                        (stat?.tripCount ?? 0) > 0 ? 'gcal-day--has-trip' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      disabled={!inWindow}
                      onClick={() => setSelected(iso)}
                    >
                      <span className="gcal-dom">{Number(iso.slice(8, 10))}</span>
                      {inWindow ? (
                        <div className="gcal-chips">
                          {(stat?.leaveCount ?? 0) > 0 ? (
                            <span className="gcal-chip gcal-chip--leave">
                              {stat!.leaveCount} nghỉ
                            </span>
                          ) : null}
                          {(stat?.tripCount ?? 0) > 0 ? (
                            <span className="gcal-chip gcal-chip--trip">
                              {stat!.tripCount} CT
                            </span>
                          ) : null}
                          {otherCount > 0 ? (
                            <span className="gcal-chip gcal-chip--other">
                              {otherCount} SK
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {selected ? (
        <div className="card gcal-day-panel">
          <h2>
            {formatVi(selected)}
            {selected === data.from ? ' · Hôm nay' : ''}
          </h2>
          <div className="gcal-day-stats">
            <span className="status-pill info">
              {selectedStat?.leaveCount ?? 0} nghỉ phép
            </span>
            <span className="status-pill warn">
              {selectedStat?.tripCount ?? 0} công tác
            </span>
          </div>
          {(selectedStat?.leaveNames.length ?? 0) > 0 ? (
            <p className="muted small">
              Nghỉ: {selectedStat!.leaveNames.join(', ')}
              {(selectedStat!.leaveCount ?? 0) > selectedStat!.leaveNames.length
                ? '…'
                : ''}
            </p>
          ) : null}
          {(selectedStat?.tripNames.length ?? 0) > 0 ? (
            <p className="muted small">
              Công tác: {selectedStat!.tripNames.join(', ')}
              {(selectedStat!.tripCount ?? 0) > selectedStat!.tripNames.length
                ? '…'
                : ''}
            </p>
          ) : null}
          {selectedEvents.length === 0 &&
          (selectedStat?.leaveCount ?? 0) === 0 &&
          (selectedStat?.tripCount ?? 0) === 0 ? (
            <p className="muted">Không có sự kiện trong ngày này.</p>
          ) : (
            <ul className="feed-list gcal-day-events">
              {selectedEvents.map((ev) => (
                <li key={ev.id}>
                  {ev.href ? (
                    <Link to={ev.href} className="feed-link">
                      <div className="feed-when">
                        <span className={`gcal-kind gcal-kind--${ev.kind}`}>
                          {KIND_LABEL[ev.kind]}
                        </span>
                      </div>
                      <div className="feed-body">
                        <strong>{eventListText(ev)}</strong>
                        <div className="muted small">{ev.detail}</div>
                      </div>
                      <span className="feed-action feed-action--spacer" aria-hidden />
                    </Link>
                  ) : (
                    <div className="feed-link feed-link--static">
                      <div className="feed-when">
                        <span className={`gcal-kind gcal-kind--${ev.kind}`}>
                          {KIND_LABEL[ev.kind]}
                        </span>
                      </div>
                      <div className="feed-body">
                        <strong>{eventListText(ev)}</strong>
                        <div className="muted small">{ev.detail}</div>
                      </div>
                      <span className="feed-action feed-action--spacer" aria-hidden />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      <div className="card">
        <h2>{data.days} ngày tới</h2>
        {data.events.length === 0 ? (
          <p className="empty">Không có sự kiện sắp tới.</p>
        ) : (
          <ul className="feed-list events-feed">
            {data.events.map((ev) => (
              <li key={ev.id}>
                {ev.href ? (
                  <Link to={ev.href} className="feed-link">
                    <div className="feed-when">{formatVi(ev.date)}</div>
                    <div className="feed-body">
                      <span className={`gcal-kind gcal-kind--${ev.kind}`}>
                        {KIND_LABEL[ev.kind]}
                      </span>{' '}
                      <strong>{eventListText(ev)}</strong>
                    </div>
                    <span className="feed-action feed-action--spacer" aria-hidden />
                  </Link>
                ) : (
                  <div className="feed-link feed-link--static">
                    <div className="feed-when">{formatVi(ev.date)}</div>
                    <div className="feed-body">
                      <span className={`gcal-kind gcal-kind--${ev.kind}`}>
                        {KIND_LABEL[ev.kind]}
                      </span>{' '}
                      <strong>{eventListText(ev)}</strong>
                    </div>
                    <span className="feed-action feed-action--spacer" aria-hidden />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
