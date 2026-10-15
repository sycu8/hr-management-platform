import { DataTablePage } from '../../components/DataTablePage'

type Course = {
  id: string
  title: string
  course_type: string
  hours: number
  mandatory: number
  skill: string | null
  provider: string | null
}

export function CoursesPage() {
  return (
    <DataTablePage<Course>
      title="Chương trình đào tạo"
      endpoint="/api/lists/courses"
      columns={[
        { key: 'title', header: 'Khóa học', render: (r) => r.title },
        { key: 'course_type', header: 'Loại', render: (r) => r.course_type },
        { key: 'hours', header: 'Giờ', render: (r) => r.hours, className: 'mono' },
        {
          key: 'mandatory',
          header: 'Bắt buộc',
          render: (r) => (r.mandatory ? 'Có' : 'Không'),
        },
        { key: 'skill', header: 'Kỹ năng', render: (r) => r.skill ?? '—' },
        { key: 'provider', header: 'Đơn vị', render: (r) => r.provider ?? '—' },
      ]}
    />
  )
}
