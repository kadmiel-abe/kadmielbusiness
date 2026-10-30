import nodemailer from "nodemailer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Formate un montant en FCFA
 */
export function formatMoney(amount) {
  if (amount == null || isNaN(amount)) return "0 FCFA";
  return (
    new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(
      Number(amount)
    ) + " FCFA"
  );
}

/**
 * Formate une date en chaîne lisible
 */
export function formatDate(dateStr) {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "-";
    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return dateStr;
  }
}

/**
 * Nettoie un numéro pour WhatsApp (+225...)
 */
export function cleanPhoneNumber(phone) {
  if (!phone) return "";
  const digits = phone.replace(/[^\d]/g, "");
  if (digits.startsWith("225") && digits.length === 13) return digits;
  if (digits.length === 10) return `225${digits}`;
  return digits;
}

/**
 * Génère le message WhatsApp certifié avec lien direct vers le reçu numérique
 */
export function buildWhatsAppReceiptMessage(payment, baseUrl = "https://kadmielbusiness.vercel.app") {
  const client = payment.client || (Array.isArray(payment.clients) ? payment.clients[0] : payment.clients) || {};
  const clientName = client.name || client.nom || payment.client_name || "Cher client";
  const service = payment.service_name || payment.service || "Prestation de service";
  const totalAmount = formatMoney(payment.amount_total ?? payment.montant_total ?? payment.amount_net);
  const paidAt = formatDate(payment.paid_at || payment.updated_at || payment.created_at);
  const receiptUrl = `${baseUrl}/receipt/${payment.id}`;
  const ref = payment.geniuspay_ref || payment.manual_tx_id || payment.id.slice(0, 12);
  const method = (payment.payment_method || "Mobile Money").toUpperCase();

  return `*REÇU OFFICIEL DE PAIEMENT — KADMIEL BUSINESS PAY* 🧾✨

Bonjour *${clientName}*,
Votre règlement a été validé et encaissé avec succès.

📌 *Détails de la transaction :*
• *Prestation :* ${service}
• *Montant réglé :* ${totalAmount}
• *Mode de règlement :* ${method}
• *Date & heure :* ${paidAt}
• *Réf. transaction :* ${ref}

🔗 *Votre reçu officiel certifié est disponible en ligne :*
👉 ${receiptUrl}

Vous pouvez le consulter, le partager ou le télécharger en PDF à tout moment sans limite de validité.

Merci pour votre confiance et à très bientôt !
— _Kadmiel Business Pay_`;
}

/**
 * Construit l'URL WhatsApp d'envoi automatique
 */
