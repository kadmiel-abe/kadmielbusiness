"use server";

import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getFeeSettings, calculatePaymentAmounts } from "@/lib/pricing";

/**
 * Server Action: creerLienPaiement
 * Sécurisée : Vérifie la session active avant toute opération en base.
 */
export async function creerLienPaiement(formData) {
  const cookieStore = cookies();
  const supabase = createServerComponentClient({ cookies: () => cookieStore });

  // 1. Contrôle d'accès : Session requise
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new Error("Action non autorisée : Vous devez être connecté.");
  }

  const nom = String(formData.get("nom") || "").trim().slice(0, 100);
  const telephone = String(formData.get("telephone") || "").trim().slice(0, 30);
  const email = formData.get("email") ? String(formData.get("email")).trim().slice(0, 100) : null;
  const service = String(formData.get("service") || "").trim().slice(0, 150);
  const montantNet = Number(formData.get("montant_net"));

  if (!nom || !telephone || !service || isNaN(montantNet) || montantNet <= 0) {
    throw new Error("Tous les champs obligatoires doivent être renseignés avec des valeurs valides.");
  }

  // 2. Calcul des frais selon la formule officielle
  const feeSettings = await getFeeSettings();
  const calculated = calculatePaymentAmounts(montantNet, {
    rate: feeSettings.rate,
    fixedFee: feeSettings.fixedFee,
    feeBearer: "client",
  });

  const montantTotal = calculated.total_amount;

  try {
    // 3. Gestion du client dans Supabase
    let clientId;
    const { data: existingClient } = await supabase
      .from("clients")
      .select("id")
      .eq("phone", telephone)
      .maybeSingle();

    if (existingClient?.id) {
      clientId = existingClient.id;
    } else {
      const { data: newClient, error: clientError } = await supabase
        .from("clients")
        .insert([{ name: nom, phone: telephone, email }])
        .select("id")
        .single();

      if (clientError) throw clientError;
      clientId = newClient.id;
    }

    // 4. Enregistrement du paiement
    const paymentId = crypto.randomUUID();
    const { error: paymentError } = await supabase.from("payments").insert([
      {
        id: paymentId,
        client_id: clientId,
        service_name: service,
        amount_net: montantNet,
        amount_total: montantTotal,
        fee_amount: calculated.fee_amount,
        status: "en_attente",
        is_single_use: true,
        max_uses: 1,
        times_used: 0,
      },
    ]);

    if (paymentError) throw paymentError;
  } catch (err) {
    console.error("Erreur serveur création paiement :", err);
    throw new Error(err.message || "Erreur interne.");
  }

  redirect("/dashboard");
}