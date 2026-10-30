-- =========================================================================
-- MIGRATION SUPABASE : Intégration des Abonnements Mensuels B2B Restaurants
-- Tables : clients, payment_links, payments
-- Objectif : Gérer les abonnements mensuels récurrents B2B pour les restaurants
-- =========================================================================

begin;

-- 1. Table des clients (clients)
-- Enrichissement pour identifier clairement les entreprises abonnées (ex: restaurants partenaires)
alter table if exists public.clients
    add column if not exists client_type text default 'standard';

-- Mise à jour sécurisée de la contrainte check sur client_type ('standard' ou 'entreprise_abo')
alter table if exists public.clients
    drop constraint if exists clients_client_type_check;

alter table if exists public.clients
    add constraint clients_client_type_check
    check (client_type in ('standard', 'entreprise_abo'));

-- Index de performance pour filtrer rapidement les types de clients
create index if not exists idx_clients_client_type
    on public.clients(client_type);


-- 2. Table des liens de paiement (payment_links)
-- Ajout de business_type ('freelance', 'restaurant', 'abonnement_resto') et is_recurring
alter table if exists public.payment_links
    add column if not exists business_type text default 'freelance',
    add column if not exists is_recurring boolean default false;

-- Mise à jour sécurisée de la contrainte check pour accepter 'abonnement_resto'
alter table if exists public.payment_links
    drop constraint if exists payment_links_business_type_check;

alter table if exists public.payment_links
    add constraint payment_links_business_type_check
    check (business_type in ('freelance', 'restaurant', 'abonnement_resto'));

-- Index de performance sur payment_links
create index if not exists idx_payment_links_business_type
    on public.payment_links(business_type);

create index if not exists idx_payment_links_is_recurring
    on public.payment_links(is_recurring);


-- 3. Table des transactions actives (payments)
-- Garantie d'alignement complet avec la table payments active de l'application
alter table if exists public.payments
    add column if not exists business_type text default 'freelance',
    add column if not exists is_recurring boolean default false;

alter table if exists public.payments
    drop constraint if exists payments_business_type_check;

alter table if exists public.payments
    add constraint payments_business_type_check
    check (business_type in ('freelance', 'restaurant', 'abonnement_resto'));

-- Index de performance pour un filtrage instantané sur le dashboard
create index if not exists idx_payments_business_type
    on public.payments(business_type);

create index if not exists idx_payments_is_recurring
    on public.payments(is_recurring);

commit;
