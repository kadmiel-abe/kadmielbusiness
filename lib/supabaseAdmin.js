import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.warn(
    '[SupabaseAdmin] Attention: Les variables NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY sont manquantes.'
  );
}

/**
 * Client Supabase Admin avec privilèges complets (Service Role).
 * Bypass les RLS pour les opérations serveur sécurisées (création paiement, webhook).
 * À utiliser EXCLUSIVEMENT côté serveur (API Routes / Server Actions).
 */
export const supabaseAdmin = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseServiceRoleKey || 'placeholder-key',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);
