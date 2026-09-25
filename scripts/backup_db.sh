#!/usr/bin/env bash
# Respaldo diario de la base de Supabase (el plan gratuito no trae respaldos restaurables).
#
# Uso (en el servidor, desde cron):
#   SUPABASE_DB_URL='postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres' \
#   BACKUP_DIR=/srv/backups/arbolito KEEP_DAYS=30 ./scripts/backup_db.sh
#
#   crontab:  30 9 * * *  /ruta/scripts/backup_db.sh >> /var/log/arbolito-backup.log 2>&1
#
# SUPABASE_DB_URL: Supabase → Connect → "Session pooler" (puerto 5432).
# Requiere pg_dump de la misma versión mayor que el Postgres del proyecto.
# Restaurar:  pg_restore --clean --if-exists --no-owner -d "$DB_URL" <archivo.dump>
#
# Ojo: esto respalda la BASE (pedidos, productos, usuarios). Los archivos de
# Storage (fotos) no están en la base; esos se respaldan aparte.
set -euo pipefail

: "${SUPABASE_DB_URL:?Falta SUPABASE_DB_URL}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
KEEP_DAYS="${KEEP_DAYS:-30}"

mkdir -p "$BACKUP_DIR"
file="$BACKUP_DIR/arbolito-$(date -u +%Y%m%d-%H%M%S).dump"

# public = datos de la tienda; auth = cuentas (admins incluidos).
pg_dump "$SUPABASE_DB_URL" --format=custom --no-owner --no-privileges \
  --schema=public --schema=auth --file="$file.partial"
mv "$file.partial" "$file"

# Un respaldo de 0 bytes no es respaldo.
[ -s "$file" ] || { echo "ERROR: respaldo vacío: $file" >&2; exit 1; }

find "$BACKUP_DIR" -name 'arbolito-*.dump' -mtime +"$KEEP_DAYS" -delete
echo "$(date -u +%FT%TZ) OK $file ($(du -h "$file" | cut -f1))"
