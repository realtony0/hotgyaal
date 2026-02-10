-- HOTGYAAL full setup: schema + seed

create extension if not exists pgcrypto;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'customer' check (role in ('admin', 'customer')),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

create or replace function public.is_admin(user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = user_id and role = 'admin'
  );
$$;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text not null,
  price numeric(10, 2) not null check (price >= 0),
  compare_price numeric(10, 2) check (compare_price >= 0),
  stock integer not null default 0 check (stock >= 0),
  main_category text not null,
  sub_category text not null,
  image_url text,
  gallery_urls text[] not null default '{}',
  sizes text[] not null default '{}',
  is_out_of_stock boolean not null default false,
  is_new boolean not null default false,
  is_best_seller boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.products
  add column if not exists sizes text[] not null default '{}';

alter table public.products
  add column if not exists is_out_of_stock boolean not null default false;

update public.products
set sizes = array['Taille unique']
where sizes is null or cardinality(sizes) = 0;

update public.products
set is_out_of_stock = stock <= 0
where is_out_of_stock is null;

drop trigger if exists products_touch_updated_at on public.products;
create trigger products_touch_updated_at
  before update on public.products
  for each row
  execute function public.touch_updated_at();

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default (
    'HG-' || upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8))
  ),
  user_id uuid references auth.users(id) on delete set null,
  customer_name text not null,
  customer_email text not null,
  customer_phone text,
  shipping_address jsonb not null,
  status text not null default 'pending' check (
    status in ('pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled')
  ),
  total_amount numeric(10, 2) not null check (total_amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists orders_touch_updated_at on public.orders;
create trigger orders_touch_updated_at
  before update on public.orders
  for each row
  execute function public.touch_updated_at();

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  selected_size text,
  unit_price numeric(10, 2) not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0),
  subtotal numeric(10, 2) not null check (subtotal >= 0)
);

alter table public.order_items
  add column if not exists selected_size text;

create index if not exists idx_products_category
  on public.products (main_category, sub_category);

create index if not exists idx_orders_created_at
  on public.orders (created_at desc);

