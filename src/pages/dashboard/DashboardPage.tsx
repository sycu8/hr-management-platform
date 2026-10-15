export function DashboardPage() {
  return (
    <div className="stack">
      <div className="grid g4">
        <div className="tile">
          <div className="v">—</div>
          <div className="muted small">Nhân sự đang làm việc</div>
        </div>
        <div className="tile">
          <div className="v">—</div>
          <div className="muted small">Hiện diện hôm nay</div>
        </div>
        <div className="tile">
          <div className="v">—</div>
          <div className="muted small">Tỷ lệ nghỉ việc 12 tháng</div>
        </div>
        <div className="tile">
          <div className="v">—</div>
          <div className="muted small">Việc cần xử lý</div>
        </div>
      </div>

      <div className="grid g2">
        <div className="card">
          <h2>Nhân sự theo phòng ban</h2>
          <div className="empty">Chưa có dữ liệu từ kho dùng chung.</div>
        </div>
        <div className="card">
          <h2>Hôm nay</h2>
          <div className="empty">Chưa có dữ liệu chấm công / công tác.</div>
        </div>
      </div>

      <div className="grid g2">
        <div className="card">
          <h2>Cảnh báo & nhắc việc</h2>
          <div className="empty">Không có cảnh báo.</div>
        </div>
        <div className="card">
          <h2>Sự kiện sắp tới</h2>
          <div className="empty">Chưa có sự kiện.</div>
        </div>
      </div>

      <p className="ex">
        Ngày hệ thống dùng ngày hiện tại thật. Dữ liệu mẫu chỉ dùng cho môi trường
        demo; sản xuất yêu cầu Cloudflare Access và tham số lương đã được phê duyệt.
      </p>
    </div>
  )
}
