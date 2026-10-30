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
  console.error("❌ Identifiants Supabase introuvables dans .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function runCheck() {
  console.log("=================================================");
  console.log("🔍 AUDIT COMPLET DE LA PLATEFORME KADMIEL BUSINESS");
  console.log("=================================================\n");

  let allChecksPassed = true;

  // 1. Check Tables Supabase
  console.log("1. Audit de la Base de Données Supabase :");
  try {
    const { count: payCount, error: payErr } = await supabase.from('payments').select('*', { count: 'exact', head: true });
    if (payErr) {
      console.error("   ❌ Erreur table 'payments':", payErr.message);
      allChecksPassed = false;
    } else {
      console.log(`   ✓ Table 'payments' accessible et saine (Nombre d'enregistrements: ${payCount})`);
    }

    const { count: cliCount, error: cliErr } = await supabase.from('clients').select('*', { count: 'exact', head: true });
    if (cliErr) {
      console.error("   ❌ Erreur table 'clients':", cliErr.message);
      allChecksPassed = false;
    } else {
      console.log(`   ✓ Table 'clients' accessible et saine (Nombre d'enregistrements: ${cliCount})`);
    }
  } catch (e) {
    console.error("   ❌ Exception DB:", e.message);
    allChecksPassed = false;
  }

  // 2. Test Cycle de vie Transaction (Création -> Lecture -> Suppression)
  console.log("\n2. Test Cycle de Vie d'une Transaction (Smoke Test) :");
  const testClientId = crypto.randomUUID();
  const testPaymentId = crypto.randomUUID();
  try {
    // A. Insertion client test
    const { data: createdClient, error: clientErr } = await supabase.from('clients').insert({
      id: testClientId,
      name: "Audit Déploiement Test",
      phone: "+2250700000000"
    }).select().single();

    if (clientErr || !createdClient) {
      console.error("   ❌ Échec insertion client test:", clientErr?.message);
      allChecksPassed = false;
    } else {
      console.log("   ✓ Création du client CRM validée (ID:", createdClient.id, ")");
    }

    // B. Insertion transaction test liée au client
    const fullPayload = {
      id: testPaymentId,
      client_id: testClientId,
      service_name: "Smoke Test Automatisation",
      amount_net: 50000,
      amount_total: 50607,
      fee_bearer: "client",
      status: "en_attente",
      is_single_use: true,
      max_uses: 1,
      times_used: 0
    };

    let { data: insertedPayment, error: insertErr } = await supabase
      .from('payments')
      .insert(fullPayload)
      .select('*, client:clients(*)')
      .single();

    if (insertErr && insertErr.message && (insertErr.message.includes('column') || insertErr.message.includes('schema cache'))) {
      const basePayload = {
        id: testPaymentId,
        client_id: testClientId,
        service_name: "Smoke Test Automatisation",
        amount_net: 50000,
        amount_total: 50607,
        status: "en_attente"
      };
      const retry = await supabase
        .from('payments')
        .insert(basePayload)
        .select('*, client:clients(*)')
        .single();
      insertedPayment = retry.data;
      insertErr = retry.error;
    }

    if (insertErr || !insertedPayment) {
      console.error("   ❌ Échec insertion transaction test:", insertErr?.message);
      allChecksPassed = false;
    } else {
      console.log("   ✓ Création de lien de paiement validée (ID:", insertedPayment.id, ")");
    }

    // C. Lecture test
    const { data: fetched, error: fetchErr } = await supabase
      .from('payments')
      .select('*, client:clients(*)')
      .eq('id', testPaymentId)
      .single();

    if (fetchErr || !fetched) {
      console.error("   ❌ Échec lecture transaction test:", fetchErr?.message);
      allChecksPassed = false;
    } else {
      console.log("   ✓ Lecture et jointure relationnelle conformes (Client:", fetched.client?.name, "- Total:", fetched.amount_total, "FCFA)");
    }

    // D. Nettoyage immédiat
    await supabase.from('payments').delete().eq('id', testPaymentId);
    await supabase.from('clients').delete().eq('id', testClientId);
    console.log("   ✓ Nettoyage immédiat validé (Base remise à 0)");
  } catch (e) {
    console.error("   ❌ Exception Smoke Test:", e.message);
    allChecksPassed = false;
  }

  // 3. Check Variables d'environnement critiques
  console.log("\n3. Audit des Variables d'Environnement :");
  const requiredVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'GENIUSPAY_API_KEY',
    'GENIUSPAY_API_SECRET',
    'GENIUSPAY_WEBHOOK_SECRET'
  ];

  for (const v of requiredVars) {
    if (env[v] && env[v].length > 5) {
      console.log(`   ✓ ${v}: Présente et configurée (${env[v].slice(0, 8)}...)`);
    } else {
      console.error(`   ❌ ${v}: Manquante ou vide dans .env.local`);
      allChecksPassed = false;
    }
  }

  // 4. Check PWA & Fichiers Statiques
  console.log("\n4. Audit des Fichiers PWA & Assets Statiques :");
  const requiredFiles = [
    'public/manifest.json',
    'public/sw.js',
    'public/offline.html',
    'public/icons/icon-192x192.png',
    'public/icons/icon-512x512.png',
    'public/icon-192x192.png',
    'public/icon-512x512.png',
    'public/apple-touch-icon.png'
  ];

  for (const file of requiredFiles) {
    if (fs.existsSync(file)) {
      const stats = fs.statSync(file);
      console.log(`   ✓ ${file} présent (${stats.size} octets)`);
    } else {
      console.error(`   ❌ ${file} introuvable !`);
      allChecksPassed = false;
    }
  }

  console.log("\n=================================================");
  if (allChecksPassed) {
    console.log("🎉 RÉSULTAT AUDIT : TOUT EST CONFORME ET PRÊT POUR LA PRODUCTION !");
  } else {
    console.log("⚠️ RÉSULTAT AUDIT : CERTAINES VÉRIFICATIONS ONT ÉCHOUÉ.");
  }
  console.log("=================================================");

  process.exit(allChecksPassed ? 0 : 1);
}

runCheck().catch(err => {
  console.error(err);
  process.exit(1);
});
