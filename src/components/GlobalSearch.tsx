import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchJson } from '../lib/api'
import { useAuth } from '../lib/auth'
import { suggestPages, type SearchPageHit } from '../lib/searchCatalog'

type RecordHit = {
  kind: 'employee' | 'policy' | 'job' | 'candidate' | 'course' | 'page'
  id: string
  title: string
  subtitle?: string
  path: string
  moduleKey: string
}

const KIND_LABEL: Record<string, string> = {
  page: 'Trang',
  employee: 'Nhân viên',
  policy: 'Chính sách',
  job: 'Tin tuyển dụng',
  candidate: 'Ứng viên',
  course: 'Khóa học',
}

const SUGGESTIONS = [
  'bảng lương',
  'nghỉ phép',
  'OKR',
  'onboarding',
  'công tác',
  'đánh giá 360',
  'đào tạo',
]

type FlatHit =
  | { type: 'page'; hit: SearchPageHit }
  | { type: 'record'; hit: RecordHit }

export function GlobalSearch() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const inputId = useId()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [records, setRecords] = useState<RecordHit[]>([])
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<number | null>(null)

  const pages = useMemo(
    () => suggestPages(q, user?.modules, 8),
    [q, user?.modules],
  )

  const flat: FlatHit[] = useMemo(() => {
    const list: FlatHit[] = pages.map((hit) => ({ type: 'page', hit }))
    for (const hit of records) list.push({ type: 'record', hit })
    return list
  }, [pages, records])

  const close = useCallback(() => {
    setOpen(false)
    setActive(0)
  }, [])

  const go = useCallback(
    (path: string) => {
      navigate(path)
      close()
      setQ('')
      setRecords([])
    },
    [navigate, close],
  )

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(true)
        window.setTimeout(() => inputRef.current?.focus(), 0)
      }
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close])

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) close()
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [close])

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    const query = q.trim()
    if (query.length < 2) {
      setRecords([])
      setLoading(false)
      return
    }
    setLoading(true)
    debounceRef.current = window.setTimeout(() => {
      fetchJson<{ items: RecordHit[] }>(
        `/api/search?q=${encodeURIComponent(query)}&limit=12`,
      )
        .then((res) => setRecords(res.items ?? []))
        .catch(() => setRecords([]))
        .finally(() => setLoading(false))
    }, 220)
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
    }
  }, [q])

  useEffect(() => {
    setActive(0)
  }, [q, records.length, pages.length])

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(i + 1, Math.max(flat.length - 1, 0)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = flat[active]
      if (!item) return
      go(item.type === 'page' ? item.hit.path : item.hit.path)
    }
  }

  return (
    <div className={`gs${open ? ' is-open' : ''}`} ref={rootRef}>
      <label className="gs-bar" htmlFor={inputId}>
        <span className="gs-icon" aria-hidden>
          ⌕
        </span>
        <input
          id={inputId}
          ref={inputRef}
          className="gs-input"
          type="search"
          placeholder="Tìm trang, nhân viên, chính sách… (Ctrl+K)"
          value={q}
          autoComplete="off"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQ(e.target.value)
            setOpen(true)
          }}
          onKeyDown={onKeyDown}
        />
        <kbd className="gs-kbd">Ctrl K</kbd>
      </label>

      {open ? (
        <div className="gs-panel" role="listbox" aria-label="Gợi ý tìm kiếm">
          {!q.trim() ? (
            <div className="gs-section">
              <div className="gs-section-title">Gợi ý nhanh</div>
              <div className="gs-chips">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="gs-chip"
                    onClick={() => {
                      setQ(s)
                      inputRef.current?.focus()
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <div className="gs-section-title" style={{ marginTop: 12 }}>
                Trang thường dùng
              </div>
              <ul className="gs-list">
                {pages.map((hit, i) => (
                  <li key={hit.id}>
                    <button
                      type="button"
                      className={`gs-item${active === i ? ' is-active' : ''}`}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => go(hit.path)}
                    >
                      <span
                        className="gs-dot"
                        style={{ background: hit.moduleColor }}
                      />
                      <span className="gs-item-body">
                        <strong>{hit.title}</strong>
                        <small>
                          {hit.moduleName} · {hit.blurb}
                        </small>
                      </span>
                      <span className="gs-kind">Trang</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <>
              {pages.length > 0 ? (
                <div className="gs-section">
                  <div className="gs-section-title">Trang & module</div>
                  <ul className="gs-list">
                    {pages.map((hit, i) => (
                      <li key={`p-${hit.id}`}>
                        <button
                          type="button"
                          className={`gs-item${active === i ? ' is-active' : ''}`}
                          onMouseEnter={() => setActive(i)}
                          onClick={() => go(hit.path)}
                        >
                          <span
                            className="gs-dot"
                            style={{ background: hit.moduleColor }}
                          />
                          <span className="gs-item-body">
                            <strong>{hit.title}</strong>
                            <small>
                              {hit.moduleName} · {hit.blurb}
                            </small>
                          </span>
                          <span className="gs-kind">Trang</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="gs-section">
                <div className="gs-section-title">
                  Nội dung dữ liệu
                  {loading ? ' · đang tìm…' : ''}
                </div>
                {records.length === 0 && !loading ? (
                  <p className="gs-empty muted">
                    Không khớp nhân viên / chính sách / tin tuyển / khóa học.
                  </p>
                ) : (
                  <ul className="gs-list">
                    {records.map((hit, i) => {
                      const idx = pages.length + i
                      return (
                        <li key={`${hit.kind}-${hit.id}`}>
                          <button
                            type="button"
                            className={`gs-item${
                              active === idx ? ' is-active' : ''
                            }`}
                            onMouseEnter={() => setActive(idx)}
                            onClick={() => go(hit.path)}
                          >
                            <span className="gs-dot gs-dot--rec" />
                            <span className="gs-item-body">
                              <strong>{hit.title}</strong>
                              <small>{hit.subtitle || hit.path}</small>
                            </span>
                            <span className="gs-kind">
                              {KIND_LABEL[hit.kind] ?? hit.kind}
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}