create index if not exists idx_order_items_order_id
  on public.order_items (order_id);

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
  on public.profiles
  for select
  using (id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles
  for insert
  with check (id = auth.uid());

drop policy if exists "profiles_update_own_or_admin" on public.profiles;
create policy "profiles_update_own_or_admin"
  on public.profiles
  for update
  using (id = auth.uid() or public.is_admin(auth.uid()))
  with check (id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists "products_public_read" on public.products;
create policy "products_public_read"
  on public.products
  for select
  using (true);

drop policy if exists "products_admin_insert" on public.products;
drop policy if exists "products_public_insert" on public.products;
create policy "products_public_insert"
  on public.products
  for insert
  with check (true);

drop policy if exists "products_admin_update" on public.products;
drop policy if exists "products_public_update" on public.products;
create policy "products_public_update"
  on public.products
  for update
  using (true)
  with check (true);

drop policy if exists "products_admin_delete" on public.products;
drop policy if exists "products_public_delete" on public.products;
create policy "products_public_delete"
  on public.products
  for delete
  using (true);

drop policy if exists "orders_insert_public" on public.orders;
create policy "orders_insert_public"
  on public.orders
  for insert
  with check (true);

drop policy if exists "orders_select_owner_or_admin" on public.orders;
drop policy if exists "orders_public_select" on public.orders;
create policy "orders_public_select"
  on public.orders
  for select
  using (true);

drop policy if exists "orders_update_admin" on public.orders;
drop policy if exists "orders_public_update" on public.orders;
create policy "orders_public_update"
  on public.orders
  for update
  using (true)
  with check (true);

drop policy if exists "order_items_insert_public" on public.order_items;
create policy "order_items_insert_public"
  on public.order_items
  for insert
  with check (true);

drop policy if exists "order_items_select_owner_or_admin" on public.order_items;
drop policy if exists "order_items_public_select" on public.order_items;
create policy "order_items_public_select"
  on public.order_items
  for select
  using (true);

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "product_images_public_read" on storage.objects;
create policy "product_images_public_read"
  on storage.objects
  for select
  to public
  using (bucket_id = 'product-images');

drop policy if exists "product_images_admin_insert" on storage.objects;
drop policy if exists "product_images_public_insert" on storage.objects;
create policy "product_images_public_insert"
  on storage.objects
  for insert
  to public
  with check (bucket_id = 'product-images');

drop policy if exists "product_images_admin_update" on storage.objects;
drop policy if exists "product_images_public_update" on storage.objects;
create policy "product_images_public_update"
  on storage.objects
  for update
  to public
  using (bucket_id = 'product-images')
  with check (bucket_id = 'product-images');

drop policy if exists "product_images_admin_delete" on storage.objects;
drop policy if exists "product_images_public_delete" on storage.objects;
create policy "product_images_public_delete"
  on storage.objects
  for delete
  to public
  using (bucket_id = 'product-images');

insert into public.products (
  name,
  slug,
  description,
  price,
  compare_price,
  stock,
  main_category,
  sub_category,
  image_url,
  gallery_urls,
  sizes,
  is_out_of_stock,
  is_new,
  is_best_seller
)
values
  (
    'Aura',
    'aura',
    'Robe féminine fluide, coupe élégante et tombé léger pour un look premium.',
    25000,
    32000,
    20,
    'Vêtements Femmes',
    'Robes',
    '/products/aura-01.webp',
    array[]::text[],
    array['S', 'M', 'L', 'XL'],
    false,
    true,
    true
  ),
  (
    'Body Shaping Jumpsuit',
    'body-shaping-jumpsuit',
    'Body sculptant effet gainant, maintien confortable et coupe seconde peau.',
    25000,
    null,
    18,
    'Sous-vêtements & Pyjamas',
    'Lingerie',
    '/products/body-shaping-jumpsuit-01.webp',
    array[]::text[],
    array['S', 'M', 'L', 'XL'],
    false,
    true,
    false
  ),
  (
    'Cape Celeste',
    'cape-celeste',
    'Cape élégante aux lignes épurées, parfaite pour une allure chic.',
    28000,
    34000,
    16,
    'Vêtements Femmes',
    'Robes',
    '/products/cape-celeste-01.webp',
    array['/products/cape-celeste-02.webp', '/products/cape-celeste-03.webp'],
    array['S', 'M', 'L', 'XL'],
    false,
    true,
    true
  ),
  (
    'Causal Pant Suit',
    'causal-pant-suit',
    'Ensemble tailoring casual, raffiné et facile à porter.',
    30000,
    null,
    14,
    'Vêtements Femmes',
    'Tenues de sport',
    '/products/causal-pant-suit-01.webp',
    array[]::text[],
    array['S', 'M', 'L', 'XL'],
    false,
    false,
    false
  ),
  (
    'Chrysalide Nocturne',
    'chrysalide-nocturne',
    'Robe sophistiquée aux reflets profonds, parfaite pour vos soirées.',
    35000,
    42000,
    12,
    'Vêtements Femmes',
    'Robes',
    '/products/chrysalide-nocturne-01.webp',
    array['/products/chrysalide-nocturne-02.webp', '/products/chrysalide-nocturne-03.webp'],
    array['S', 'M', 'L', 'XL'],
    false,
    true,
    true
  ),
  (
    'Combinaison de sport imprimé Leopard',
    'combinaison-de-sport-imprime-leopard',
    'Combinaison sport ultra stretch, imprimé tendance et confort total.',
    22000,
    null,
    24,
    'Vêtements Femmes',
    'Tenues de sport',
    '/products/combinaison-de-sport-imprime-leopard-01.webp',
    array[]::text[],
    array['S', 'M', 'L', 'XL'],
    false,
    true,
    false
  ),
  (
    'Jean Déchiré Mi-Taille Pliée',
    'jean-dechire-mi-taille-pliee',
    'Jean denim tendance avec coupe moderne et détails déchirés.',
    24000,
    null,
    20,
    'Vêtements Femmes',
    'Pantalons',
    '/products/jean-dechire-mi-taille-pliee-01.webp',
    array[]::text[],
    array['S', 'M', 'L', 'XL'],
    false,
    false,
    false
  ),
  (
    'Jogging Set',
    'jogging-set',
    'Ensemble jogging doux, coupe confort et style urbain.',
    26000,
    32000,
    18,
    'Vêtements Femmes',
    'Tenues de sport',
    '/products/jogging-set-01.webp',
    array[]::text[],
    array['S', 'M', 'L', 'XL'],
    false,
    false,
    true
  ),
  (
    'Lumière d''Aube',
    'lumiere-d-aube',
    'Robe légère et lumineuse, parfaite pour une allure douce.',
    27000,
    null,
    16,
    'Vêtements Femmes',
    'Robes',
    '/products/lumiere-d-aube-01.webp',
    array[]::text[],
    array['S', 'M', 'L', 'XL'],
    false,
    true,
    false
  ),
  (
    'Midnight Elegance',
    'midnight-elegance',
    'Ensemble top et pantalon ajusté pour un look evening moderne.',
    36000,
    null,
    10,
    'Vêtements Femmes',
    'Pantalons',
    '/products/midnight-elegance-01.webp',
    array[]::text[],
    array['S', 'M', 'L', 'XL'],
    false,
    true,
    true
  ),
  (
    'Midnight Muse',
    'midnight-muse',
    'Pièce statement au tombé fluide, look premium assuré.',
    34000,
    40000,
    12,
    'Vêtements Femmes',
    'Robes',
    '/products/midnight-muse-01.webp',
    array[]::text[],
    array['S', 'M', 'L', 'XL'],
    false,
    true,
    true
  ),
  (
    'Mint Cascade',
    'mint-cascade',
    'Combinaison pantalon pastel, coupe ajustée et allure chic.',
    23000,
    null,
    22,
    'Vêtements Femmes',
    'Pantalons',
    '/products/mint-cascade-01.webp',
    array[]::text[],
    array['S', 'M', 'L', 'XL'],
    false,
    false,
    false
  ),
  (
    'Pink Flower',
    'pink-flower',
    'Ensemble veste denim et jean coordonne pour un style casual premium.',
    25000,
    null,
    20,
    'Vêtements Femmes',
    'Vestes',
    '/products/pink-flower-01.webp',
    array[]::text[],
    array['S', 'M', 'L', 'XL'],
    false,
    false,
    false
  ),
  (
    'Skye',
    'skye',
    'Ensemble près du corps, confortable et adapté au style athleisure.',
    26000,
    null,
    18,
    'Vêtements Femmes',
    'Tenues de sport',
    '/products/skye-01.webp',
    array[]::text[],
    array['S', 'M', 'L', 'XL'],
    false,
    false,
    false
  ),
  (
    'Urban Wanderer',
    'urban-wanderer',
    'Combinaison pantalon élégante pour un style urbain affirmé.',
    24000,
    null,
    24,
    'Vêtements Femmes',
    'Pantalons',
    '/products/urban-wanderer-01.webp',
    array[]::text[],
    array['S', 'M', 'L', 'XL'],
    false,
    false,
    false
  ),
  (
    'Yoga Flow Short à manches courtes',
    'yoga-flow-short-a-manches-courtes',
    'Ensemble sport doux, respirant et parfaitement ajusté.',
    22000,
    28000,
    26,
    'Vêtements Femmes',
    'Tenues de sport',
    '/products/yoga-flow-short-a-manches-courtes-01.webp',
    array['/products/yoga-flow-short-a-manches-courtes-02.webp', '/products/yoga-flow-short-a-manches-courtes-03.webp', '/products/yoga-flow-short-a-manches-courtes-04.webp', '/products/yoga-flow-short-a-manches-courtes-05.webp', '/products/yoga-flow-short-a-manches-courtes-06.webp', '/products/yoga-flow-short-a-manches-courtes-07.webp', '/products/yoga-flow-short-a-manches-courtes-08.webp', '/products/yoga-flow-short-a-manches-courtes-09.webp', '/products/yoga-flow-short-a-manches-courtes-10.webp'],
    array['S', 'M', 'L', 'XL'],
    false,
    true,
    true
  ),
  (
    'Yoga Set',
    'yoga-set',
    'Ensemble yoga confort, maintien et style premium.',
    21000,
    null,
    30,
    'Vêtements Femmes',
    'Tenues de sport',
    '/products/yoga-set-01.webp',
    array[]::text[],
    array['S', 'M', 'L', 'XL'],
    false,
    true,
    false
  )
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  price = excluded.price,
  compare_price = excluded.compare_price,
  stock = excluded.stock,
  main_category = excluded.main_category,
  sub_category = excluded.sub_category,
  image_url = excluded.image_url,
  gallery_urls = excluded.gallery_urls,
  sizes = excluded.sizes,
  is_out_of_stock = excluded.is_out_of_stock,
  is_new = excluded.is_new,
  is_best_seller = excluded.is_best_seller,
  updated_at = now();
