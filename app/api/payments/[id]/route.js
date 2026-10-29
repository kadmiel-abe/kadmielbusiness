import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(request, { params }) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "ID de paiement manquant." }, { status: 400 });
    }

    const { data: payment, error } = await supabaseAdmin
      .from("payments")
      .select("id, client_name, service_name, amount_net, amount_total, status, created_at")
      .eq("id", id)
      .single();

    if (error || !payment) {
      return NextResponse.json({ error: "Lien de paiement introuvable ou expiré." }, { status: 404 });
    }

    return NextResponse.json({ payment }, { status: 200 });
  } catch (err) {
    console.error("[API Get Payment] Erreur :", err);
    return NextResponse.json({ error: "Erreur interne du serveur." }, { status: 500 });
  }
}