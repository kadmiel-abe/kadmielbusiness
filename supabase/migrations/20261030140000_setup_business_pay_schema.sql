-- =========================================================================
-- MIGRATION SUPABASE : Schéma Business Pay
-- Tables : settings, clients, payment_links, webhook_logs & index
-- Date : 2026-10-30
-- =========================================================================

begin;

-- 1. Table des réglages (taux de commission et frais fixes modifiables)
-- Note : On adapte/recrée proprement la table settings pour le format clé/valeur
drop table if exists public.settings cascade;
create table public.settings (
    id serial primary key,
    key text unique not null,
    value text not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Insertion des paramètres par défaut GeniusPay
insert into public.settings (key, value)
values 
    ('geniuspay_rate', '0.01'), 
    ('geniuspay_fixed_fee', '100')
on conflict (key) do update
set value = excluded.value, updated_at = now();

-- 2. Table des clients (enrichie avec client_type et status)
create table if not exists public.clients (
    id uuid default gen_random_uuid() primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    name text not null,
    phone text not null,
    email text,
    client_type text default 'standard',
    status text default 'actif'
);

-- Si la table clients existait déjà, on garantit l'ajout des colonnes enrichies
alter table public.clients
    add column if not exists client_type text default 'standard',
    add column if not exists status text default 'actif',
    add column if not exists email text;

-- 3. Table des liens de paiement (avec business_type 'freelance' ou 'restaurant')
create table if not exists public.payment_links (
    id uuid default gen_random_uuid() primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    client_id uuid references public.clients(id) on delete cascade not null,
    service_name text not null,
    business_type text not null default 'freelance' check (business_type in ('freelance', 'restaurant')),
    net_amount numeric(10, 2) not null check (net_amount >= 0),
    total_amount numeric(10, 2) not null check (total_amount >= 0),
    fee_amount numeric(10, 2) not null check (fee_amount >= 0),
    status text not null default 'en_attente',
    payment_method text,
    external_transaction_id text,
    token text unique not null,
    expires_at timestamp with time zone,
    is_recurring boolean default false
);

-- 4. Table des webhooks (idempotence)
create table if not exists public.webhook_logs (
    id uuid default gen_random_uuid() primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    event_id text unique not null,
    payload jsonb not null,
    status text not null
);

-- 5. Index de performance
create index if not exists idx_payment_links_status on public.payment_links(status);
create index if not exists idx_payment_links_business_type on public.payment_links(business_type);
create index if not exists idx_payment_links_created_at on public.payment_links(created_at desc);
create index if not exists idx_payment_links_token on public.payment_links(token);
create index if not exists idx_webhook_logs_event_id on public.webhook_logs(event_id);
create index if not exists idx_clients_phone on public.clients(phone);

-- 6. Sécurité : Activation de Row Level Security (RLS)
alter table public.settings enable row level security;
alter table public.clients enable row level security;
alter table public.payment_links enable row level security;
alter table public.webhook_logs enable row level security;

-- Politiques RLS permissives pour le service_role et authentifiés
drop policy if exists "Admin full access on settings" on public.settings;
create policy "Admin full access on settings" on public.settings for all using (true) with check (true);

drop policy if exists "Admin full access on clients" on public.clients;
create policy "Admin full access on clients" on public.clients for all using (true) with check (true);

drop policy if exists "Admin full access on payment_links" on public.payment_links;
create policy "Admin full access on payment_links" on public.payment_links for all using (true) with check (true);

drop policy if exists "Admin full access on webhook_logs" on public.webhook_logs;
create policy "Admin full access on webhook_logs" on public.webhook_logs for all using (true) with check (true);

-- 7. Compatibilité avec la table payments active de l'application
alter table if exists public.payments
    add column if not exists business_type text default 'freelance',
    add column if not exists fee_amount numeric(10, 2),
    add column if not exists paid_at timestamptz,
    add column if not exists expires_at timestamptz;

commit;
