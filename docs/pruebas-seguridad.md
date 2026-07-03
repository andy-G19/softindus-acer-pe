# Pruebas manuales de seguridad

> Nota tecnica: cerrar el navegador no invalida necesariamente el JWT de Auth.js. La seguridad funcional se controla con logout manual, expiracion maxima de sesion y cierre por inactividad.

1. Usuario no autenticado intenta entrar a `/dashboard`: debe redirigir a `/login`.
2. Usuario autenticado intenta entrar a `/login`: debe redirigir a `/dashboard`.
3. Usuario `SELLER` intenta entrar a `/dashboard/users`: debe redirigir a `/dashboard/access-denied`.
4. Usuario `WORKSHOP_MASTER` intenta entrar a `/dashboard/commercial`: debe redirigir a `/dashboard/access-denied`.
5. Usuario `ADMIN` accede a todos los modulos principales del dashboard.
6. Sesion inactiva por 30 minutos en una pantalla privada: debe cerrar sesion y redirigir a `/login?reason=idle`.
7. API de reportes sin sesion, por ejemplo `/api/reports/export/financial`: debe devolver `401`.
8. API de reportes con rol no permitido, por ejemplo `SELLER` en `/api/reports/export/financial`: debe devolver `403`.
9. Cierre de navegador y reapertura antes de la expiracion maxima: debe mantener la sesion si el token sigue vigente.
10. Despues del tiempo maximo de sesion de 8 horas: debe pedir login nuevamente.
