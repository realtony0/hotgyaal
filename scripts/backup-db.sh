#!/usr/bin/env bash
# Backup complet de la base Supabase via pg_dump.
#
# Prerequisites:
#   - pg_dump installe (brew install postgresql@16)
#   - .env.local contient SUPABASE_DB_URL et SUPABASE_DB_PASSWORD
#
# Usage:
#   ./scripts/backup-db.sh
#   ./scripts/backup-db.sh --data-only
#   ./scripts/backup-db.sh --schema-only

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env.local"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Erreur: $ENV_FILE introuvable."
  echo "Cree-le avec:"
  echo '  SUPABASE_DB_URL="postgresql://postgres.XXX@aws-1-REGION.pooler.supabase.com:5432/postgres"'
  echo '  SUPABASE_DB_PASSWORD="ton_mot_de_passe"'
  exit 1
fi

# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a

if [[ -z "${SUPABASE_DB_URL:-}" || -z "${SUPABASE_DB_PASSWORD:-}" ]]; then
  echo "Erreur: SUPABASE_DB_URL et SUPABASE_DB_PASSWORD doivent etre definis dans .env.local"
  exit 1
fi

BACKUP_DIR="$ROOT_DIR/backups"
mkdir -p "$BACKUP_DIR"

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
MODE="${1:-full}"

case "$MODE" in
  --data-only)
    OUTPUT="$BACKUP_DIR/hotgyaal_data_$TIMESTAMP.sql"
    EXTRA_ARGS=(--data-only)
    ;;
  --schema-only)
    OUTPUT="$BACKUP_DIR/hotgyaal_schema_$TIMESTAMP.sql"
    EXTRA_ARGS=(--schema-only)
    ;;
  full|"")
    OUTPUT="$BACKUP_DIR/hotgyaal_full_$TIMESTAMP.sql"
    EXTRA_ARGS=(--clean --if-exists)
    ;;
  *)
    echo "Mode inconnu: $MODE"
    echo "Usage: $0 [--data-only|--schema-only]"
    exit 1
    ;;
esac

echo "Backup -> $OUTPUT"
echo "Mode: $MODE"

PGPASSWORD="$SUPABASE_DB_PASSWORD" pg_dump \
  "$SUPABASE_DB_URL" \
  --no-owner \
  --no-privileges \
  "${EXTRA_ARGS[@]}" \
  > "$OUTPUT"

SIZE="$(du -h "$OUTPUT" | cut -f1)"
LINES="$(wc -l < "$OUTPUT")"
INSERTS="$(grep -c "^INSERT INTO" "$OUTPUT" || true)"

echo ""
echo "Backup termine:"
echo "  Fichier : $OUTPUT"
echo "  Taille  : $SIZE"
echo "  Lignes  : $LINES"
echo "  INSERTs : $INSERTS"
