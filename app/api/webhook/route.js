import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Initialisation de Supabase avec la clé Service Role (contourne RLS pour le webhook)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    const body = await request.json();

    // ⚠️ IMPORTANT : À adapter avec l'en-tête de signature officiel de GeniusPay
    // const signature = request.headers.get("x-geniuspay-signature");

    console.log("[Webhook] Notification reçue de GeniusPay :", body);

    // Extraction des données (format indicatif en attendant la doc officielle GeniusPay)
    const { payment_id, status, transaction_ref } = body;

    if (!payment_id) {
      return NextResponse.json(
        { error: "ID de paiement manquant dans le webhook." },
        { status: 400 }
      );
    }

    // Mapping des statuts (à ajuster selon les valeurs renvoyées par GeniusPay)
    let newStatus = "en_attente";
    if (status === "SUCCESS" || status === "paid" || status === "paye") {
      newStatus = "paye";
    } else if (status === "FAILED" || status === "echoue") {
      newStatus = "echoue";
    }

    // Mise à jour du statut du paiement dans Supabase (Idempotence : on met à jour)
    const { data, error } = await supabaseAdmin
      .from("payments")
      .update({
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq("id", payment_id)
      .select()
      .single();

    if (error) {
      console.error("[Webhook] Erreur mise à jour Supabase :", error);
      return NextResponse.json(
        { error: "Erreur lors de la mise à jour en base de données." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, payment: data }, { status: 200 });
  } catch (err) {
    console.error("[Webhook] Erreur serveur :", err);
    return NextResponse.json(
      { error: "Erreur interne du serveur." },
      { status: 500 }
    );
  }
}