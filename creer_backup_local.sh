#!/bin/bash
# Lance ce script sur TON PC — il crée le backup complet localement
# Prérequis: curl, node (ou python3)

NEW_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0bHJxZXdtdmNya3p3bHNlY29pIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDE3MzUyOCwiZXhwIjoyMDk1NzQ5NTI4fQ.nJ6wm9ETu7ahn7i_u3Q8bELFERxdAczzclQCGs-ukqU"
NEW_URL="https://etlrqewmvcrkzwlsecoi.supabase.co"
BACKUP_DIR="./hotgyaal_backup_$(date +%Y%m%d_%H%M%S)"

mkdir -p "$BACKUP_DIR/images/products"
mkdir -p "$BACKUP_DIR/images/categories"

echo "=== HOTGYAAL BACKUP ==="
echo "Dossier: $BACKUP_DIR"
echo ""

# ── 1. Export DB ──────────────────────────────────────────
echo "[ 1/3 ] Export base de données..."
for TABLE in products orders order_items store_categories store_settings; do
  curl -s "$NEW_URL/rest/v1/$TABLE?select=*&limit=5000" \
    -H "apikey: $NEW_KEY" \
    -H "Authorization: Bearer $NEW_KEY" \
    -o "$BACKUP_DIR/${TABLE}.json"
  COUNT=$(python3 -c "import json,sys; print(len(json.load(open('$BACKUP_DIR/${TABLE}.json'))))" 2>/dev/null || echo "?")
  echo "  $TABLE: $COUNT lignes"
done

# ── 2. Liste des images ───────────────────────────────────
echo ""
echo "[ 2/3 ] Téléchargement des images..."

for FOLDER in products categories; do
  FILES=$(curl -s -X POST "$NEW_URL/storage/v1/object/list/product-images" \
    -H "apikey: $NEW_KEY" \
    -H "Authorization: Bearer $NEW_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"prefix\": \"$FOLDER/\", \"limit\": 2000}" \
    | python3 -c "import json,sys; [print(i['name']) for i in json.load(sys.stdin) if i.get('name')]")

  TOTAL=$(echo "$FILES" | wc -l)
  DONE=0
  echo "  $FOLDER: $TOTAL fichiers"

  echo "$FILES" | xargs -P 10 -I{} bash -c "
    curl -s -o '$BACKUP_DIR/images/$FOLDER/{}' \
      '$NEW_URL/storage/v1/object/public/product-images/$FOLDER/{}' && \
    echo -ne \"\r  $FOLDER: \$(ls '$BACKUP_DIR/images/$FOLDER/' | wc -l)/$TOTAL\"
  "
  echo ""
done

# ── 3. ZIP ────────────────────────────────────────────────
echo ""
echo "[ 3/3 ] Création du ZIP..."
cd "$(dirname $BACKUP_DIR)"
zip -r "${BACKUP_DIR}.zip" "$(basename $BACKUP_DIR)" -q
SIZE=$(du -sh "${BACKUP_DIR}.zip" | cut -f1)
rm -rf "$BACKUP_DIR"

echo ""
echo "✓ Backup terminé: ${BACKUP_DIR}.zip ($SIZE)"
