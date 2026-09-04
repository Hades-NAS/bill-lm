# Navegación, cuenta y fuentes oficiales

Fecha: 2026-09-04

## Navegación

En escritorio, la aplicación usa una barra lateral fija y visible con Inicio,
Colecciones, Perfiles y actividades, Configuración, Fuentes oficiales y Mi
cuenta. El botón de navegación del header se elimina. En móvil no se muestra
la barra lateral y se conserva navegación compacta.

## Mi cuenta

La ruta muestra avatar Google o iniciales, nombre y correo; incluye cerrar
sesión y zona de peligro. El borrado requiere confirmación y elimina datos
dependientes en una transacción antes del registro `User`; Firebase se elimina
solo después. Los fallos no exponen restricciones ni secretos.

## Fuentes oficiales

La ruta lista solo fuentes y fragmentos publicados de la DB, nunca `.cache`.
Cada tarjeta abre un Drawer derecho con scroll, fuente, URL, estado, hash,
vigencia, rulesets vinculados y fragmentos. No sincroniza estado con URL.

## Pruebas

- navegación desktop y mobile;
- autorización, orden de borrado y mensajes seguros;
- confirmación de UI;
- lista sin datos de caché;
- Drawer derecho con fuente publicada.
