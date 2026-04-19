-- Migration : programme de fidelite + authentification client (telephone + PIN)
-- A appliquer une fois le projet Supabase debloque.

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Table clients (auth par telephone + PIN, independante de auth.users)
-- -----------------------------------------------------------------------------
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,
  pin_hash text not null,
  full_name text,
  points_balance integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists customers_touch_updated_at on public.customers;
create trigger customers_touch_updated_at
  before update on public.customers
  for each row execute function public.touch_updated_at();

-- Index de recherche
create index if not exists customers_phone_idx on public.customers (phone);

-- -----------------------------------------------------------------------------
-- Sessions clients (un token en localStorage -> identifie le client)
-- -----------------------------------------------------------------------------
create table if not exists public.customer_sessions (
  token uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '90 days')
);

create index if not exists customer_sessions_customer_idx
  on public.customer_sessions (customer_id);

-- -----------------------------------------------------------------------------
-- Historique des points (credits / debits)
-- -----------------------------------------------------------------------------
create table if not exists public.loyalty_transactions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  amount integer not null,
  kind text not null check (kind in ('credit', 'debit', 'adjustment')),
  reason text,
  order_id uuid references public.orders(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists loyalty_transactions_customer_idx
  on public.loyalty_transactions (customer_id, created_at desc);

-- -----------------------------------------------------------------------------
-- RPC : normaliser le telephone (conserver uniquement les chiffres)
-- -----------------------------------------------------------------------------
create or replace function public.normalize_phone(raw text)
returns text
language sql
immutable
as $$
  select regexp_replace(coalesce(raw, ''), '\D', '', 'g');
$$;

-- -----------------------------------------------------------------------------
-- RPC : inscription client
-- -----------------------------------------------------------------------------
create or replace function public.customer_register(
  p_phone text,
  p_pin text,
  p_full_name text default null
)
returns table (
  token uuid,
  customer_id uuid,
  phone text,
  full_name text,
  points_balance integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text;
  v_customer_id uuid;
  v_token uuid;
begin
  v_phone := public.normalize_phone(p_phone);

  if length(v_phone) < 8 then
    raise exception 'Numero de telephone invalide';
  end if;

  if p_pin !~ '^\d{4,6}$' then
    raise exception 'Le code PIN doit contenir 4 a 6 chiffres';
  end if;

  if exists (select 1 from public.customers where phone = v_phone) then
    raise exception 'Un compte existe deja avec ce numero';
  end if;

  insert into public.customers (phone, pin_hash, full_name)
  values (v_phone, crypt(p_pin, gen_salt('bf')), nullif(trim(p_full_name), ''))
  returning id into v_customer_id;

  insert into public.customer_sessions (customer_id)
  values (v_customer_id)
  returning customer_sessions.token into v_token;

  return query
    select
      v_token,
      c.id,
      c.phone,
      c.full_name,
      c.points_balance
    from public.customers c
    where c.id = v_customer_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC : connexion client
-- -----------------------------------------------------------------------------
create or replace function public.customer_login(
  p_phone text,
  p_pin text
)
returns table (
  token uuid,
  customer_id uuid,
  phone text,
  full_name text,
  points_balance integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text;
  v_customer public.customers%rowtype;
  v_token uuid;
begin
  v_phone := public.normalize_phone(p_phone);

  select * into v_customer
  from public.customers
  where phone = v_phone;

  if not found then
    raise exception 'Numero ou PIN incorrect';
  end if;

  if v_customer.pin_hash <> crypt(p_pin, v_customer.pin_hash) then
    raise exception 'Numero ou PIN incorrect';
  end if;

  insert into public.customer_sessions (customer_id)
  values (v_customer.id)
  returning customer_sessions.token into v_token;

  return query
    select
      v_token,
      v_customer.id,
      v_customer.phone,
      v_customer.full_name,
      v_customer.points_balance;
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC : deconnexion
-- -----------------------------------------------------------------------------
create or replace function public.customer_logout(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.customer_sessions where token = p_token;
  return true;
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC : recuperer le client courant + son solde
-- -----------------------------------------------------------------------------
create or replace function public.customer_me(p_token uuid)
returns table (
  customer_id uuid,
  phone text,
  full_name text,
  points_balance integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid;
begin
  select s.customer_id into v_customer_id
  from public.customer_sessions s
  where s.token = p_token and s.expires_at > now();

  if v_customer_id is null then
    raise exception 'Session invalide ou expiree';
  end if;

  return query
    select c.id, c.phone, c.full_name, c.points_balance
    from public.customers c
    where c.id = v_customer_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC : mise a jour du profil (nom complet, changement PIN)
-- -----------------------------------------------------------------------------
create or replace function public.customer_update_profile(
  p_token uuid,
  p_full_name text default null,
  p_new_pin text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid;
begin
  select customer_id into v_customer_id
  from public.customer_sessions
  where token = p_token and expires_at > now();

  if v_customer_id is null then
    raise exception 'Session invalide';
  end if;

  if p_new_pin is not null and p_new_pin !~ '^\d{4,6}$' then
    raise exception 'PIN invalide';
  end if;

  update public.customers
  set
    full_name = coalesce(nullif(trim(p_full_name), ''), full_name),
    pin_hash = case when p_new_pin is not null then crypt(p_new_pin, gen_salt('bf')) else pin_hash end
  where id = v_customer_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC : historique des transactions de points
-- -----------------------------------------------------------------------------
create or replace function public.customer_loyalty_history(p_token uuid, p_limit integer default 20)
returns table (
  id uuid,
  amount integer,
  kind text,
  reason text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid;
begin
  select customer_id into v_customer_id
  from public.customer_sessions
  where token = p_token and expires_at > now();

  if v_customer_id is null then
    raise exception 'Session invalide';
  end if;

  return query
    select t.id, t.amount, t.kind, t.reason, t.created_at
    from public.loyalty_transactions t
    where t.customer_id = v_customer_id
    order by t.created_at desc
    limit greatest(1, least(coalesce(p_limit, 20), 100));
end;
$$;

-- -----------------------------------------------------------------------------
-- Trigger : crediter les points automatiquement quand une commande est livree
-- Taux : 1 point par tranche de 100 FCFA.
-- -----------------------------------------------------------------------------
create or replace function public.credit_loyalty_on_delivered()
returns trigger
language plpgsql
as $$
declare
  v_customer_id uuid;
  v_points integer;
begin
  if new.status is distinct from 'delivered' or old.status = 'delivered' then
    return new;
  end if;

  -- Associer la commande a un client par telephone normalise
  select c.id into v_customer_id
  from public.customers c
  where c.phone = public.normalize_phone(new.customer_phone);

  if v_customer_id is null then
    return new;
  end if;

  v_points := floor(new.total_amount / 100)::integer;

  if v_points <= 0 then
    return new;
  end if;

  insert into public.loyalty_transactions (customer_id, amount, kind, reason, order_id)
  values (v_customer_id, v_points, 'credit', 'Commande livree', new.id);

  update public.customers
  set points_balance = points_balance + v_points
  where id = v_customer_id;

  return new;
end;
$$;

drop trigger if exists orders_credit_loyalty on public.orders;
create trigger orders_credit_loyalty
  after update on public.orders
  for each row
  execute function public.credit_loyalty_on_delivered();

-- -----------------------------------------------------------------------------
-- RLS : interdire l'acces direct aux tables, forcer l'usage des RPC
-- -----------------------------------------------------------------------------
alter table public.customers enable row level security;
alter table public.customer_sessions enable row level security;
alter table public.loyalty_transactions enable row level security;

-- Aucune policy lecture/ecriture : seules les fonctions SECURITY DEFINER ont acces.
-- Les admins peuvent quand meme consulter via le service role.

-- -----------------------------------------------------------------------------
-- RPC admin : lister les clients avec recherche par telephone ou nom
-- (protection cote frontend via code admin, pas de check serveur)
-- -----------------------------------------------------------------------------
create or replace function public.admin_list_customers(
  p_search text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  customer_id uuid,
  phone text,
  full_name text,
  points_balance integer,
  total_credited integer,
  total_debited integer,
  last_transaction_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_search text;
begin
  v_search := nullif(trim(coalesce(p_search, '')), '');

  return query
  with stats as (
    select
      t.customer_id,
      coalesce(sum(case when t.kind = 'credit' then t.amount else 0 end), 0)::integer as total_credited,
      coalesce(sum(case when t.kind = 'debit' then t.amount else 0 end), 0)::integer as total_debited,
      max(t.created_at) as last_transaction_at
    from public.loyalty_transactions t
    group by t.customer_id
  )
  select
    c.id,
    c.phone,
    c.full_name,
    c.points_balance,
    coalesce(s.total_credited, 0) as total_credited,
    coalesce(s.total_debited, 0) as total_debited,
    s.last_transaction_at,
    c.created_at
  from public.customers c
  left join stats s on s.customer_id = c.id
  where
    v_search is null
    or c.phone ilike '%' || v_search || '%'
    or c.full_name ilike '%' || v_search || '%'
  order by c.created_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 200))
  offset greatest(0, coalesce(p_offset, 0));
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC admin : ajuster le solde de points d'un client (credit ou debit)
-- p_amount peut etre positif (credit) ou negatif (debit)
-- -----------------------------------------------------------------------------
create or replace function public.admin_adjust_points(
  p_customer_id uuid,
  p_amount integer,
  p_reason text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind text;
  v_abs integer;
  v_new_balance integer;
begin
  if p_amount = 0 then
    raise exception 'Le montant doit etre different de zero';
  end if;

  if p_amount > 0 then
    v_kind := 'credit';
  else
    v_kind := 'debit';
  end if;

  v_abs := abs(p_amount);

  update public.customers
  set points_balance = greatest(0, points_balance + p_amount)
  where id = p_customer_id
  returning points_balance into v_new_balance;

  if not found then
    raise exception 'Client introuvable';
  end if;

  insert into public.loyalty_transactions (customer_id, amount, kind, reason)
  values (
    p_customer_id,
    v_abs,
    case when v_kind = 'credit' then 'credit' else 'adjustment' end,
    nullif(trim(coalesce(p_reason, '')), '')
  );

  return v_new_balance;
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC admin : historique complet d'un client (sans token, par id)
-- -----------------------------------------------------------------------------
create or replace function public.admin_customer_history(
  p_customer_id uuid,
  p_limit integer default 100
)
returns table (
  id uuid,
  amount integer,
  kind text,
  reason text,
  order_id uuid,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select t.id, t.amount, t.kind, t.reason, t.order_id, t.created_at
  from public.loyalty_transactions t
  where t.customer_id = p_customer_id
  order by t.created_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 500));
end;
$$;

-- -----------------------------------------------------------------------------
-- Permissions d'execution des RPC pour les anonymes et authentifies
-- -----------------------------------------------------------------------------
grant execute on function public.customer_register(text, text, text) to anon, authenticated;
grant execute on function public.customer_login(text, text) to anon, authenticated;
grant execute on function public.customer_logout(uuid) to anon, authenticated;
grant execute on function public.customer_me(uuid) to anon, authenticated;
grant execute on function public.customer_update_profile(uuid, text, text) to anon, authenticated;
grant execute on function public.customer_loyalty_history(uuid, integer) to anon, authenticated;
grant execute on function public.admin_list_customers(text, integer, integer) to anon, authenticated;
grant execute on function public.admin_adjust_points(uuid, integer, text) to anon, authenticated;
grant execute on function public.admin_customer_history(uuid, integer) to anon, authenticated;
