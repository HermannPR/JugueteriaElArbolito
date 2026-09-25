# Reconstrucción del proyecto original (2026-09-25)

El proyecto `nigxlspxlurdxvwnlffu` estaba pausado, no borrado. Al reactivarlo tenía el
esquema de la versión anterior del proyecto, con un hoyo grave: las reglas de administrador
confiaban en `user_metadata.is_admin`, que cualquier usuario puede editarse, y funciones
de stock ejecutables sin sesión. El linter de Supabase lo marcaba como ERROR.

Pasos aplicados (vía Supabase MCP, decisión de Hermann):

1. **Copia interna** `legacy_20260925` (no expuesta por la API): products, eleventa_catalog,
   categories, subcategories, user_profiles, orders, store_settings.
   Respaldo adicional fuera del repo: `../JugueteriaElArbolito-backups/supabase-legacy-2026-09-25.json`.
2. **Reset** (`reset_legacy_public`): se borraron las 15 tablas viejas de `public`, sus
   funciones, el trigger `on_auth_user_created` y las políticas viejas de `storage.objects`.
   Se borraron 6 cuentas de prueba y el pedido de prueba de junio.
   **No se tocó:** `auth.users` restantes, buckets ni los 38 archivos (30 fotos de la sesión y 8 de categorías).
3. **Migraciones 0001–0004** de `supabase/migrations/`.
4. **Restauración** desde `legacy_20260925`: mismos IDs de producto, categoría y subcategoría;
   imágenes de categorías; 8 destacados; ajustes de la tienda.
   Los 201 productos que estaban "aprobados" sin foto quedaron **sin publicar** (regla nueva:
   no se publica sin foto). Su lista sigue en `legacy_20260925.products` (`is_approved = true`).
5. Roles: `hermannjuegos@outlook.com` → superadmin; `admin@elarbolito.com` → admin (la dueña).

La copia `legacy_20260925` se puede borrar cuando el sitio nuevo esté verificado:
`DROP SCHEMA legacy_20260925 CASCADE;`
