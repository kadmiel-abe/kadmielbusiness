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

2. Renseigner vos variables d'environnement dans `.env.local` :
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `GENIUSPAY_API_KEY`
   - `GENIUSPAY_API_SECRET`
   - `GENIUSPAY_WEBHOOK_SECRET`
