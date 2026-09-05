# Prueba real de análisis con proveedor

Usa esta guía después de desplegar. Crea una conexión de prueba con una API key válida en la interfaz. No copies la clave en tickets, capturas, logs ni este documento.

## Antes de empezar

- Confirma que la conexión está activa y que `Probar` responde correctamente.
- Crea o selecciona una colección con facturas XML válidas.
- Configura un contexto con perfil, período y propósito.
- Comprueba que existe evidencia oficial aplicable para el propósito y período.
- Abre el drawer `Historial` para observar el run después de enviarlo.

## Escenario 1: Declaración de IVA

1. Selecciona `Declaración de IVA` y un período que incluya la factura.
2. Analiza una factura de prueba.
3. Espera el estado `completed`.
4. En Historial, abre el run y luego la factura.

Debes ver el resultado especializado de IVA, razonamiento, incertidumbres cuando existan, referencias resumidas y el aviso de resultado orientativo. No debes ver XML, prompt, claves, UUIDs, hashes ni snapshots crudos.

## Escenario 2: IR de actividad

1. Selecciona `IR de actividad`.
2. Usa un perfil con RUC y al menos una actividad económica aplicable.
3. Analiza una factura de prueba y revisa el detalle en Historial.

Debes ver solo el resultado especializado de IR de actividad. El detalle debe identificar la actividad usada si el resultado la requiere y conservar el aviso de resultado orientativo.

## Escenario 3: Gastos personales

1. Selecciona `IR: gastos personales`.
2. Configura el período. Este propósito no exige actividad económica.
3. Analiza una factura y revisa el detalle.

Debes ver solo el resultado de gastos personales. Si el sistema necesita una revisión humana, debe mostrar `needs_review` y explicar qué validar sin presentar una conclusión fiscal definitiva.

## Fallos esperados

| Situación | Resultado esperado |
| --- | --- |
| Conexión inactiva o modelo distinto al fijado | Run `blocked`; no se llama al proveedor. |
| Contexto incompleto o sin evidencia aplicable | Run `blocked` con un mensaje seguro y una siguiente acción. |
| XML inválido | Run `blocked`; no entra a la cola. |
| Error del proveedor o red | Run `failed`; no aparece un resultado fiscal inventado. |

## Evidencia que debes revisar

- El Historial muestra propósito, período, proveedor/modelo, fecha, estado y conteo de facturas.
- La base conserva el run, sus resultados canónicos y referencias fijadas; no contiene `percentage` ni `reason` en `bills_header`.
- Los logs muestran el identificador operativo del run y el estado, sin API keys, XML, prompts ni contenido de referencias.
- El drawer conserva la navegación historial → run → factura → volver.
- El resultado y sus referencias corresponden al run fijado, no a material actualizado después.
- La UI no presenta el resultado como dictamen del SRI.

Si una prueba falla, conserva el ID visible del run solo en el canal de soporte autorizado. No adjuntes claves, XML ni contenido de referencias privadas.

Esta es una prueba manual con un proveedor real. Las pruebas automatizadas usan fixtures y providers simulados; no sustituyen esta comprobación.
