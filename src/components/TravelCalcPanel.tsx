import {
  estimateTravel,
  formatVnd,
  GOLDEN_TRAVEL_POLICY,
  type TravelCalcResult,
} from '../lib/travel'

export type TravelCalcInputs = {
  zone: string
  start: string
  end: string
  distance: number
  meal: string
  hotelMode: string
  hotelPrice: number
  transportEst: number
  otherEst: number
  level?: number
  advance?: number
}

function calc(inputs: TravelCalcInputs): TravelCalcResult {
  return estimateTravel(
    {
      zone: inputs.zone || 'dn3',
      start: inputs.start,
      end: inputs.end,
      distance: inputs.distance,
      meal: inputs.meal || 'none',
      hotelMode: inputs.hotelMode || 'actual',
      hotelPrice: inputs.hotelPrice,
      transportEst: inputs.transportEst,
      otherEst: inputs.otherEst,
    },
    inputs.level ?? 1,
    GOLDEN_TRAVEL_POLICY,
  )
}

type Props = {
  inputs: TravelCalcInputs
  title?: string
}

export function TravelCalcPanel({ inputs, title = 'Ước tính chi phí' }: Props) {
  const r = calc(inputs)
  const advance = Number(inputs.advance ?? 0)
  const balance = r.valid ? r.total - advance : 0

  return (
    <aside className="calc-panel" aria-live="polite">
      <h3>{title}</h3>
      {!r.valid ? (
        <p className="muted small">
          {r.notes[0] ?? 'Nhập thời gian đi/về để xem dự toán.'}
        </p>
      ) : (
        <>
          <div className="calc-kpis">
            <div>
              <span className="muted small">Ngày công tác</span>
              <strong>{r.days}</strong>
            </div>
            <div>
              <span className="muted small">Đêm KS</span>
              <strong>{r.nights}</strong>
            </div>
            <div>
              <span className="muted small">Giờ</span>
              <strong>{Math.round(r.hours * 10) / 10}</strong>
            </div>
          </div>
          <dl className="calc-lines">
            <div>
              <dt>Phụ cấp lưu trú</dt>
              <dd>{formatVnd(r.perDiem)}</dd>
            </div>
            <div>
              <dt>Khách sạn</dt>
              <dd>{formatVnd(r.hotel)}</dd>
            </div>
            <div>
              <dt>Đi lại nội địa</dt>
              <dd>{formatVnd(r.local)}</dd>
            </div>
            <div>
              <dt>Vận chuyển</dt>
              <dd>{formatVnd(r.transport)}</dd>
            </div>
            <div>
              <dt>Chi phí khác</dt>
              <dd>{formatVnd(r.other)}</dd>
            </div>
            <div className="calc-total">
              <dt>Tổng ước tính</dt>
              <dd>{formatVnd(r.total)}</dd>
            </div>
            {advance > 0 ? (
              <>
                <div>
                  <dt>Tạm ứng</dt>
                  <dd>{formatVnd(advance)}</dd>
                </div>
                <div className={balance >= 0 ? 'calc-due' : 'calc-refund'}>
                  <dt>{balance >= 0 ? 'Còn phải chi' : 'Hoàn ứng'}</dt>
                  <dd>{formatVnd(Math.abs(balance))}</dd>
                </div>
              </>
            ) : null}
          </dl>
          {r.notes.length > 0 ? (
            <ul className="calc-notes">
              {r.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          ) : null}
          {r.hotelExcess > 0 ? (
            <p className="warn-text small">
              Vượt hạn mức KS: {formatVnd(r.hotelExcess)}
            </p>
          ) : null}
        </>
      )}
    </aside>
  )
}

export function buildEstimateJson(inputs: TravelCalcInputs): string {
  const r = calc(inputs)
  return JSON.stringify({
    days: r.days,
    nights: r.nights,
    perDiem: r.perDiem,
    hotel: r.hotel,
    local: r.local,
    transport: r.transport,
    other: r.other,
    total: r.total,
    valid: r.valid,
  })
}
