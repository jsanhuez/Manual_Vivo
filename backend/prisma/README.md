# Base de datos

PostgreSQL 17 con 14 tablas. La carpeta `database` de la raíz es un enlace a esta carpeta.

| Archivo | Uso |
|---|---|
| `migrations/0_init/migration.sql` | Crea las tablas, restricciones, índices, vistas y triggers |
| `schema.prisma` | Modelos de Prisma |
| `seed.sql` | Datos de prueba, se puede ejecutar más de una vez |
| `tests/` | Verificación de la base y prueba de volumen, deshacen sus cambios |

## Comandos

Desde `backend`, con la base definida en `.env`:

```bash
npx prisma migrate deploy   # crea la estructura
npm run db:seed             # carga los datos de prueba
```
