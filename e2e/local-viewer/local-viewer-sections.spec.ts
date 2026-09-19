import { expect, test } from '@playwright/test'

test('recorre las secciones locales y crea una colección aislada', async ({ page }, testInfo) => {
  await page.goto('/#/collections')

  await expect(page.getByRole('heading', { name: 'Colecciones', exact: true })).toBeVisible()
  await expect(page.getByText('No hay colecciones locales')).toBeVisible()

  await page.getByRole('button', { name: 'Nueva colección' }).click()
  await page.getByLabel('Nombre').fill('Evidencia navegador 2026')
  await page.getByLabel('Año').fill('2026')
  await page.getByRole('button', { name: 'Crear colección' }).click()

  await expect(page).toHaveURL(/#\/collections\/[0-9a-f-]{36}$/)
  await expect(page.getByText('Detalle de colección local')).toBeVisible()
  await expect(page.getByText('Contexto pendiente')).toBeVisible()

  await page.locator('nav').getByText('Perfiles y actividades', { exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Perfiles y actividades', exact: true })).toBeVisible()
  await expect(page.getByText('Aún no tienes actividades')).toBeVisible()
  await expect(page.getByText('Aún no tienes perfiles')).toBeVisible()

  await page.locator('nav').getByText('Configuración', { exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Configuración', exact: true })).toBeVisible()
  await expect(page.getByText(/Esta sección no inicia análisis ni usa servicios cloud/)).toBeVisible()

  await page.locator('nav').getByText('Fuentes oficiales', { exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Fuentes oficiales', exact: true }).first()).toBeVisible()
  await expect(page.getByText('Snapshot local de solo lectura')).toBeVisible()

  await page.locator('nav').getByText('Biblioteca local', { exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Biblioteca local', exact: true }).first()).toBeVisible()
  await expect(page.getByText('Colecciones', { exact: true })).toBeVisible()
  await expect(page.getByText('1', { exact: true })).toBeVisible()

  const screenshot = testInfo.outputPath('local-viewer-sections.png')
  await page.screenshot({ path: screenshot, fullPage: true })
  await testInfo.attach('local-viewer-sections', {
    contentType: 'image/png',
    path: screenshot,
  })
})
