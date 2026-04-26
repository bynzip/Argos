#!/bin/bash
# Script de backup automtico para Argos ERP
# Se recomienda configurar este script en crontab para ejecutarse diariamente (ej. a las 11:00 PM)

# Configuracion
FECHA=$(date +%Y%m%d)
BACKUP_DIR="/var/backups/argos"
DB_NAME="argos_db"
MEDIA_DIR="/var/www/argos/backend/media"
DB_USER="postgres"

# Crear directorio de backup si no existe
mkdir -p "$BACKUP_DIR"

# Nombres de archivos finales
BACKUP_DB_FILE="$BACKUP_DIR/db_$FECHA.sql"
BACKUP_MEDIA_FILE="$BACKUP_DIR/media_$FECHA.tar.gz"

# 1. Idempotencia: Verificar si el backup de hoy ya existe
if [ ! -f "$BACKUP_DB_FILE" ]; then
    echo "Iniciando respaldo de base de datos..."
    pg_dump -U "$DB_USER" "$DB_NAME" > "$BACKUP_DB_FILE"
    echo "Respaldo BD completado: $BACKUP_DB_FILE"
else
    echo "El respaldo de BD para hoy ($FECHA) ya existe."
fi

# 2. Respaldar archivos (Vouchers, Fotos de Equipos)
if [ ! -f "$BACKUP_MEDIA_FILE" ]; then
    if [ -d "$MEDIA_DIR" ]; then
        echo "Iniciando compresión de archivos multimedia..."
        tar -czf "$BACKUP_MEDIA_FILE" -C "$MEDIA_DIR" .
        echo "Respaldo multimedia completado: $BACKUP_MEDIA_FILE"
    else
        echo "Directorio de media no encontrado en $MEDIA_DIR. Omitiendo respaldo de archivos."
    fi
else
    echo "El respaldo de archivos para hoy ($FECHA) ya existe."
fi

# 3. Rotación de Backups (Limpiar backups con más de 30 días de antigüedad)
echo "Limpiando respaldos antiguos (>30 días)..."
find "$BACKUP_DIR" -type f -name "*.sql" -mtime +30 -exec rm {} \;
find "$BACKUP_DIR" -type f -name "*.tar.gz" -mtime +30 -exec rm {} \;

echo "Proceso de backup finalizado."
