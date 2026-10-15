import { useLocation } from 'react-router-dom'
import { pageTitle } from '../lib/nav'

/** Empty state only — no technical / infrastructure copy. */
export function PlaceholderPage({
  title,
  description = 'Module này chưa có dữ liệu hiển thị.',
}: {
  title?: string
  description?: string
}) {
  const { pathname } = useLocation()
  const heading = title ?? pageTitle(pathname)

  return (
    <div className="stack">
      <div className="card empty">
        <h2>{heading}</h2>
        <p>{description}</p>
      </div>
    </div>
  )
}
