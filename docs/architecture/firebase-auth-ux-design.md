# Experiencia de sesión Firebase Auth

## Decisión

La autenticación cloud usa una tarjeta única, clara y serena. Está dirigida a
personas naturales que procesan sus propias facturas; por tanto, prioriza
lenguaje directo, una acción primaria por pantalla y estados explicativos. Se
implementa con componentes y props de Mantine existentes, sin CSS de
presentación nuevo.

Los modos locales no consumen estas rutas ni requieren autenticación.

## Alcance de identidad para el lanzamiento inicial

El lanzamiento inicia sin usuarios Clerk que preservar. Una sesión Firebase con
correo verificado crea transaccionalmente su `User` interno y su
`AuthIdentity(firebase, uid)` en el primer acceso protegido. No existe
dual-auth, backfill ni enlace por coincidencia de email en este lanzamiento;
esas operaciones quedan fuera de alcance y no se activan implícitamente.

## Composición

`AuthShell` centra un `Paper` de ancho legible dentro de un `Container`. El
contenido usa `Stack` con espaciado consistente y controles a ancho completo:

1. marca Bill-LM y etiqueta contextual ("Iniciar sesión" o "Crear cuenta");
2. título y una frase de ayuda breve;
3. formulario de correo/contraseña, con botón primario `fullWidth`;
4. divisor con el texto "o" y botón Google `fullWidth`;
5. enlaces secundarios para registro, acceso y recuperación.

El registro incorpora una línea de orientación, no un wizard: después de
crear la cuenta, el producto conducirá a conectar un proveedor LLM y definir
actividades económicas. No se solicita una API key durante el login.

## Estados y comportamiento

| Estado | Respuesta visible |
| --- | --- |
| carga inicial | indicador discreto; no se muestra contenido privado hasta conocer la sesión |
| enviando formulario | controles deshabilitados, botón con loader y ancho estable |
| credenciales inválidas | mensaje bajo el campo relevante, sin revelar si existe una cuenta |
| cuenta sin verificar | aviso accionable para reenviar el correo y continuar cuando se verifique |
| recuperación enviada | confirmación neutral, sin revelar si el correo está registrado |
| popup Google cancelado/bloqueado | aviso entendible y retorno al formulario |
| sesión válida | se obtiene ID token Firebase y se navega a la ruta privada solicitada |

Los mensajes de proveedor se traducen desde códigos Firebase hacia texto en
español antes de llegar a la UI. Los contratos de formulario, códigos y estado
se definen con Zod y los tipos se derivan mediante `z.infer`.

## Accesibilidad y detalle visual

Cada control tiene `label`, `description` o texto accesible. Los errores se
anuncian mediante la semántica nativa de Mantine y los enlaces conservan un
objetivo suficientemente grande. Los botones primarios y Google comparten el
ancho, el radio y la altura por medio de props Mantine; los márgenes y paddings
provienen de la escala de espaciado del tema. La jerarquía usa el tema actual,
sin una paleta o fuente paralela.

## Límite de la tarea

Esta tarea conecta la UI cloud con Firebase Auth y el Bearer de tRPC. No crea
el onboarding de proveedor/actividades ni modifica el visor local; ambos
consumirán sus flujos específicos en tareas posteriores.
