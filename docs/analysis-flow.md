# Flujo de análisis tributario

Cada análisis se ejecuta desde una colección con un contexto fijado. El sistema
no vuelve a consultar reglas, referencias ni datos de perfil después de crear la
ejecución.

1. El usuario configura propósito, período, perfil tributario y actividades.
2. El servidor valida los requisitos, selecciona el ruleset oficial vigente y
   crea un envelope inmutable con facturas normalizadas, evidencia oficial y
   referencias autogestionadas.
3. Se guarda un `AnalysisRun` y un snapshot por factura antes de enviar el
   trabajo a la cola.
4. El worker vuelve a validar el envelope, la conexión de proveedor fijada y
   la disponibilidad de las facturas. Si falla un requisito, bloquea el run sin
   descifrar una clave ni llamar al modelo.
5. El proveedor recibe un prompt construido solo desde el envelope y devuelve
   el contrato especializado del propósito: IVA, impuesto a la renta de
   actividad o gastos personales.
6. El servidor valida la respuesta y persiste un `AnalysisResult` por factura
   con propósito, clasificación, evidencia y referencias utilizadas.

Los resultados son orientativos. No constituyen un dictamen jurídico ni una
determinación del SRI.

## Estados

- `queued`: el envelope fue aceptado y espera procesamiento.
- `running`: el worker está procesando facturas del run.
- `completed`: se persistieron los resultados de las facturas procesadas.
- `failed`: ocurrió un error operativo durante el procesamiento.
- `blocked`: faltan requisitos o el envelope dejó de ser ejecutable; no se
  invoca al proveedor.

El progreso operativo del trabajo se publica en Firestore. El historial y el
detalle de cada factura leen los resultados persistidos de `AnalysisRun` y
`AnalysisResult`.
