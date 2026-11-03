# Manual de usuario — Usuarios

Este capítulo describe la pantalla de Usuarios, donde se crean las cuentas del sistema, se
cambian sus datos y su rol, se restablece su contraseña y se activan o desactivan. Las reglas
comunes (paneles, guardar, cancelar, confirmar y filtros) están en
[Cómo funcionan las pantallas](00-patrones.md).

**Dónde:** Usuarios, en el menú.
**Quién:** solo el administrador (ADMIN). El vendedor y el maestro de taller no ven la pantalla.

**Filtros:** búsqueda por nombre, usuario o correo, rol y estado.

## Crear un usuario

1. Pulsa **Nuevo usuario**. Se abre un panel sobre la lista.
2. Escribe los **nombres**, los **apellidos**, el **usuario** con el que entrará y su **correo**.
3. Elige el **rol**: administrador, vendedor o maestro de taller.
4. Escribe la **contraseña** y repítela en **Confirmar contraseña**.
5. Pulsa **Registrar usuario**.

La contraseña necesita al menos 8 caracteres, con una mayúscula, una minúscula, un número y un
carácter especial, y como máximo 72. Las tildes y la ñ cuentan doble: una contraseña con muchas
de ellas llega antes al máximo.

Si algo falla, el error aparece junto a su campo y el resto de lo escrito se conserva. Las dos
contraseñas, en cambio, siempre vuelven vacías y hay que escribirlas otra vez: el sistema nunca
devuelve una contraseña a la pantalla. No se pueden repetir el correo ni el usuario de otra
cuenta.

La cuenta nueva nace **activa**. Al guardar, el panel se cierra y aparece un solo aviso.

## Editar un usuario

Pulsa **Editar** en su fila. En el panel puedes cambiar los nombres, los apellidos, el usuario,
el correo y el rol. La contraseña y el estado no se cambian aquí: tienen su propio botón en la
lista.

Tu propia cuenta muestra el rol sin poder cambiarlo, para que el administrador no se quite el
acceso a esta pantalla.

## Restablecer la contraseña

1. Pulsa **Resetear contraseña** en la fila del usuario. Se abre una ventana con su nombre y su
   correo.
2. Escribe la **nueva contraseña** y repítela.
3. Pulsa **Restablecer contraseña**.

La contraseña anterior deja de funcionar en ese momento. Pero si el usuario ya tenía el sistema
abierto, esa sesión sigue abierta: restablecer no la cierra. Para cerrarla, desactiva al
usuario.

Si cierras la ventana después de escribir, pregunta si quieres descartar la contraseña nueva.

## Activar y desactivar

- **Desactivar** usa el botón rojo y pide confirmar. El usuario ya no puede iniciar sesión, y si
  estaba dentro del sistema, su sesión se corta en su siguiente acción.
- **Activar** se aplica al pulsar, sin confirmar.

Al terminar aparece un aviso y la fila cambia de botón. Cada cambio queda en la bitácora con
quien lo hizo.

No puedes desactivar tu propia cuenta: su botón **Desactivar** aparece apagado y no hace nada.
