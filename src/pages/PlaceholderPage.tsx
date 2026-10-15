import { useLocation } from 'react-router-dom'
import { pageTitle } from '../lib/nav'

/** Empty state only — no technical / infrastructure copy. */
export function PlaceholderPage({ title }: { title?: string }) {
  const { pathname } = useLocation()
  const heading = title ?? pageTitle(pathname)

  return (
    <div className="card empty">
      <h2>{heading}</h2>
      <p>Không có dữ liệu</p>
    </div>
  )
}
