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

## Historial seguro

La API de historial pagina las ejecuciones por fecha de creación e identificador
para conservar un orden estable. El detalle se autoriza primero contra la
colección activa de la persona autenticada; una colección archivada o ajena no
expone su historial.

Las respuestas muestran solo una proyección segura del snapshot fijado: contexto
tributario, proveedor/modelo, versión del ruleset y resultados especializados.
No devuelven Markdown de evidencia oficial o referencias personales, notas,
datos adicionales del perfil ni el contenido normalizado de la factura. Si un
snapshot histórico no puede validarse, se muestra como no disponible sin revelar
su JSON ni el error interno.

En una colección, el botón **Historial** abre un drawer lateral derecho. Permite
recorrer las ejecuciones con **Ver más** y consultar un resumen seguro del run
seleccionado sin salir de las facturas. El detalle especializado por factura se
presenta por separado.
