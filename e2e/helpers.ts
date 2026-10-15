import { expect, type Page } from '@playwright/test'

/** Demo accounts — sanitized local seed only. */
export const ACCOUNTS = {
  admin: {
    email: 'admin@orangecloud.vn',
    password: 'Admin!2026',
  },
  payroll: {
    email: 'user.luong@orangecloud.vn',
    password: 'User!2026',
  },
  recruiting: {
    email: 'user.tuyendung@orangecloud.vn',
    password: 'User!2026',
  },
  super: {
    email: 'super@orangecloud.vn',
    password: 'SuperAdmin!2026',
  },
} as const

export async function loginAs(
  page: Page,
  account: keyof typeof ACCOUNTS,
) {
  const { email, password } = ACCOUNTS[account]
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Mật khẩu').fill(password)

  // Cloudflare always-pass test sitekey auto-completes; wait until submit enabled.
  const submit = page.getByRole('button', { name: /Đăng nhập/i })
  await expect
    .poll(async () => submit.isEnabled(), { timeout: 45_000 })
    .toBe(true)

  // Ensure widget emitted a token before submit.
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const api = (
            window as unknown as {
              turnstile?: { getResponse: (id?: string) => string }
            }
          ).turnstile
          try {
            return Boolean(api?.getResponse())
          } catch {
            return false
          }
        }),
      { timeout: 45_000 },
    )
    .toBe(true)

  await submit.click()
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 })
}

export async function expectNoCrash(page: Page) {
  await expect(page.locator('body')).toBeVisible()
  const emptyCrash = page.getByText(/Internal server error|Unexpected Application Error/i)
  await expect(emptyCrash).toHaveCount(0)
}
