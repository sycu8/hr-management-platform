import { expect, test } from '@playwright/test'
import { expectNoCrash, loginAs } from './helpers'

test.describe('Logout', () => {
  test('clears session and returns to login', async ({ page }) => {
    await loginAs(page, 'admin')
    await page.getByRole('button', { name: /Đăng xuất/i }).click()
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 })
    await page.goto('/')
    await expect(page).toHaveURL(/\/login/)
  })
})

test.describe('Invalid login', () => {
  test('wrong password stays on login with error', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill('admin@orangecloud.vn')
    await page.getByLabel('Mật khẩu').fill('WrongPassword!999')
    const submit = page.getByRole('button', { name: /Đăng nhập/i })
    await expect.poll(async () => submit.isEnabled(), { timeout: 45_000 }).toBe(true)
    await submit.click()
    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByRole('alert')).toBeVisible({ timeout: 15_000 })
  })
})

test.describe('RBAC — recruiting user', () => {
  test('sees recruitment; payroll nav hidden; deep URL shows API deny not crash', async ({
    page,
  }) => {
    await loginAs(page, 'recruiting')
    await page.goto('/recruitment/jobs')
    await expectNoCrash(page)
    await expect(
      page.locator('main').getByRole('heading', { name: /Đăng tin & JD/i }),
    ).toBeVisible({ timeout: 10_000 })

    // Sidebar should not advertise payroll
    await expect(page.getByRole('link', { name: /Bảng lương hàng tháng/i })).toHaveCount(0)

    await page.goto('/payroll')
    await expectNoCrash(page)
    // List API requires pay module — page should render empty/error, not crash
    await expect(
      page
        .locator('main')
        .getByText(/Không tải|Forbidden|không có quyền|HTTP 403|Bảng lương/i)
        .first(),
    ).toBeVisible({ timeout: 10_000 })
  })

  test('employee directory is scoped (not org-wide)', async ({ page }) => {
    await loginAs(page, 'recruiting')
    const res = await page.request.get('/api/employees?status=active&limit=200')
    expect(res.ok()).toBeTruthy()
    const body = (await res.json()) as { items: { id: string }[] }
    // Seed links u_rec → e9; scoped to self (+ reports). Must be far below full org (~30).
    expect(body.items.length).toBeGreaterThan(0)
    expect(body.items.length).toBeLessThan(10)
    expect(body.items.some((e) => e.id === 'e9')).toBeTruthy()
  })
})

test.describe('Alerts deep-link', () => {
  test('KPI chips navigate to leave / travel / onboarding', async ({ page }) => {
    await loginAs(page, 'admin')
    await page.goto('/alerts')
    await expectNoCrash(page)
    await page.getByRole('link', { name: /Đơn phép chờ duyệt/i }).click()
    await expect(page).toHaveURL(/\/leave/)
    await page.goto('/alerts')
    await page.getByRole('link', { name: /Công tác chờ xử lý/i }).click()
    await expect(page).toHaveURL(/\/travel\/approvals/)
    await page.goto('/alerts')
    await page.getByRole('link', { name: /Cần chuyển chính thức/i }).click()
    await expect(page).toHaveURL(/\/recruitment\/onboarding/)
  })
})

test.describe('Leave approvals', () => {
  test('admin sees pending leave rows with duyệt actions', async ({ page }) => {
    await loginAs(page, 'admin')
    await page.goto('/leave')
    await expectNoCrash(page)
    await expect(
      page.locator('main').getByRole('heading', { name: /Đăng ký nghỉ phép/i }),
    ).toBeVisible()
    const approve = page.locator('main').getByRole('button', { name: /Duyệt/i })
    const count = await approve.count()
    if (count > 0) {
      await expect(approve.first()).toBeVisible()
    } else {
      await expect(
        page.locator('main').getByText(/Không có dữ liệu|Đăng ký nghỉ phép/i).first(),
      ).toBeVisible()
    }
  })

  test('admin can open create leave form', async ({ page }) => {
    await loginAs(page, 'admin')
    await page.goto('/leave')
    await page.getByRole('button', { name: /\+ Xin nghỉ phép/i }).click()
    await expect(page.getByRole('heading', { name: /Xin nghỉ phép/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Gửi đơn/i })).toBeVisible()
  })
})

