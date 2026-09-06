# Smoke test LLM sin consumo

## Objetivo

Permitir validar el recorrido completo de análisis — gates, cola, worker,
snapshots, normalización y persistencia — sin enviar prompts ni realizar una
solicitud a OpenAI, Claude u otro proveedor. El operador activa este modo con
`LLM_SMOKE_TEST=true` en el entorno de **server y worker**; por ejemplo, en
los bloques `environment` de ambos servicios de `docker-compose`.

No sustituye una prueba real: al no contactar al proveedor, no confirma que
una API key esté vigente, tenga permisos o que el modelo esté disponible.

## Diseño

1. `LLM_SMOKE_TEST` será una variable exclusivamente de servidor, con parsing
   estricto de booleano. Ausente o `false` conserva el comportamiento actual.
   El server congela `execution.mode: 'smoke'` en el snapshot del run y el
   worker rechaza el run si su propia variable no coincide; esto evita un
   fallback accidental a una ejecución real.
2. El worker conserva todos los gates existentes y, cuando el modo esté
   activo, resuelve la conexión BYOK, descifra su secreto y construye el
   proveedor normal. Esto verifica el límite de secretos y la configuración
   local del cliente.
3. Antes de `AnalyzeBillsUseCase`, el worker envuelve ese proveedor en un
   adaptador de smoke. El adaptador nunca delega `process`, `isModelLoaded` ni
   `loadModel` al proveedor real: devuelve una carga fiscal determinista y
   válida por propósito.
4. Los resultados atraviesan el mismo normalizador y se persisten como un run
   normal. El `execution.mode` ya congelado se proyectará al historial como
   estado informativo, sin cambiar la clasificación fiscal ni presentar el
   resultado como una decisión real. No requiere una migración de base de
   datos porque el envelope ya es un snapshot JSON versionado.
5. El adaptador no incluirá API keys, prompt ni contenido de factura en logs.
   Si la configuración de smoke es inválida, el worker falla de manera clara y
   segura sin intentar un fallback al proveedor real.

## Alternativas descartadas

- **Crear solamente el cliente:** prueba menos partes del producto y no
  confirma que el contrato de salida, la cola y la persistencia sigan
  funcionando.
- **Probe mínimo al proveedor:** valida credenciales, pero genera tráfico y
  puede producir consumo; seguirá siendo una comprobación manual opcional.
- **Reutilizar `FAKE_ANALYZE`:** su semántica actual no es una respuesta
  fiscal simulada y mezclar ambos modos haría el despliegue ambiguo.

## Seguridad y operación

- Declarar la variable en runtime, nunca como `ARG` o `ENV` de build.
- Configurarla tanto en el servidor como en el worker que ejecutarán la
  prueba. Ambos valores deben coincidir para que el worker no bloquee el run.
- Mantener el mismo valor durante una ejecución completa. Para volver al modo
  real, quitarla o usar `LLM_SMOKE_TEST=false` y reiniciar el worker.
- La UI y el historial deberán etiquetar el run como simulado para evitar que
  se use como resultado tributario real.

Ejemplo de `docker-compose`:

```yaml
services:
  server:
    environment:
      LLM_SMOKE_TEST: 'true'
  worker:
    environment:
      LLM_SMOKE_TEST: 'true'
```

## Pruebas requeridas

- El parser acepta únicamente valores booleanos válidos y permanece apagado
  por defecto.
- Con smoke activo se crea el proveedor real, pero ningún método que pueda
  acceder a red es llamado.
- Cada propósito devuelve una carga que pasa el contrato y termina en un
  resultado persistible marcado como simulado.
- Sin smoke, el proveedor original llega sin envoltura y el comportamiento no
  cambia.
- Los docs diferencian la prueba sin consumo de la prueba real de proveedor.

## Fuera de alcance

No valida la key frente al proveedor, no mide latencia externa y no emite
resultados fiscales utilizables.
