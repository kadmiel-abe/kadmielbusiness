import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  buildWhatsAppReceiptUrl,
  buildWhatsAppReceiptMessage,
  sendReceiptEmail,
} from "@/lib/receiptService";
import { getClientIp, checkRateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/receipt/send
 * Déclenche l'envoi automatique d'un reçu officiel certifié par Email ou WhatsApp.
 * Sécurisé : Rate limiting anti-spam et validation stricte du format email et paymentId.
 */
export async function POST(request) {
  try {
    // 1. Protection Anti-Spam / Rate Limiting (6 envois max par 10 min par IP)
    const clientIp = getClientIp(request);
    const rateCheck = checkRateLimit({
      key: `receipt-send:${clientIp}`,
      limit: 6,
      windowMs: 10 * 60 * 1000,
    });

    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: "Trop de demandes d'envoi de reçu. Veuillez patienter quelques minutes." },
        { status: 429 }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Format JSON invalide dans le corps de la requête." },
        { status: 400 }
      );
    }

    const { paymentId, email, channel = "email" } = body || {};

    if (!paymentId || typeof paymentId !== "string") {
      return NextResponse.json(
        { error: "L'identifiant du paiement (paymentId) est requis." },
        { status: 400 }
      );
    }

    const cleanPaymentId = paymentId.trim();
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(cleanPaymentId)) {
      return NextResponse.json(
        { error: "Format d'identifiant de paiement invalide." },
        { status: 400 }
      );
    }

    const cleanChannel = String(channel).toLowerCase().trim();
    if (!["email", "whatsapp"].includes(cleanChannel)) {
      return NextResponse.json(
        { error: "Canal d'envoi invalide ('email' ou 'whatsapp' attendu)." },
        { status: 400 }
      );
    }

    // 2. Récupération de la transaction et des informations client associées
    const { data: payment, error: fetchErr } = await supabaseAdmin
      .from("payments")
      .select("*, client:clients(*)")
      .eq("id", cleanPaymentId)
      .single();

    if (fetchErr || !payment) {
      return NextResponse.json(
        { error: "Paiement introuvable." },
        { status: 404 }
      );
    }

    // 3. Vérifier que le paiement est bien payé
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
    const targetEmail = String(email || client.email || "").trim().slice(0, 100);

    // 4. Canal EMAIL
    if (cleanChannel === "email") {
      // Validation stricte du format email (RFC 5322 simplifié)
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!targetEmail || !emailRegex.test(targetEmail)) {
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

    // 5. Canal WHATSAPP
    if (cleanChannel === "whatsapp") {
      const whatsappUrl = buildWhatsAppReceiptUrl(payment, baseUrl);
      const whatsappMessage = buildWhatsAppReceiptMessage(payment, baseUrl);

      // Enregistrer l'horodatage d'envoi du reçu (non bloquant si colonne non migrée)
      try {
        await supabaseAdmin
          .from("payments")
          .update({ receipt_sent_at: new Date().toISOString() })
          .eq("id", payment.id);
      } catch (logErr) {
        console.warn("[Receipt Send] Mise à jour receipt_sent_at ignorée :", logErr?.message);
      }

      return NextResponse.json({
        success: true,
        channel: "whatsapp",
        whatsappUrl,
        message: "Lien WhatsApp généré avec succès.",
      });
    }

    return NextResponse.json(
      { error: "Canal non supporté." },
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
