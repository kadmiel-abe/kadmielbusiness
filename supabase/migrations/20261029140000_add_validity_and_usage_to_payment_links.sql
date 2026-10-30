-- Migration: Ajout de la validité temporelle et de la gestion de l'usage unique/multiple
-- S'applique sur la table 'payments' (utilisée par l'application Next.js) 
-- ainsi que sur 'payment_links' et 'transactions' si présentes.

begin;

-- 1. Table principale payments
alter table if exists public.payments
  add column if not exists expires_at timestamptz,
  add column if not exists is_single_use boolean not null default true,
  add column if not exists max_uses integer not null default 1,
  add column if not exists times_used integer not null default 0,
  add column if not exists paid_at timestamptz;

-- 2. Table payment_links (au cas où elle est créée ou utilisée en alias)
alter table if exists public.payment_links
  add column if not exists expires_at timestamptz,
  add column if not exists is_single_use boolean not null default true,
  add column if not exists max_uses integer not null default 1,
  add column if not exists times_used integer not null default 0,
  add column if not exists paid_at timestamptz;

-- 3. Table transactions (schéma alternatif)
alter table if exists public.transactions
  add column if not exists expires_at timestamptz,
  add column if not exists is_single_use boolean not null default true,
  add column if not exists max_uses integer not null default 1,
  add column if not exists times_used integer not null default 0,
  add column if not exists paid_at timestamptz;

-- Index pour optimiser les requêtes sur l'expiration
create index if not exists payments_expires_at_idx on public.payments (expires_at) where expires_at is not null;
create index if not exists payments_times_used_idx on public.payments (times_used);

commit;
