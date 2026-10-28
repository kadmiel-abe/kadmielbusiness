# Kadmiel Business - Module de Paiement GeniusPay & Supabase

API backend Next.js pour la gestion des paiements sécurisés via GeniusPay et la synchronisation avec Supabase.

## Fonctionnalités

- **Initialisation de Paiement (`/api/create-payment`)** :
  - Création de session de paiement auprès de l'API GeniusPay
  - Récupération des informations de commande et client depuis Supabase
  - Sauvegarde de la référence de paiement (`geniuspay_ref`)
  - Redirection du client vers la page de checkout sécurisée

- **Traitement Webhook Idempotent (`/api/webhook`)** :
  - Validation de la signature cryptographique HMAC-SHA256
  - Protection contre les attaques temporelles (`timingSafeEqual`)
  - Protection contre le rejeu via fenêtre de tolérance sur l'en-tête horodaté
  - Mise à jour atomique du statut (`en_attente` -> `paye`) avec idempotence garantie

- **Administration Supabase (`/lib/supabaseAdmin.js`)** :
  - Client Supabase avec clé Service Role côté serveur

## Configuration

1. Copier le fichier `.env.example` en `.env.local` :
   ```bash
   cp .env.example .env.local
   ```

2. Renseigner les variables nécessaires dans `.env.local` :
   - `NEXT_PUBLIC_APP_URL` : URL publique de l'application (locale en développement).
   - `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` : configuration du client public Supabase.
   - `SUPABASE_SERVICE_ROLE_KEY` : clé serveur privée, ne jamais la préfixer par `NEXT_PUBLIC_` ni la publier.
   - `GENIUSPAY_MODE` : `mock` par défaut en développement ; le flux simulé sera implémenté en phase D.
   - `GENIUSPAY_API_KEY`, `GENIUSPAY_SECRET_KEY` et `GENIUSPAY_WEBHOOK_SECRET` : secrets serveur GeniusPay.
   - `GENIUSPAY_API_SECRET` est conservée temporairement pour compatibilité avec l'ancienne route de paiement.

## Phase A — schéma Supabase

La migration `supabase/migrations/20261028120000_create_private_transactions_schema.sql`
prépare les tables `transactions` et `dashboard_admins`, active la RLS et restreint
l'accès client aux comptes explicitement autorisés. Elle ajoute également les colonnes
`nom` et `telephone` à la table historique `clients`, en synchronisant ces champs avec
`name` et `phone` pour ne pas casser les routes déjà présentes.

Appliquer la migration depuis le SQL Editor Supabase ou avec la CLI Supabase. Ensuite,
récupérer l'UUID du compte propriétaire dans **Authentication → Users** et l'ajouter
dans `public.dashboard_admins` avec l'instruction commentée à la fin de la migration.
Les routes serveur qui utilisent `SUPABASE_SERVICE_ROLE_KEY` contournent la RLS ; cette
clé doit rester côté serveur uniquement.
