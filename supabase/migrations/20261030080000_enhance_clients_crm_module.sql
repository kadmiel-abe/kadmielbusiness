-- =========================================================================
-- MIGRATION : Module CRM Clients pour Kadmiel Business Pay
-- Date : 2026-10-30
-- Description : Ajout des attributs CRM (email, status, notes, updated_at)
--              et création de la vue agrégée clients_crm_overview
-- =========================================================================

-- 1. Ajout sécurisé des colonnes CRM sur la table clients
alter table public.clients
  add column if not exists email text,
  add column if not exists status text not null default 'actif',
  add column if not exists notes text,
  add column if not exists updated_at timestamptz not null default now();

-- Contrainte de vérification pour les statuts CRM
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'clients_status_check'
  ) then
    alter table public.clients
      add constraint clients_status_check
      check (status in ('actif', 'vip', 'inactif', 'prospect'));
  end if;
end $$;

-- 2. Index de performance
create index if not exists clients_email_idx on public.clients (email);
create index if not exists clients_status_idx on public.clients (status);
create index if not exists clients_created_at_idx on public.clients (created_at desc);

-- 3. Vue SQL optimisée pour l'agrégation des indicateurs clients
create or replace view public.clients_crm_overview as
select 
  c.id,
  c.name,
  c.phone,
  c.email,
  coalesce(c.status, 'actif') as status,
  c.notes,
  c.created_at,
  coalesce(c.updated_at, c.created_at) as updated_at,
  count(p.id)::int as total_payments_count,
  count(case when p.status = 'paye' then 1 end)::int as paid_payments_count,
  count(case when p.status in ('en_attente', 'a_verifier') then 1 end)::int as pending_payments_count,
  count(case when p.status = 'expire' then 1 end)::int as expired_payments_count,
  coalesce(sum(case when p.status = 'paye' then p.amount_total else 0 end), 0)::bigint as total_paid_amount,
  coalesce(sum(case when p.status in ('en_attente', 'a_verifier') then p.amount_total else 0 end), 0)::bigint as total_pending_amount,
  coalesce(
    max(case when p.status = 'paye' and p.paid_at is not null then p.paid_at else p.created_at end),
    c.created_at
  ) as last_interaction_at
from public.clients c
left join public.payments p on p.client_id = c.id
group by c.id, c.name, c.phone, c.email, c.status, c.notes, c.created_at, c.updated_at;
