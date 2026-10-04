import { expect, test } from '@playwright/test'

test('recorre las secciones locales y crea una colección aislada', async ({ page }, testInfo) => {
  await page.goto('/#/collections')

  await expect(page.getByRole('heading', { name: 'Colecciones', exact: true })).toBeVisible()
  await expect(page.getByText('Colección Alfa')).toBeVisible()

  await page.getByRole('button', { name: 'Nueva colección' }).click()
  const createDialog = page.getByRole('dialog', { name: 'Nueva colección local' })
  await createDialog.getByLabel('Nombre', { exact: true }).fill('Evidencia navegador 2026')
  await createDialog.getByLabel('Año', { exact: true }).fill('2026')
  await createDialog.getByRole('button', { name: 'Crear colección' }).click()

  await expect(page).toHaveURL(/#\/collections\/[0-9a-f-]{36}$/)
  await expect(page.getByRole('heading', { name: 'Evidencia navegador 2026' })).toBeVisible()
  await expect(page.getByText('Contexto pendiente')).toBeVisible()

  await page.locator('nav').getByText('Perfiles y actividades', { exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Perfiles y actividades', exact: true })).toBeVisible()
  await expect(page.getByText('Actividad sintética', { exact: true })).toBeVisible()
  await expect(page.getByText('Perfil sintético · Sin RUC', { exact: true })).toBeVisible()

  await page.locator('nav').getByText('Configuración', { exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Configuración', exact: true })).toBeVisible()
  await expect(page.getByText(/host OpenAI-like o Claude-like disponible en este equipo/)).toBeVisible()

  await page.locator('nav').getByText('Fuentes oficiales', { exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Fuentes oficiales', exact: true }).first()).toBeVisible()
  await expect(page.getByText('Snapshot local de solo lectura')).toBeVisible()

  await page.locator('nav').getByText('Biblioteca local', { exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Biblioteca local', exact: true }).first()).toBeVisible()
  await expect(page.getByRole('main').getByText('Colecciones', { exact: true })).toBeVisible()
  await expect(page.getByRole('main').getByText('3', { exact: true })).toBeVisible()

  const screenshot = testInfo.outputPath('local-viewer-sections.png')
  await page.screenshot({ path: screenshot, fullPage: true })
  await testInfo.attach('local-viewer-sections', {
    contentType: 'image/png',
    path: screenshot,
  })
})

test('selecciona un XML desde el dropzone local y muestra su resultado por archivo', async ({ page }) => {
  await page.goto('/#/collections/00000000-0000-4000-8000-000000000001')
  await page.getByRole('button', { name: 'Subir facturas' }).click()
  const dialog = page.getByRole('dialog', { name: 'Subir facturas XML' })
  await dialog.locator('input[type="file"]').setInputFiles({
    name: 'no-es-factura.xml',
    mimeType: 'application/xml',
    buffer: Buffer.from('<factura/>'),
  })
  await expect(dialog.getByText('no-es-factura.xml')).toBeVisible()
  await dialog.getByRole('button', { name: 'Importar 1 archivo' }).click()
  await expect(dialog.getByText('El XML no contiene una factura autorizada y válida del SRI.')).toBeVisible()
})
