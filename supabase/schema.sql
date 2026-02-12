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

create table if not exists public.store_settings (
  id integer primary key check (id = 1),
  announcement_text text not null default 'Mode femme & accessoires · Vente au Senegal · Importation directe Chine',
  hero_eyebrow text not null default 'Mode Femme & Accessoires',
  hero_title text not null default 'Vetements, accessoires et chaussures tendance au Senegal.',
  hero_description text not null default 'HOTGYAAL met en avant la mode feminine: robes, tops, ensembles, sacs, bijoux et chaussures. Les produits sont selectionnes en Chine puis proposes au marche senegalais.',
  contact_intro text not null default 'HOTGYAAL vend au Senegal et source ses collections en Chine via une activite d''import-export.',
  contact_phone text not null default '+221 77 493 14 74',
  contact_email text not null default 'sophieniang344@gmail.com',
  contact_hours text not null default 'lundi a samedi, 9h - 19h',
  footer_blurb text not null default 'Specialiste mode femme, accessoires et chaussures. Vente au Senegal avec importation directe depuis la Chine.',
  order_chat_number text not null default '774931474',
  updated_at timestamptz not null default now()
);

drop trigger if exists store_settings_touch_updated_at on public.store_settings;
create trigger store_settings_touch_updated_at
  before update on public.store_settings
  for each row
  execute function public.touch_updated_at();

insert into public.store_settings (id)
values (1)
on conflict (id) do nothing;

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
alter table public.store_settings enable row level security;

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

drop policy if exists "store_settings_public_select" on public.store_settings;
create policy "store_settings_public_select"
  on public.store_settings
  for select
  using (true);

drop policy if exists "store_settings_public_insert" on public.store_settings;
create policy "store_settings_public_insert"
  on public.store_settings
  for insert
  with check (true);

drop policy if exists "store_settings_public_update" on public.store_settings;
create policy "store_settings_public_update"
  on public.store_settings
  for update
  using (true)
  with check (true);

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
