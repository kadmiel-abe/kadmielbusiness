import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Read .env.local
const envPath = path.resolve('.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value.trim();
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function main() {
  console.log("=== VÉRIFICATION DES TABLES SUPABASE AVANT REMISE À ZÉRO ===");
  
  const tables = ['payments', 'clients', 'transactions'];
  for (const table of tables) {
    try {
      const { data, count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
      if (error) {
        console.log(`Table '${table}': non trouvée ou erreur: ${error.message}`);
      } else {
        console.log(`Table '${table}': ${count} ligne(s) actuelle(s).`);
      }
    } catch (e) {
      console.log(`Table '${table}': exception ${e.message}`);
    }
  }

  console.log("\n=== VIDAGE DES DONNÉES DE TEST POUR LE DÉPLOIEMENT ===");

  // 1. Vidage de payments
  try {
    const { error: errPay, count: countPay } = await supabase
      .from('payments')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (errPay) console.error("Erreur vidage 'payments':", errPay);
    else console.log("✓ Table 'payments' vidée avec succès.");
  } catch (e) {
    console.error("Exception vidage 'payments':", e);
  }

  // 2. Vidage de transactions (si elle existe)
  try {
    const { error: errTx } = await supabase
      .from('transactions')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (errTx) console.log("Table 'transactions':", errTx.message);
    else console.log("✓ Table 'transactions' vidée avec succès.");
  } catch (e) {
    console.log("Exception vidage 'transactions':", e.message);
  }

  // 3. Vidage de clients
  try {
    const { error: errCli } = await supabase
      .from('clients')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (errCli) console.error("Erreur vidage 'clients':", errCli);
    else console.log("✓ Table 'clients' vidée avec succès.");
  } catch (e) {
    console.error("Exception vidage 'clients':", e);
  }

  console.log("\n=== VÉRIFICATION FINALE (POST REMISE À ZÉRO) ===");
  for (const table of tables) {
    try {
      const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
      if (!error) {
        console.log(`Table '${table}': ${count} ligne(s) restante(s). ${count === 0 ? '✓ PROPRE & VIDE' : '⚠️ NON VIDE'}`);
      }
    } catch {}
  }
}

main().catch(console.error);
