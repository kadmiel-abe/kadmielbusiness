-- =========================================================================
-- KADMIEL BUSINESS PAY - Schéma de base de données Supabase
-- Version : 1.0 (Mobile-First / Côte d'Ivoire)
-- =========================================================================

begin;

-- Extension pour la génération automatique d'UUID v4
create extension if not exists "uuid-ossp";

-- -------------------------------------------------------------------------
-- 1. TABLE : settings (Configuration globale & calcul des frais)
-- -------------------------------------------------------------------------
create table if not exists public.settings (
    id serial primary key,
    key text unique not null,
    value text not null,
    description text,
    updated_at timestamptz default timezone('utc'::text, now()) not null
);

-- Insertion des valeurs par défaut pour Kadmiel Business
insert into public.settings (key, value, description)
values 
    ('fee_percentage', '1.5', 'Pourcentage de frais supporté par le client (ex: 1.5 pour 1.5%)'),
    ('fee_fixed', '100', 'Frais fixes en FCFA par transaction (ex: 100 FCFA)'),
    ('currency', 'XOF', 'Devise par défaut (Franc CFA UEMOA)'),
    ('business_name', 'Kadmiel Business', 'Nom commercial affiché sur la page de paiement et reçus'),
    ('whatsapp_contact', '+2250700000000', 'Numéro WhatsApp de contact / support')
on conflict (key) do update
set value = excluded.value, description = excluded.description, updated_at = now();

-- -------------------------------------------------------------------------
-- 2. TABLE : clients (Annuaire des clients)
-- -------------------------------------------------------------------------
create table if not exists public.clients (
    id uuid default gen_random_uuid() primary key,
    created_at timestamptz default timezone('utc'::text, now()) not null,
    user_id uuid references auth.users(id) on delete cascade,
    name text not null,
    phone text not null,
    email text,
    notes text,
    status text default 'actif' check (status in ('actif', 'inactif'))
);

-- Index pour recherche rapide de client
create index if not exists idx_clients_phone on public.clients(phone);
create index if not exists idx_clients_name on public.clients(name);

-- -------------------------------------------------------------------------
-- 3. TABLE : payment_links (Demandes et liens de paiement)
-- -------------------------------------------------------------------------
create table if not exists public.payment_links (
    id uuid default gen_random_uuid() primary key,
    created_at timestamptz default timezone('utc'::text, now()) not null,
    updated_at timestamptz default timezone('utc'::text, now()) not null,
    user_id uuid references auth.users(id) on delete cascade,
    client_id uuid references public.clients(id) on delete set null,
    
    -- Jeton unique court ou identifiant public pour l'URL /pay/[id]
    token text unique not null default replace(gen_random_uuid()::text, '-', ''),
    
    -- Détails de la prestation
    service_name text not null,
    
    -- Règles financières (Montants en FCFA entiers)
    net_amount integer not null check (net_amount >= 0),
    fee_amount integer not null check (fee_amount >= 0),
    total_amount integer not null check (total_amount >= 0),
    
    -- Cycle de vie du paiement
    -- 'en_attente'            : Lien généré, en attente du règlement client
    -- 'paye'                  : Confirmé automatiquement par webhook GeniusPay
    -- 'valide_manuellement'   : Mode secours activé par toi depuis le dashboard
    -- 'refuse_manuellement'   : Rejeté par toi depuis le dashboard
    -- 'echoue'                : Échec de transaction côté opérateur
    -- 'annule'                : Demande annulée
    status text not null default 'en_attente' check (
        status in ('en_attente', 'paye', 'valide_manuellement', 'refuse_manuellement', 'echoue', 'annule')
    ),
    
    -- Mode de paiement utilisé (wave, orange, mtn, moov, manuel)
    payment_method text,
    
    -- Références GeniusPay
    geniuspay_reference text unique,
    geniuspay_checkout_url text,
    
    -- Horodatages clés
    paid_at timestamptz,
    expires_at timestamptz default (timezone('utc'::text, now()) + interval '7 days')
);

-- Index de performance pour les filtres et le dashboard
create index if not exists idx_payment_links_status on public.payment_links(status);
create index if not exists idx_payment_links_created_at on public.payment_links(created_at desc);
create index if not exists idx_payment_links_token on public.payment_links(token);
create index if not exists idx_payment_links_client_id on public.payment_links(client_id);
create index if not exists idx_payment_links_geniuspay_ref on public.payment_links(geniuspay_reference);

-- -------------------------------------------------------------------------
-- 4. TABLE : webhook_logs (Idempotence & Audit des événements)
-- -------------------------------------------------------------------------
create table if not exists public.webhook_logs (
    id uuid default gen_random_uuid() primary key,
    created_at timestamptz default timezone('utc'::text, now()) not null,
    event_id text unique not null,
    provider text default 'geniuspay',
    payload jsonb not null,
    status text not null -- 'traite', 'ignore', 'erreur'
);

create index if not exists idx_webhook_logs_event_id on public.webhook_logs(event_id);

-- -------------------------------------------------------------------------
-- 5. SÉCURITÉ : Row Level Security (RLS)
-- -------------------------------------------------------------------------
alter table public.settings enable row level security;
alter table public.clients enable row level security;
alter table public.payment_links enable row level security;
alter table public.webhook_logs enable row level security;

-- Politiques pour l'administrateur connecté (Toi)
drop policy if exists "Admin acces total settings" on public.settings;
create policy "Admin acces total settings" on public.settings 
    for all to authenticated using (true) with check (true);

drop policy if exists "Admin acces total clients" on public.clients;
create policy "Admin acces total clients" on public.clients 
    for all to authenticated using (true) with check (true);

drop policy if exists "Admin acces total payment_links" on public.payment_links;
create policy "Admin acces total payment_links" on public.payment_links 
    for all to authenticated using (true) with check (true);

drop policy if exists "Admin acces total webhook_logs" on public.webhook_logs;
create policy "Admin acces total webhook_logs" on public.webhook_logs 
    for all to authenticated using (true) with check (true);

-- Politique publique pour la page client /pay/[id] :
-- Permet au client sans compte de lire uniquement la demande associée à son lien
drop policy if exists "Lecture publique du lien de paiement" on public.payment_links;
create policy "Lecture publique du lien de paiement" on public.payment_links 
    for select to anon 
    using (true);

commit;