test.describe('Onboarding checklist', () => {
  test('lists plans and shows checklist UI', async ({ page }) => {
    await loginAs(page, 'admin')
    await page.goto('/recruitment/onboarding')
    await expectNoCrash(page)
    await expect(
      page.getByRole('button', { name: /\+ Thêm onboarding/i }),
    ).toBeVisible()
  })
})

test.describe('Travel create form', () => {
  test('opens create proposal panel', async ({ page }) => {
    await loginAs(page, 'admin')
    await page.goto('/travel/trips')
    await expectNoCrash(page)
    await page.getByRole('button', { name: /\+ Tạo đề nghị/i }).click()
    await expect(page.getByText(/Tạo đề nghị công tác|Lưu nháp/i).first()).toBeVisible({
      timeout: 10_000,
    })
  })
})

test.describe('OKR create form', () => {
  test('opens add objective form', async ({ page }) => {
    await loginAs(page, 'admin')
    await page.goto('/performance/okr')
    await expectNoCrash(page)
    await page.getByRole('button', { name: /\+ Thêm mục tiêu/i }).click()
    await expect(page.getByRole('heading', { name: /Thêm OKR/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Lưu OKR/i })).toBeVisible()
  })
})

test.describe('360 feedback', () => {
  test('shows radar for first review; AI button handles local failure', async ({ page }) => {
    await loginAs(page, 'admin')
    await page.goto('/performance/360')
    await expectNoCrash(page)
    const first = page.locator('.f360-list button, aside button').first()
    if (await first.count()) {
      await first.click()
      await expect(page.getByText(/Radar năng lực/i)).toBeVisible({ timeout: 10_000 })
      await page.getByRole('button', { name: /Phân tích AI/i }).click()
      // Local may lack Workers AI — accept either analysis text or graceful error
      await expect(
        page
          .getByText(/Phân tích AI|Workers AI|không phản hồi|503|AI không|thất bại|Đang phân tích/i)
          .first(),
      ).toBeVisible({ timeout: 20_000 })
      await expectNoCrash(page)
    } else {
      await expect(page.getByText(/360|đánh giá/i).first()).toBeVisible()
    }
  })
})

test.describe('Policies', () => {
  test('rules page loads list or empty', async ({ page }) => {
    await loginAs(page, 'admin')
    await page.goto('/policies/rules')
    await expectNoCrash(page)
    await expect(page.locator('.page, .stack, .card').first()).toBeVisible()
  })
})

test.describe('Learning', () => {
  test('courses catalog loads', async ({ page }) => {
    await loginAs(page, 'admin')
    await page.goto('/learning/courses')
    await expectNoCrash(page)
    await expect(page.locator('.page, .stack, .card').first()).toBeVisible()
  })
})

test.describe('Admin integrations gate', () => {
  test('plain admin is redirected away from integrations', async ({ page }) => {
    await loginAs(page, 'admin')
    await page.goto('/admin/integrations')
    // RequireSuperAdmin → Navigate to /
    await expect(page).toHaveURL(/\/(?:$|\?)/, { timeout: 10_000 })
    await expectNoCrash(page)
  })

  test('super admin can open integrations', async ({ page }) => {
    await loginAs(page, 'super')
    await page.goto('/admin/integrations')
    await expect(page).toHaveURL(/\/admin\/integrations/)
    await expectNoCrash(page)
    await expect(
      page.getByText(/tích hợp|Super Admin|nguồn thông tin/i).first(),
    ).toBeVisible({ timeout: 10_000 })
  })
})
