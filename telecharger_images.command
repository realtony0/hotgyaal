#!/bin/bash
# Telecharge les 2700 images du site hotgyaal
# Double-clique ce fichier sur Mac, ou lance: bash telecharger_images.command

cd "$(dirname "$0")"

DEST="$HOME/Desktop/hotgyaal_images"
URLS="image_urls.txt"

if [ ! -f "$URLS" ]; then
  echo "ERREUR: image_urls.txt introuvable dans $(pwd)"
  echo "Place ce script dans le meme dossier que image_urls.txt"
  read -p "Appuie sur Entree pour fermer..."
  exit 1
fi

TOTAL=$(wc -l < "$URLS" | tr -d ' ')
mkdir -p "$DEST"

echo "=========================================="
echo "  Telechargement images hotgyaal"
echo "  $TOTAL images -> $DEST"
echo "=========================================="
echo ""

N=0
SKIP=0
while IFS= read -r url; do
  [ -z "$url" ] && continue
  N=$((N+1))
  name=$(basename "$url")
  folder=$(echo "$url" | sed 's|.*/product-images/||; s|/[^/]*$||')
  mkdir -p "$DEST/$folder"
  out="$DEST/$folder/$name"

  if [ -s "$out" ]; then
    SKIP=$((SKIP+1))
  else
    curl -s -f -o "$out" "$url" || rm -f "$out"
  fi

  if [ $((N % 100)) -eq 0 ]; then
    echo "  $N / $TOTAL  (deja presentes: $SKIP)"
  fi
done < "$URLS"

DONE=$(find "$DEST" -type f | wc -l | tr -d ' ')
SIZE=$(du -sh "$DEST" | cut -f1)

echo ""
echo "=========================================="
echo "  TERMINE"
echo "  $DONE fichiers - $SIZE"
echo "  Dossier: $DEST"
echo "=========================================="
echo ""
read -p "Appuie sur Entree pour fermer..."
