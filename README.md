# HOTGYAAL

Site e-commerce moderne (storefront + panier + back-office admin) construit avec Next.js, React, TypeScript et Supabase.

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
```

## Configuration Supabase

1. Ouvrir Supabase SQL Editor.
2. Exécuter `/Users/admin/Desktop/Housegyaal/supabase/schema.sql`.
3. (Optionnel) Exécuter `/Users/admin/Desktop/Housegyaal/supabase/seed.sql` pour des produits de démo.

## Import d'images locales

Les images présentes à la racine ont été copiées vers `/Users/admin/Desktop/Housegyaal/public/products` et référencées dans le seed.

Pour régénérer automatiquement les produits à partir des images locales:

```bash
node scripts/import-local-products.mjs
```

## Monnaie

- Monnaie: `XOF`

### Accès admin

- Ouvrir `/admin/login`
- Code d'accès: `142022`

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
