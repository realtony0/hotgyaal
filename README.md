# HOTGYAAL

Site e-commerce moderne (storefront + panier + back-office admin) construit avec Next.js, React, TypeScript et Supabase.

Supabase est obligatoire pour le fonctionnement du front, du checkout et du back-office (aucun fallback local).

## Fonctionnalités

- Boutique responsive (mobile + desktop)
- Accueil avec nouveautés, best sellers et catégories
- Page boutique avec filtres par catégorie/sous-catégorie
- Page produit détaillée
- Panier complet + finalisation sur canal direct
- Dashboard admin (accès par code)
- CRUD produits (ajout, modification, suppression)
- Upload d'images via Supabase Storage
- Vue commandes clients + gestion du statut

## Stack

- Next.js 15 (Pages Router) + React 19 + TypeScript
- Supabase (`Auth`, `Postgres`, `Storage`)

## Installation

```bash
npm install
cp .env.example .env
```

Renseignez ensuite `.env`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_SITE_URL=https://hotgyaal.com
NEXT_PUBLIC_ORDER_CHAT_NUMBER=221774931474
NEXT_PUBLIC_ADMIN_ACCESS_CODE=142022
```

## Configuration Supabase

1. Ouvrir Supabase SQL Editor.
2. Exécuter `supabase/schema.sql`.
3. (Optionnel) Exécuter `supabase/seed.sql` pour des produits de démo.
4. (Si base deja creee) Exécuter `supabase/unlock_admin_policies.sql` pour retirer l'exigence `role='admin'`.

## Import d'images locales

Les images présentes à la racine ont été copiées vers `public/products` et référencées dans le seed.

Pour régénérer automatiquement les produits à partir des images locales:

```bash
node scripts/import-local-products.mjs
```

## Stockage des images (Cloudflare R2)

Les visuels ne sont pas stockes dans Supabase: son quota d'egress avait fini
par suspendre le projet. Ils vivent sur Cloudflare R2, qui ne facture pas la
bande passante sortante. La base ne conserve que leur URL.

Mise en place:

1. Creer un bucket R2 dans le tableau de bord Cloudflare.
2. Lui rattacher un domaine public (par exemple `img.hotgyaal.com`).
3. Creer un jeton d'API R2 avec les droits de lecture et d'ecriture.
4. Renseigner les cinq variables `R2_*` (voir `.env.example`) dans Vercel.

Tant que ces variables sont absentes, la route `/api/upload` repond `501` et
l'envoi bascule automatiquement sur le stockage Supabase: la boutique
fonctionne, mais le quota d'egress reste expose.

Les photos sont redimensionnees et converties en WebP dans le navigateur avant
l'envoi (voir `src/utils/image.ts`), afin d'eviter les fichiers demesures
venant des telephones.

## Monnaie

- Monnaie: `XOF`

### Accès admin

- Ouvrir `/admin/login`
- Code d'accès: `NEXT_PUBLIC_ADMIN_ACCESS_CODE` (fallback `142022`)
- Aucun role Supabase admin n'est requis avec la configuration SQL actuelle.

## Lancer le projet

```bash
npm run dev
```

Build production:

```bash
npm run build
npm run start
```

## Routes principales

- `/` : accueil
- `/boutique` : catalogue + filtres
- `/produit/[slug]` : détail produit
- `/panier` : panier + checkout
- `/admin/login` : connexion admin
- `/admin` : dashboard admin
