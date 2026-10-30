-- Migration : Support de l'envoi automatisé de reçus certifiés (Email & WhatsApp)
-- Date : 2026-10-30

-- 1. Ajout des colonnes de traçabilité des reçus dans la table payments
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS receipt_email text,
  ADD COLUMN IF NOT EXISTS receipt_sent_at timestamp with time zone;

-- 2. Index pour requêtes rapides sur les reçus
CREATE INDEX IF NOT EXISTS idx_payments_receipt_sent_at ON public.payments(receipt_sent_at);
