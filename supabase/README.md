# Supabase — puesta en marcha

> El proyecto original `nigxlspxlurdxvwnlffu` ya está reconstruido con estas migraciones
> (ver `legacy/20260925_rebuild_nigxlspxlurdxvwnlffu.md`). Estos pasos son para un proyecto nuevo.

El esquema anterior nunca se guardó en el repo. Esta carpeta lo reconstruye a partir del código de `/web` y `/agent`.

## 1. Crear el proyecto
1. supabase.com → New project. Región: la más cercana a México (p. ej. `us-west-1` o `us-east-1`).
2. Guardar la contraseña de la base en un gestor de contraseñas (no en el repo).

## 2. Cargar esquema y catálogo
En **SQL Editor**, ejecutar en este orden (copiar y pegar cada archivo):

1. `migrations/20260925000001_schema.sql`: tablas, categorías y subcategorías.
2. `migrations/20260925000002_rls_and_functions.sql`: seguridad, `apply_stock_movement` y buckets.
3. `migrations/20260925000003_roles_and_audit.sql`: roles del panel, bloqueo y bitácora.
4. `migrations/20260925000004_eleventa_sync.sql`: sincronización con Eleventa.
5. `migrations/20260925000005_hardening.sql`: endurecimiento según el linter de Supabase.
5. `seed_inventario.sql`: 2,395 productos. Todos entran con `is_approved = false`.

Los UUID de categorías en el esquema son los mismos del proyecto original, así que
`seed_inventario.sql` carga sin cambios.

## 3. Crear la cuenta de soporte (superadmin)
1. Authentication → Users → Add user (correo + contraseña).
2. En SQL Editor:
   ```sql
   UPDATE user_profiles SET role = 'superadmin'
   WHERE user_id = (SELECT id FROM auth.users WHERE email = 'correo@de-soporte.mx');
   ```
3. Entrar a `/admin/usuarios` y, desde ahí, dar de alta a la dueña (Administrador) y a los empleados.

| Rol | Puede |
|---|---|
| Empleado | Buscar productos, subir/importar foto, categoría, descripción, publicar |
| Administrador | Lo anterior + stock, precios, ofertas, bloqueo, pedidos, historial, alta de empleados |
| Superadmin | Lo anterior + página Sistema y asignar administradores |

## 4. Fotos de la sesión (bucket `lifestyle`)
Los originales están en `Recovered_Old_Data/Personal Media/Recovered Trash Photos/Juguetería El Arbolito/`
(JPG de ~20 MB). La web espera `lifestyle/dsc0xxxx.webp` en minúsculas
(lista en `web/src/lib/lifestyle-images.ts`). Convertirlos a WebP de ~1600 px antes de subirlos.

## 5. Variables en Vercel
Ver `web/.env.example`. El dominio de las fotos se toma de `NEXT_PUBLIC_SUPABASE_URL`
(no hay que editar código al cambiar de proyecto).

## 6. Que nunca se pause (plan gratuito)
Un proyecto gratuito se pausa tras ~7 días sin actividad. Dos cosas lo evitan:
- El agente de la tienda escribe cada 5 minutos.
- `web/vercel.json` llama `/api/cron/keepalive` a diario (requiere `CRON_SECRET` en Vercel).

## 7. Respaldos
El plan gratuito no trae respaldos restaurables. En el servidor, programar
`scripts/backup_db.sh` a diario (instrucciones dentro del script).
Cuando haya ventas reales, conviene el plan Pro: respaldos diarios y sin pausas.

## Qué NO está aquí todavía
- Tablas de cupones (`coupons`); la decisión existe (docs/09), el código aún no.
