# Manual Vivo

Plataforma web de procesos, procedimientos y onboarding para una Empresa. Proyecto de Título de Ingeniería en Informática (IPLACEX, 2026).

Estado: **Sprint 4 finalizado (09-11-2026)**. Incluye autenticación, cuentas, catálogos, procesos, procedimientos con versiones, consulta filtrada por permisos y búsqueda de texto completo.

## Author

Juan Sanhueza R.


## Tecnologías

| Capa | Tecnología |
|---|---|
| Presentación | Vue 3.5, Vite 7, Vue Router 4, Pinia 3, CSS3 propio |
| API | Node.js 22 LTS, NestJS 11, class-validator, JWT, bcrypt, Helmet, Throttler |
| Acceso a datos | Prisma ORM 6.19 |
| Datos | PostgreSQL 17 |
| Despliegue | Render (Web Service con Docker y Static Site) |


## Entorno y Usuarios de prueba

https://manual-vivo.onrender.com

Contraseña de las tres cuentas: `ManualVivo2026!`

| Perfil | Correo | Área | Nivel |
|---|---|---|---|
| Administrador | valentina.soto@recylink.test | Administración y Finanzas | Restringido |
| Editor | diego.munoz@recylink.test | Operaciones | Área |
| Colaborador | ignacia.perez@recylink.test | Operaciones | General |

Con el contenido semilla, Ignacia ve 3 procedimientos, Diego ve 4 y Valentina ve los 5.

## Correo

Render bloquea el envío por SMTP en el plan gratuito. Hasta definir un proveedor HTTPS (Sprint 6), los enlaces de invitación y de recuperación de contraseña se registran en el log de la API con el texto `Correo para`.
