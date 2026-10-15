import { useEffect, useState } from 'react'
import { fetchJson } from '../../lib/api'

type Doc = {
  id: string
  type_name: string
  file_name: string
  issued_on: string | null
  expires_on: string | null
  employee_name: string
  employee_code: string
  has_file?: boolean
}

export function DocumentsPage() {
  const [items, setItems] = useState<Doc[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchJson<{ items: Doc[] }>('/api/lists/documents')
      .then((r) => {
        if (!cancelled) {
          setItems(r.items ?? [])
          setError(null)
        }
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : 'Không tải được')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div className="card empty">
        <h2>Tài liệu nhân sự</h2>
        <p>Đang tải…</p>
      </div>
    )
  }
  if (error) {
    return (
      <div className="card empty">
        <h2>Tài liệu nhân sự</h2>
        <p>{error}</p>
      </div>
    )
  }

  return (
    <div className="card">
      <h2>Tài liệu nhân sự ({items.length})</h2>
      {items.length === 0 ? (
        <p>Không có dữ liệu</p>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Mã</th>
                <th>Nhân viên</th>
                <th>Loại</th>
                <th>Tệp</th>
                <th>Cấp</th>
                <th>Hết hạn</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{r.employee_code}</td>
                  <td>{r.employee_name}</td>
                  <td>{r.type_name}</td>
                  <td>{r.file_name}</td>
                  <td>{r.issued_on ?? '—'}</td>
                  <td>{r.expires_on ?? '—'}</td>
                  <td>
                    {r.has_file ? (
                      <a
                        className="btn ghost"
                        href={`/api/documents/${r.id}/download`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Tải xuống
                      </a>
                    ) : (
                      <span className="muted small">Chưa có file</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
