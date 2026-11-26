-- HOTGYAAL — verrouillage de la base (a executer dans le SQL Editor).
--
-- Contexte : le site appelait Supabase directement depuis le navigateur avec
-- la cle publishable, et les policies accordaient au public la LECTURE des
-- commandes et l'ECRITURE sur le catalogue. Un pentest a confirme la fuite :
-- 256 commandes clientes (noms, telephones, adresses) lisibles publiquement,
-- et des insertions anonymes possibles.
--
-- Nouveau modele : le navigateur ne fait plus que LIRE le catalogue. Toute
-- ecriture, et toute lecture de commande, passe par les routes serveur
-- (/api/*) avec la cle service_role, qui contourne la RLS. Le public n'a donc
-- besoin d'aucun droit sur orders / order_items, et d'un droit de lecture seule
-- sur products / store_categories / store_settings.
--
-- A executer APRES le deploiement du nouveau code, sinon le back-office et le
-- checkout, encore cote navigateur, cesseraient de fonctionner le temps du
-- deploiement.

alter table public.products        enable row level security;
alter table public.orders          enable row level security;
alter table public.order_items     enable row level security;
alter table public.store_categories enable row level security;
alter table public.store_settings  enable row level security;

-- ------------------------------------------------------------------ products
-- Lecture publique ; aucune ecriture depuis le navigateur.
drop policy if exists "products_public_read"   on public.products;
drop policy if exists "products_public_insert" on public.products;
drop policy if exists "products_public_update" on public.products;
drop policy if exists "products_public_delete" on public.products;
drop policy if exists "products_admin_insert"  on public.products;
drop policy if exists "products_admin_update"  on public.products;
drop policy if exists "products_admin_delete"  on public.products;
create policy "products_public_read"
  on public.products for select using (true);

-- --------------------------------------------------------- store_categories
drop policy if exists "store_categories_public_select" on public.store_categories;
drop policy if exists "store_categories_public_insert" on public.store_categories;
drop policy if exists "store_categories_public_update" on public.store_categories;
drop policy if exists "store_categories_public_delete" on public.store_categories;
create policy "store_categories_public_read"
  on public.store_categories for select using (true);

-- ------------------------------------------------------------ store_settings
drop policy if exists "store_settings_public_select" on public.store_settings;
drop policy if exists "store_settings_public_insert" on public.store_settings;
drop policy if exists "store_settings_public_update" on public.store_settings;
create policy "store_settings_public_read"
  on public.store_settings for select using (true);

-- -------------------------------------------------------------------- orders
-- Plus AUCUN acces public : ni lecture, ni ecriture. Le serveur (service_role)
-- contourne la RLS, donc le checkout et le back-office continuent via /api/*.
drop policy if exists "orders_insert_public"           on public.orders;
drop policy if exists "orders_public_select"           on public.orders;
drop policy if exists "orders_public_update"           on public.orders;
drop policy if exists "orders_public_delete"           on public.orders;
drop policy if exists "orders_select_owner_or_admin"   on public.orders;
drop policy if exists "orders_update_admin"            on public.orders;

-- --------------------------------------------------------------- order_items
drop policy if exists "order_items_insert_public"         on public.order_items;
drop policy if exists "order_items_public_select"         on public.order_items;
drop policy if exists "order_items_public_delete"         on public.order_items;
drop policy if exists "order_items_select_owner_or_admin" on public.order_items;

-- ---------------------------------------------------------- storage.objects
-- Les visuels vivent sur R2 et l'upload passe par /api/upload (authentifie).
-- On retire donc les droits d'ecriture publics sur le bucket Supabase ; la
-- lecture reste ouverte, sans effet puisque plus aucun objet n'y est servi.
drop policy if exists "product_images_public_insert" on storage.objects;
drop policy if exists "product_images_public_update" on storage.objects;
drop policy if exists "product_images_public_delete" on storage.objects;

-- Controle : ne doit plus lister que des policies de SELECT public.
-- select tablename, policyname, cmd from pg_policies
--   where schemaname = 'public'
--     and tablename in ('orders','order_items','products','store_categories','store_settings');
