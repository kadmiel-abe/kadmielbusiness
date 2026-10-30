import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  buildWhatsAppReceiptUrl,
  buildWhatsAppReceiptMessage,
  sendReceiptEmail,
} from "@/lib/receiptService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/receipt/send
 * Déclenche l'envoi automatique d'un reçu officiel certifié par Email ou WhatsApp.
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { paymentId, email, channel = "email" } = body || {};

    if (!paymentId) {
      return NextResponse.json(
        { error: "L'identifiant du paiement (paymentId) est requis." },
        { status: 400 }
      );
    }

    // Récupération de la transaction et des informations client associées
    const { data: payment, error: fetchErr } = await supabaseAdmin
      .from("payments")
      .select("*, client:clients(*)")
      .eq("id", paymentId)
      .single();

    if (fetchErr || !payment) {
      return NextResponse.json(
        { error: "Paiement introuvable." },
        { status: 404 }
      );
    }

    // Vérifier que le paiement est bien payé
    const isPaid = payment.status === "paye" || payment.statut === "paye";
    if (!isPaid) {
      return NextResponse.json(
        { error: "Le reçu ne peut être émis que pour un paiement validé et encaissé." },
        { status: 400 }
      );
    }

    const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "kadmielbusiness.vercel.app";
    const protocol = request.headers.get("x-forwarded-proto") || "https";
    const baseUrl = `${protocol}://${host}`;

    const client = payment.client || {};
    const targetEmail = (email || client.email || "").trim();

    // 1. Canal EMAIL
    if (channel === "email") {
      if (!targetEmail) {
        return NextResponse.json(
          { error: "Veuillez renseigner une adresse email valide pour recevoir le reçu." },
          { status: 400 }
        );
      }

      const emailResult = await sendReceiptEmail({
        toEmail: targetEmail,
        payment,
        baseUrl,
      });

      // Mettre à jour l'email du client si pas encore renseigné
      if (client.id && !client.email && targetEmail) {
        await supabaseAdmin
          .from("clients")
          .update({ email: targetEmail })
          .eq("id", client.id);
      }

      return NextResponse.json({
        success: true,
        channel: "email",
        toEmail: targetEmail,
        mode: emailResult.mode,
        receiptUrl: `${baseUrl}/receipt/${payment.id}`,
        message: `Reçu officiel envoyé avec succès à l'adresse ${targetEmail}.`,
      });
    }

    // 2. Canal WHATSAPP
    if (channel === "whatsapp") {
      const whatsappUrl = buildWhatsAppReceiptUrl(payment, baseUrl);
      const whatsappMessage = buildWhatsAppReceiptMessage(payment, baseUrl);

      // Enregistrer l'horodatage d'envoi du reçu
      await supabaseAdmin
        .from("payments")
        .update({ receipt_sent_at: new Date().toISOString() })
        .eq("id", paymentId);

      return NextResponse.json({
        success: true,
        channel: "whatsapp",
        whatsappUrl,
        message: "Lien WhatsApp généré avec succès.",
      });
    }

    return NextResponse.json(
      { error: "Canal d'envoi invalide ('email' ou 'whatsapp' attendu)." },
      { status: 400 }
    );
  } catch (error) {
    console.error("[API /api/receipt/send] Exception :", error);
    return NextResponse.json(
      { error: "Erreur interne lors de l'envoi automatique du reçu." },
      { status: 500 }
    );
  }
}
