-- HOTGYAAL: remove role-based admin enforcement.
-- Keep admin page access managed only by code 142022 in the frontend.

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

drop policy if exists "order_items_select_owner_or_admin" on public.order_items;
drop policy if exists "order_items_public_select" on public.order_items;
create policy "order_items_public_select"
  on public.order_items
  for select
  using (true);

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
