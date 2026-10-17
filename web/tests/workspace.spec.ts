import { expect, test } from '@playwright/test'

test('site selection scopes transactions and All Sites shows each once', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /Good morning/ })).toBeVisible()

  await page.getByRole('button', { name: /All sites/ }).click()
  await page.getByRole('menuitem', { name: /Northstar Studio/ }).click()
  await expect(page.getByRole('heading', { name: 'Northstar Studio' })).toBeVisible()

  await page.getByRole('button', { name: /New transaction/ }).click()
  await page.getByLabel('Description').fill('Playwright site-scoped income')
  await page.getByLabel('Amount').fill('1234.56')
  await page.getByLabel('Received').fill('1200.00')
  await page.getByLabel('Customer / vendor').fill('Browser test client')
  await page.getByRole('button', { name: 'Save transaction' }).click()
  await expect(page.getByText('Playwright site-scoped income')).toBeVisible()

  await page.getByRole('button', { name: /Northstar Studio/ }).click()
  await page.getByRole('menuitem', { name: /All sites/ }).click()
  await expect(page.getByText('Playwright site-scoped income')).toHaveCount(1)

  await page.getByRole('button', { name: /All sites/ }).click()
  await page.getByRole('menuitem', { name: /Fieldwork Co/ }).click()
  await expect(page.getByRole('heading', { name: 'Fieldwork Co.' })).toBeVisible()
  await expect(page.getByText('Playwright site-scoped income')).toHaveCount(0)
})

test('opens transaction form at a narrow viewport', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /Good morning/ })).toBeVisible()
  await page.getByRole('button', { name: /New transaction/ }).click()
  await expect(page.getByRole('heading', { name: 'New transaction' })).toBeVisible()
  await expect(page.getByLabel('Site')).toBeVisible()
})
