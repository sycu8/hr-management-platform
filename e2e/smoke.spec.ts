import { expect, test } from '@playwright/test'
import { expectNoCrash, loginAs } from './helpers'

/** Route smoke inventory — Admin can open all primary nav destinations. */
const ADMIN_ROUTES = [
  '/',
  '/presence',
  '/alerts',
  '/events',
  '/employees',
  '/employees/jobs',
  '/employees/history',
  '/employees/docs',
  '/recruitment/jobs',
  '/recruitment/candidates',
  '/recruitment/onboarding',
  '/leave',
  '/leave/quota',
  '/attendance',
  '/leave/calendar',
  '/travel',
  '/travel/trips',
  '/travel/approvals',
  '/travel/settlements',
  '/travel/policy',
  '/travel/reports',
  '/payroll',
  '/payroll/payslips',
  '/payroll/allowances',
  '/payroll/insurance',
  '/performance/cycles',
  '/performance/okr',
  '/performance/360',
  '/performance/history',
  '/learning/courses',
  '/learning/progress',
  '/learning/certificates',
  '/learning/careers',
  '/policies/rules',
  '/policies/sop',
  '/policies/legal',
  '/admin/permissions',
  '/admin/security',
  '/admin/exports',
]

test.describe('Auth gates', () => {
  test('unauthenticated / redirects to login', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login/)
  })

  test('admin can log in', async ({ page }) => {
    await loginAs(page, 'admin')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expectNoCrash(page)
  })
})

test.describe('Admin route inventory', () => {
  test('opens core routes without crash', async ({ page }) => {
    await loginAs(page, 'admin')
    for (const route of ADMIN_ROUTES) {
      await page.goto(route)
      await expect(page).toHaveURL(
        new RegExp(route.replace(/\//g, '\\/') + '(?:\\?.*)?$'),
      )
      await expectNoCrash(page)
      await expect(page.locator('.page, .stack, .card').first()).toBeVisible()
    }
  })

  test('integrations page for admin does not crash', async ({ page }) => {
    await loginAs(page, 'admin')
    await page.goto('/admin/integrations')
    await expectNoCrash(page)
  })
})

test.describe('RBAC — payroll user', () => {
  test('can open payroll; employee create hidden', async ({ page }) => {
    await loginAs(page, 'payroll')
    await page.goto('/payroll')
    await expectNoCrash(page)
    await page.goto('/employees')
    await expect(page.getByRole('button', { name: /\+ Thêm nhân viên/i })).toHaveCount(0)
  })
})

test.describe('Global search', () => {
  test('suggests payroll page for keyword lương', async ({ page }) => {
    await loginAs(page, 'admin')
    await page.goto('/')
    const input = page.getByPlaceholder(/Tìm trang/i)
    await input.click()
    await input.fill('lương')
    await expect(page.getByRole('button', { name: /Bảng lương|Phiếu lương/i }).first()).toBeVisible({
      timeout: 10_000,
    })
    await page.getByRole('button', { name: /Bảng lương hàng tháng/i }).click()
    await expect(page).toHaveURL(/\/payroll/)
  })
})

test.describe('Payroll export', () => {
  test('CSV download buttons present when slips exist', async ({ page }) => {
    await loginAs(page, 'admin')
    await page.goto('/payroll')
    await expect(page.getByRole('button', { name: /Tải CSV/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Tải Excel/i })).toBeVisible()
  })
})

test.describe('OKR manager view', () => {
  test('year tab shows quarter table', async ({ page }) => {
    await loginAs(page, 'admin')
    await page.goto('/performance/okr')
    await page.getByRole('button', { name: /Theo năm/i }).click()
    await expect(page.getByText(/Tổng hợp theo quý/i)).toBeVisible()
  })
})

test.describe('Employees cards', () => {
  test('shows profile cards', async ({ page }) => {
    await loginAs(page, 'admin')
    await page.goto('/employees')
    await expect(page.locator('.emp-profile-card').first()).toBeVisible({
      timeout: 15_000,
    })
  })
})