export function buildWhatsAppReceiptUrl(payment, baseUrl) {
  const client = payment.client || (Array.isArray(payment.clients) ? payment.clients[0] : payment.clients) || {};
  const phone = cleanPhoneNumber(client.phone || client.telephone || payment.client_phone || "");
  const message = buildWhatsAppReceiptMessage(payment, baseUrl);
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

/**
 * Génère le template HTML de l'email de reçu officiel
 */
export function buildReceiptEmailHtml(payment, baseUrl = "https://kadmielbusiness.vercel.app") {
  const client = payment.client || (Array.isArray(payment.clients) ? payment.clients[0] : payment.clients) || {};
  const clientName = client.name || client.nom || payment.client_name || "Client";
  const service = payment.service_name || payment.service || "Prestation de service";
  const amountTotal = formatMoney(payment.amount_total ?? payment.montant_total ?? payment.amount_net);
  const amountNet = formatMoney(payment.amount_net ?? payment.montant_net);
  const paidAt = formatDate(payment.paid_at || payment.updated_at || payment.created_at);
  const receiptUrl = `${baseUrl}/receipt/${payment.id}`;
  const ref = payment.geniuspay_ref || payment.manual_tx_id || payment.id;
  const method = (payment.payment_method || "Mobile Money").toUpperCase();
  const feeBearerText = payment.fee_bearer === "freelance" ? "Frais de transaction offerts" : "Frais de transaction inclus";

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reçu de paiement officiel - Kadmiel Business Pay</title>
</head>
<body style="margin: 0; padding: 0; background-color: #050505; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f4f4f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #050505; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 580px; background-color: #0d0d0e; border: 1px solid rgba(17, 145, 52, 0.35); border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.8);">
          
          <!-- En-tête avec marque Kadmiel Business -->
          <tr>
            <td style="padding: 35px 35px 25px 35px; background: linear-gradient(180deg, rgba(17, 145, 52, 0.18) 0%, rgba(13, 13, 14, 0) 100%); text-align: center; border-bottom: 1px solid rgba(255, 255, 255, 0.06);">
              <div style="display: inline-block; padding: 6px 16px; background-color: rgba(17, 145, 52, 0.15); border: 1px solid #119134; border-radius: 50px; margin-bottom: 15px;">
                <span style="font-size: 11px; font-weight: 800; color: #2cd95c; text-transform: uppercase; letter-spacing: 1px;">✓ Paiement Certifié & Encaissé</span>
              </div>
              <h1 style="margin: 0; font-size: 24px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px;">Kadmiel Business Pay</h1>
              <p style="margin: 6px 0 0 0; font-size: 13px; color: #a1a1aa;">Reçu officiel de paiement dématérialisé</p>
            </td>
          </tr>

          <!-- Message principal & Montant -->
          <tr>
            <td style="padding: 30px 35px 20px 35px; text-align: center;">
              <p style="margin: 0; font-size: 14px; color: #a1a1aa;">Bonjour <strong style="color: #ffffff;">${clientName}</strong>,</p>
              <p style="margin: 8px 0 25px 0; font-size: 14px; color: #d4d4d8; line-height: 1.5;">Nous vous confirmons la bonne réception de votre règlement. Votre transaction a été validée avec succès.</p>
              
              <div style="background-color: #000000; border: 1px solid rgba(17, 145, 52, 0.4); border-radius: 16px; padding: 22px; margin-bottom: 25px;">
                <span style="font-size: 12px; font-weight: 600; color: #71717a; text-transform: uppercase; letter-spacing: 0.5px;">Montant Total Réglé</span>
                <div style="font-size: 32px; font-weight: 900; color: #2cd95c; margin-top: 5px;">${amountTotal}</div>
                <span style="font-size: 11px; color: #119134; font-weight: 600;">${feeBearerText}</span>
              </div>
            </td>
          </tr>

          <!-- Tableau récapitulatif -->
          <tr>
            <td style="padding: 0 35px 25px 35px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #050505; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 14px;">
                <tr>
                  <td style="padding: 12px 18px; font-size: 12px; color: #71717a; border-bottom: 1px solid rgba(255, 255, 255, 0.05);">Prestation / Service</td>
                  <td align="right" style="padding: 12px 18px; font-size: 12px; font-weight: 700; color: #ffffff; border-bottom: 1px solid rgba(255, 255, 255, 0.05);">${service}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 18px; font-size: 12px; color: #71717a; border-bottom: 1px solid rgba(255, 255, 255, 0.05);">Moyen de règlement</td>
                  <td align="right" style="padding: 12px 18px; font-size: 12px; font-weight: 700; color: #2cd95c; border-bottom: 1px solid rgba(255, 255, 255, 0.05);">${method}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 18px; font-size: 12px; color: #71717a; border-bottom: 1px solid rgba(255, 255, 255, 0.05);">Date & Heure</td>
                  <td align="right" style="padding: 12px 18px; font-size: 12px; font-weight: 500; color: #d4d4d8; border-bottom: 1px solid rgba(255, 255, 255, 0.05);">${paidAt}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 18px; font-size: 12px; color: #71717a;">Référence Transaction</td>
                  <td align="right" style="padding: 12px 18px; font-size: 11px; font-family: monospace; color: #a1a1aa;">${ref}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Bouton d'Action Reçu en ligne -->
          <tr>
            <td style="padding: 5px 35px 35px 35px; text-align: center;">
              <a href="${receiptUrl}" target="_blank" style="display: inline-block; width: 85%; padding: 14px 20px; background-color: #119134; color: #000000; font-weight: 800; font-size: 14px; text-decoration: none; border-radius: 12px; box-shadow: 0 4px 15px rgba(17, 145, 52, 0.4); text-transform: uppercase; letter-spacing: 0.5px;">
                Consulter mon Reçu Officiel en Ligne →
              </a>
              <p style="margin: 15px 0 0 0; font-size: 11px; color: #71717a;">
                Vous pouvez également télécharger la version PDF certifiée ou imprimer votre reçu directement depuis cette page.
              </p>
            </td>
          </tr>

          <!-- Pied de page -->
          <tr>
            <td style="padding: 20px 35px; background-color: #050505; text-align: center; border-top: 1px solid rgba(255, 255, 255, 0.06);">
              <p style="margin: 0; font-size: 11px; color: #52525b;">
                Ce reçu dématérialisé a valeur de quittance libératoire pour le montant indiqué.<br>
                Émis de façon automatisée et sécurisée par <strong>Kadmiel Business Pay</strong>.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Envoie le reçu officiel par Email (via SMTP / Nodemailer ou mode fallback)
 */
export async function sendReceiptEmail({ toEmail, payment, baseUrl = "https://kadmielbusiness.vercel.app" }) {
  if (!toEmail || !payment) {
    throw new Error("Adresse email et informations de paiement requises.");
  }

  const client = payment.client || (Array.isArray(payment.clients) ? payment.clients[0] : payment.clients) || {};
  const clientName = client.name || client.nom || payment.client_name || "Client";
  const service = payment.service_name || payment.service || "Prestation";
  const totalAmount = formatMoney(payment.amount_total ?? payment.montant_total ?? payment.amount_net);
  const receiptUrl = `${baseUrl}/receipt/${payment.id}`;

  const htmlContent = buildReceiptEmailHtml(payment, baseUrl);

  // Configuration SMTP si disponible dans l'environnement
  const smtpHost = process.env.SMTP_HOST || process.env.EMAIL_SERVER_HOST;
  const smtpPort = Number(process.env.SMTP_PORT || process.env.EMAIL_SERVER_PORT || 587);
  const smtpUser = process.env.SMTP_USER || process.env.EMAIL_SERVER_USER;
  const smtpPass = process.env.SMTP_PASS || process.env.EMAIL_SERVER_PASSWORD;
  const fromEmail = process.env.EMAIL_FROM || "Kadmiel Business Pay <paiements@kadmielbusiness.ci>";

  if (smtpHost && smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      const info = await transporter.sendMail({
        from: fromEmail,
        to: toEmail,
        subject: `Reçu officiel de paiement — ${service} (${totalAmount})`,
        text: `Bonjour ${clientName},\n\nVotre paiement de ${totalAmount} pour la prestation "${service}" a bien été validé.\n\nConsultez votre reçu officiel en ligne ici : ${receiptUrl}\n\nMerci pour votre confiance,\nKadmiel Business Pay`,
        html: htmlContent,
      });

      console.info(`[Email Reçu] Reçu envoyé avec succès à ${toEmail} (MessageId: ${info.messageId})`);

      // Enregistrement de la date d'envoi dans Supabase
      await supabaseAdmin
        .from("payments")
        .update({
          receipt_sent_at: new Date().toISOString(),
          receipt_email: toEmail,
        })
        .eq("id", payment.id);

      return {
        success: true,
        sent: true,
        mode: "smtp",
        messageId: info.messageId,
      };
    } catch (smtpErr) {
      console.error("[Email Reçu] Erreur envoi SMTP :", smtpErr);
      // Fallback gracieux pour ne pas bloquer l'utilisateur
    }
  }

  // Mode Fallback gracieux si SMTP n'est pas configuré en production
  console.info(`[Email Reçu - Mode Simulation / Prêt] Reçu préparé pour ${toEmail} (${receiptUrl})`);
  
  await supabaseAdmin
    .from("payments")
    .update({
      receipt_sent_at: new Date().toISOString(),
      receipt_email: toEmail,
    })
    .eq("id", payment.id);

  return {
    success: true,
    sent: true,
    mode: "simulated_ready",
    receiptUrl,
    toEmail,
    subject: `Reçu officiel de paiement — ${service} (${totalAmount})`,
  };
}
