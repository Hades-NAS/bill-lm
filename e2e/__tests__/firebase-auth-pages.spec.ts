import { expect, test } from '@playwright/test'

test('muestra una entrada de sesión clara con acciones de ancho completo', async ({
  page,
}) => {
  await page.goto('/sign-in')

  await expect(
    page.getByRole('heading', { name: 'Bienvenido de nuevo' }),
  ).toBeVisible()
  await expect(page.getByLabel('Correo electrónico')).toBeVisible()
  await expect(page.getByLabel('Contraseña')).toBeVisible()
  const continueButton = page.getByRole('button', {
    name: 'Continuar',
    exact: true,
  })
  await expect(continueButton).toHaveCSS(
    'width',
    await continueButton.evaluate(
      (element) => `${element.parentElement?.getBoundingClientRect().width}px`,
    ),
  )
  await expect(
    page.getByRole('button', { name: 'Continuar con Google' }),
  ).toBeVisible()
  await page.screenshot({
    path: 'test-evidences/firebase-sign-in.png',
    fullPage: true,
  })
})

test('muestra registro y recuperación con Firebase Auth', async ({ page }) => {
  await page.goto('/sign-up')
  await expect(
    page.getByRole('heading', { name: 'Empieza con tranquilidad' }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Crear cuenta' })).toBeVisible()

  await page.goto('/forgot-password')
  await expect(
    page.getByRole('heading', { name: 'Restablece tu contraseña' }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Enviar instrucciones' }),
  ).toBeVisible()
})
