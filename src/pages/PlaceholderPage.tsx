import { useLocation } from 'react-router-dom'
import { pageTitle } from '../lib/nav'

export function PlaceholderPage({
  title,
  description,
}: {
  title?: string
  description?: string
}) {
  const { pathname } = useLocation()
  const heading = title ?? pageTitle(pathname)

  return (
    <div className="card empty">
      <h2>{heading}</h2>
      <p>
        {description ??
          'Màn hình đang được kết nối API dùng chung (D1). Dữ liệu mẫu cục bộ đã được thay bằng kho dùng chung và đăng nhập Access.'}
      </p>
    </div>
  )
}
