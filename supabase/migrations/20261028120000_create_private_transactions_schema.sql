-- Schéma cible Kadmiel Business.
-- Les colonnes name/phone sont conservées sur clients pour compatibilité avec
-- les routes existantes ; un trigger synchronise les noms historiques et cibles.

begin;

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  telephone text not null,
  name text not null,
  phone text not null,
  created_at timestamptz not null default now()
);

-- Mise à niveau sans suppression des données de la table clients historique.
alter table public.clients
  add column if not exists nom text,
  add column if not exists telephone text,
  add column if not exists name text,
  add column if not exists phone text;

update public.clients
set
  nom = coalesce(nullif(btrim(nom), ''), nullif(btrim(name), ''), 'Client sans nom'),
  telephone = coalesce(nullif(btrim(telephone), ''), nullif(btrim(phone), ''), ''),
  name = coalesce(nullif(btrim(name), ''), nullif(btrim(nom), ''), 'Client sans nom'),
  phone = coalesce(nullif(btrim(phone), ''), nullif(btrim(telephone), ''), '');

alter table public.clients
  alter column nom set not null,
  alter column telephone set not null,
  alter column name set not null,
  alter column phone set not null;

create or replace function public.sync_client_legacy_columns()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    new.nom := coalesce(nullif(btrim(new.nom), ''), nullif(btrim(new.name), ''), 'Client sans nom');
    new.name := coalesce(nullif(btrim(new.name), ''), new.nom);
    new.telephone := coalesce(nullif(btrim(new.telephone), ''), nullif(btrim(new.phone), ''), '');
    new.phone := coalesce(nullif(btrim(new.phone), ''), new.telephone);
  else
    if new.nom is distinct from old.nom then
      new.name := new.nom;
    elsif new.name is distinct from old.name then
      new.nom := new.name;
    end if;

    if new.telephone is distinct from old.telephone then
      new.phone := new.telephone;
    elsif new.phone is distinct from old.phone then
      new.telephone := new.phone;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists sync_client_legacy_columns on public.clients;
create trigger sync_client_legacy_columns
before insert or update on public.clients
for each row execute function public.sync_client_legacy_columns();

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique default replace(gen_random_uuid()::text, '-', ''),
  client_id uuid references public.clients(id) on delete set null,
  client_nom text not null,
  service text not null,
  montant_net integer not null check (montant_net >= 0),
  frais integer not null check (frais >= 0),
  montant_total integer not null check (montant_total >= 0),
  statut text not null default 'en_attente'
    check (statut in ('en_attente', 'paye', 'echoue', 'annule', 'a_verifier')),
  geniuspay_reference text,
  checkout_url text,
  transaction_id_client text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  constraint transactions_amounts_match check (montant_total = montant_net + frais),
  constraint transactions_slug_is_opaque check (slug ~ '^[0-9a-f]{32}$')
);

create index if not exists transactions_created_at_idx
  on public.transactions (created_at desc);
create index if not exists transactions_statut_idx
  on public.transactions (statut);
create index if not exists transactions_client_id_idx
  on public.transactions (client_id);
create unique index if not exists transactions_geniuspay_reference_unique_idx
  on public.transactions (geniuspay_reference)
  where geniuspay_reference is not null;

-- Liste d'autorisation : un compte doit être ajouté explicitement par un
-- administrateur DB avant de pouvoir accéder aux données privées.
create table if not exists public.dashboard_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.dashboard_admins enable row level security;
alter table public.clients enable row level security;
alter table public.transactions enable row level security;

-- Remplacement des anciennes règles permissives de clients, le cas échéant.
do $$
declare
  policy_record record;
begin
  for policy_record in
    select tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('clients', 'transactions', 'dashboard_admins')
  loop
    execute format('drop policy if exists %I on public.%I', policy_record.policyname, policy_record.tablename);
  end loop;
end;
$$;

create policy "dashboard admins can read own membership"
  on public.dashboard_admins
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "dashboard admins can manage clients"
  on public.clients
  for all to authenticated
  using (
    exists (
      select 1 from public.dashboard_admins
      where dashboard_admins.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.dashboard_admins
      where dashboard_admins.user_id = (select auth.uid())
    )
  );

create policy "dashboard admins can manage transactions"
  on public.transactions
  for all to authenticated
  using (
    exists (
      select 1 from public.dashboard_admins
      where dashboard_admins.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.dashboard_admins
      where dashboard_admins.user_id = (select auth.uid())
    )
  );

commit;

-- Après création du compte Supabase propriétaire, ajouter son UUID ici via
-- l'éditeur SQL Supabase (ne pas utiliser l'email ou un secret côté client) :
-- insert into public.dashboard_admins (user_id)
-- values ('UUID_DU_COMPTE_ADMIN')
-- on conflict (user_id) do nothing;
