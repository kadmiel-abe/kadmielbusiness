-- Migration: Ajout du paramétrage de la prise en charge des frais de transaction (fee_bearer)
-- Valeurs : 'client' (le client paie les frais) ou 'freelance' (le freelance prend en charge les frais)

begin;

-- 1. Table payments
alter table if exists public.payments
  add column if not exists fee_bearer text not null default 'client' check (fee_bearer in ('client', 'freelance'));

-- 2. Table payment_links (au cas où elle est utilisée)
alter table if exists public.payment_links
  add column if not exists fee_bearer text not null default 'client' check (fee_bearer in ('client', 'freelance'));

-- 3. Table transactions
alter table if exists public.transactions
  add column if not exists fee_bearer text not null default 'client' check (fee_bearer in ('client', 'freelance'));

commit;
