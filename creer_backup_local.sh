#!/bin/bash
NEW_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0bHJxZXdtdmNya3p3bHNlY29pIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDE3MzUyOCwiZXhwIjoyMDk1NzQ5NTI4fQ.nJ6wm9ETu7ahn7i_u3Q8bELFERxdAczzclQCGs-ukqU"
NEW_URL="https://etlrqewmvcrkzwlsecoi.supabase.co"
BACKUP_DIR="./hotgyaal_backup_$(date +%Y%m%d_%H%M%S)"

mkdir -p "$BACKUP_DIR/images/products"
mkdir -p "$BACKUP_DIR/images/categories"

echo "=== HOTGYAAL BACKUP ==="
echo "Dossier: $BACKUP_DIR"

# 1. Export DB
echo ""
echo "[ 1/3 ] Export base de données..."
for TABLE in products orders order_items store_categories store_settings; do
  curl -s "$NEW_URL/rest/v1/$TABLE?select=*&limit=5000" \
    -H "apikey: $NEW_KEY" -H "Authorization: Bearer $NEW_KEY" \
    -o "$BACKUP_DIR/${TABLE}.json"
  COUNT=$(python3 -c "import json; print(len(json.load(open('$BACKUP_DIR/${TABLE}.json'))))" 2>/dev/null || echo "?")
  echo "  $TABLE: $COUNT lignes"
done

# 2. Téléchargement images avec wget en parallèle
echo ""
echo "[ 2/3 ] Téléchargement des images..."

for FOLDER in products categories; do
  echo "  Récupération liste $FOLDER..."
  curl -s -X POST "$NEW_URL/storage/v1/object/list/product-images" \
    -H "apikey: $NEW_KEY" -H "Authorization: Bearer $NEW_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"prefix\": \"$FOLDER/\", \"limit\": 2000}" \
    | python3 -c "import json,sys; [print('$NEW_URL/storage/v1/object/public/product-images/$FOLDER/' + i['name']) for i in json.load(sys.stdin) if i.get('name')]" \
    > /tmp/urls_$FOLDER.txt

  TOTAL=$(wc -l < /tmp/urls_$FOLDER.txt)
  echo "  $FOLDER: $TOTAL fichiers"

  # Téléchargement avec wget en parallèle (10 à la fois)
  cd "$BACKUP_DIR/images/$FOLDER"
  wget -q -i /tmp/urls_$FOLDER.txt -P . --no-verbose 2>/dev/null || \
    while IFS= read -r url; do
      curl -sL -O "$url" &
      if [ $(jobs -r | wc -l) -ge 10 ]; then wait; fi
    done < /tmp/urls_$FOLDER.txt
  wait
  cd - > /dev/null
  echo "  $FOLDER: $(ls "$BACKUP_DIR/images/$FOLDER/" | wc -l) téléchargées"
done

# 3. ZIP
echo ""
echo "[ 3/3 ] Création du ZIP (peut prendre quelques minutes)..."
zip -r "${BACKUP_DIR}.zip" "$BACKUP_DIR" -q
SIZE=$(du -sh "${BACKUP_DIR}.zip" | cut -f1)
rm -rf "$BACKUP_DIR"

echo ""
echo "✓ Backup terminé: ${BACKUP_DIR}.zip ($SIZE)"
