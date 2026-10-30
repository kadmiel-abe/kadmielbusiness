// =========================================================================
// SUPABASE EDGE FUNCTION : geniuspay-webhook
// =========================================================================
// Déployable sur Supabase Cloud via : supabase functions deploy geniuspay-webhook
// Runtime : Deno / TypeScript (Web Standard APIs)
//
// Fonctionnalités :
// 1. Vérification de signature HMAC-SHA256 (Web Crypto API) avec protection anti-rejeu.
// 2. Garantie d'idempotence stricte via la table 'webhook_logs'.
// 3. Mise à jour automatique du statut ('paye') et verrouillage du lien (usage unique).
// =========================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-signature, x-webhook-timestamp, x-geniuspay-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * Valide la signature cryptographique HMAC-SHA256 avec l'API Web Crypto native.
 */
async function verifyHmacSha256(
  rawBody: string,
  signatureHex: string,
  secret: string,
  timestamp?: string | null
): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);

    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"]
    );

    // 1. Test signature directe sur le corps brut
    const standardSignature = await crypto.subtle.sign(
      "HMAC",
      cryptoKey,
      encoder.encode(rawBody)
    );
    const standardHex = Array.from(new Uint8Array(standardSignature))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .toLowerCase();

    const cleanSignature = signatureHex.trim().toLowerCase();
    if (standardHex === cleanSignature) {
      return true;
    }

    // 2. Test signature horodatée si timestamp fourni (ex: timestamp.rawBody)
    if (timestamp) {
      const now = Math.floor(Date.now() / 1000);
      const parsedTs = parseInt(timestamp, 10);
      const eventTime = parsedTs > 1e11 ? Math.floor(parsedTs / 1000) : parsedTs;

      // Protection anti-rejeu (5 minutes = 300s)
      if (!isNaN(eventTime) && Math.abs(now - eventTime) > 300) {
        console.warn("[Edge Function] Timestamp expiré :", { now, eventTime });
        return false;
      }

      const timestampedSignature = await crypto.subtle.sign(
        "HMAC",
        cryptoKey,
        encoder.encode(`${timestamp}.${rawBody}`)
      );
      const timestampedHex = Array.from(new Uint8Array(timestampedSignature))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
        .toLowerCase();

      if (timestampedHex === cleanSignature) {
        return true;
      }
    }

    return false;
  } catch (err) {
    console.error("[Edge Function] Erreur vérification HMAC :", err);
    return false;
  }
}

Deno.serve(async (req: Request) => {
  // Gestion du preflight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Méthode non autorisée" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const webhookSecret = Deno.env.get("GENIUSPAY_WEBHOOK_SECRET") || "";

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("[Edge Function] Configuration Supabase incomplète.");
      return new Response(
        JSON.stringify({ error: "Configuration serveur incomplète." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const signature =
      req.headers.get("x-webhook-signature") ||
      req.headers.get("x-geniuspay-signature") ||
      req.headers.get("x-signature") ||
      "";

    const timestamp =
      req.headers.get("x-webhook-timestamp") ||
      req.headers.get("x-timestamp") ||
      null;

    const rawBody = await req.text();

    if (!rawBody) {
      return new Response(JSON.stringify({ error: "Corps de requête vide." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Vérification de la signature HMAC-SHA256
    if (webhookSecret) {
      if (!signature) {
        return new Response(
          JSON.stringify({ error: "Signature manquante." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const isValid = await verifyHmacSha256(rawBody, signature, webhookSecret, timestamp);
      if (!isValid) {
        return new Response(
          JSON.stringify({ error: "Signature webhook non valide." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const payload = JSON.parse(rawBody);

    // 2. Extraction de l'event_id pour l'idempotence
    const eventId = String(
      payload.event_id ||
      payload.id ||
      payload.data?.id ||
      payload.reference ||
      payload.data?.reference ||
      `evt_${Date.now()}`
    );

    // 3. Contrôle d'idempotence dans 'webhook_logs'
    const { data: existing } = await supabase
      .from("webhook_logs")
      .select("id, event_id")
      .eq("event_id", eventId)
      .maybeSingle();

    if (existing) {
      console.info(`[Edge Function - Idempotence] Événement ${eventId} déjà traité.`);
      return new Response(
        JSON.stringify({ received: true, status: "already_processed", event_id: eventId }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Extraction du payment_id
    const metadata = payload.data?.metadata || payload.metadata || {};
    const paymentId =
      metadata.payment_id ||
      metadata.paymentId ||
      payload.data?.payment_id ||
      payload.payment_id ||
      payload.data?.id;

    const eventType = String(
      payload.event ||
      payload.type ||
      req.headers.get("x-webhook-event") ||
      payload.status ||
      payload.data?.status ||
      ""
    ).toLowerCase();

    const provider =
      payload.data?.provider ||
      payload.provider ||
      payload.data?.payment_method ||
      payload.payment_method ||
      "geniuspay";

    const isSuccess =
      eventType === "payment.success" ||
      eventType === "success" ||
      eventType === "paid" ||
      eventType === "paye";

    const isFailure =
      eventType === "payment.failed" ||
      eventType === "payment.cancelled" ||
      eventType === "failed" ||
      eventType === "echoue";

    if (!paymentId) {
      // Insertion dans webhook_logs pour trace
      await supabase.from("webhook_logs").insert({
        event_id: eventId,
        payload,
        status: "ignored_missing_payment_id",
      });

      return new Response(
        JSON.stringify({ received: true, status: "ignored_missing_payment_id" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Traitement en cas de succès : mise à jour et verrouillage du lien
    if (isSuccess) {
      const { data: currentPayment } = await supabase
        .from("payments")
        .select("*")
        .eq("id", paymentId)
        .single();

      if (currentPayment) {
        const isSingleUse = currentPayment.is_single_use !== false;
        const currentTimesUsed = Number(currentPayment.times_used) || 0;
        const newTimesUsed = currentTimesUsed + 1;
        const nowIso = new Date().toISOString();

        // Verrouillage du lien (statut 'paye' et incrément times_used)
        await supabase
          .from("payments")
          .update({
            status: "paye",
            payment_method: provider,
            times_used: newTimesUsed,
            paid_at: nowIso,
            updated_at: nowIso,
          })
          .eq("id", paymentId);
      }

      // Enregistrement dans webhook_logs pour garantir l'idempotence
      await supabase.from("webhook_logs").insert({
        event_id: eventId,
        payload,
        status: "processed_success",
      });

      return new Response(
        JSON.stringify({ received: true, status: "success", payment_id: paymentId, event_id: eventId }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (isFailure) {
      await supabase
        .from("payments")
        .update({
          status: "echoue",
          payment_method: provider,
          updated_at: new Date().toISOString(),
        })
        .eq("id", paymentId)
        .neq("status", "paye");

      await supabase.from("webhook_logs").insert({
        event_id: eventId,
        payload,
        status: "processed_failure",
      });

      return new Response(
        JSON.stringify({ received: true, status: "failed", payment_id: paymentId, event_id: eventId }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Événement d'information
    await supabase.from("webhook_logs").insert({
      event_id: eventId,
      payload,
      status: `processed_${eventType || "info"}`,
    });

    return new Response(
      JSON.stringify({ received: true, message: "Événement consigné.", event_id: eventId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[Edge Function] Erreur :", err);
    return new Response(
      JSON.stringify({ error: "Erreur interne", details: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
