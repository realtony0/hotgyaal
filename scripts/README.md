# Scripts de backup Supabase

Trois scripts pour recuperer tes donnees en cas de restriction de service
(`exceed_cached_egress_quota`, suspension de projet, migration, etc.).

## Setup

Cree un fichier `.env.local` a la racine du projet (il est deja git-ignore) :

```bash
# Depuis Dashboard Supabase -> Project Settings -> Database -> Connection string (URI)
SUPABASE_DB_URL="postgresql://postgres.XXXX@aws-1-REGION.pooler.supabase.com:5432/postgres"
SUPABASE_DB_PASSWORD="ton_mot_de_passe_db"

# Depuis Dashboard Supabase -> Project Settings -> API
SUPABASE_URL="https://XXXX.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="eyJ..."   # service_role, pas anon
```

## 1. Backup de la base (recommande en premier)

`pg_dump` passe par le port 5432 direct et fonctionne en general meme quand
l'API publique est restreinte.

```bash
# Prerequis (une seule fois)
brew install postgresql@16

chmod +x scripts/backup-db.sh

# Dump complet (schema + donnees)
./scripts/backup-db.sh

# Donnees uniquement
./scripts/backup-db.sh --data-only

# Schema uniquement
./scripts/backup-db.sh --schema-only
```

Fichiers de sortie : `./backups/hotgyaal_full_YYYYMMDD_HHMMSS.sql`

## 2. Backup du Storage (images, fichiers)

A lancer uniquement quand le service n'est plus restreint.

```bash
node --env-file=.env.local scripts/backup-storage.mjs
```

Fichiers de sortie : `./backups/storage/<bucket>/...`

## 3. Export CSV par table (solution de secours)

Utile si `pg_dump` echoue pour une raison X ou si tu veux des CSV
pour Excel/Google Sheets.

```bash
node --env-file=.env.local scripts/export-tables-csv.mjs
```

Ajuste la liste `TABLES` dans le script selon ton schema.

Fichiers de sortie : `./backups/csv/<table>.csv`

## Verification apres backup

```bash
# Taille et contenu du dump SQL
ls -lh backups/
grep -c "^INSERT INTO" backups/hotgyaal_full_*.sql

# Test de restauration local (optionnel)
docker run --rm -p 5433:5432 -e POSTGRES_PASSWORD=test -d --name pg-test postgres:16
psql "postgresql://postgres:test@localhost:5433/postgres" < backups/hotgyaal_full_*.sql
docker stop pg-test
```

## Rappels securite

- **Ne jamais commit `.env.local`** (deja dans `.gitignore`)
- **Ne jamais partager ton service_role_key** — il donne acces total
- Apres toute fuite accidentelle : Dashboard -> Settings -> API -> Reset
  service_role key, et Settings -> Database -> Reset database password
