# Pruebas y evidencias

Estas reglas aplican a cualquier cambio de producto y, en particular, a la migración de autenticación Clerk a Firebase.

## Pruebas unitarias

- Usar Vitest para pruebas unitarias y de integración de código. Toda prueba nueva debe vivir en un directorio `__tests__` cercano al módulo que prueba; por ejemplo, `src/integrations/auth/__tests__/principal.test.ts`.
- Una corrección de autorización debe incluir casos de acceso permitido, acceso de otro usuario y entrada manipulada. Las pruebas no deben usar credenciales reales, tokens válidos ni datos personales.
- Ejecutar `bun run test` antes de cerrar una tarea que agregue o modifique pruebas. `health.sh` también ejecuta Vitest; mientras no haya archivos de prueba, informa expresamente ese vacío mediante la excepción de bootstrap `--passWithNoTests`.

## Pruebas de navegador y capturas

- Escribir pruebas E2E con la librería Playwright y guardarlas también dentro de un directorio `__tests__`. No se aceptan flujos de navegador hechos manualmente como sustituto de una prueba reproducible.
- Instalar o configurar Playwright solo en la tarea que implemente E2E, después de revisar el lockfile y las necesidades de CI. Las pruebas deben controlar sus datos y no apuntar a Firebase de producción.
- Guardar cada captura tomada por Playwright como evidencia bajo `test-evidences/`, con una ruta y nombre deterministas por flujo, por ejemplo `test-evidences/auth/login-email-success.png`.
- No guardar en evidencias tokens, contraseñas, emails reales, IDs de usuarios, claves privadas, secretos de Firebase ni otra PII. Usar cuentas y datos de prueba controlados.

## Límite de evidencia

Un typecheck, build o test unitario exitoso no demuestra por sí solo el comportamiento de Firebase, Firestore, un proveedor OAuth ni un despliegue. La tarea debe declarar qué ejecutó y qué superficie queda pendiente de validar.
