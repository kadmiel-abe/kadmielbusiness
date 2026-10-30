import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Valide la signature cryptographique HMAC-SHA256 envoyée par GeniusPay.
 * Teste la signature directe et la variante horodatée.
 */
function verifyGeniusPaySignature(rawBody, signature, secret, timestamp) {
  if (!signature || !secret || !rawBody) {
    return false;
  }

  try {
    const cleanSignature = signature.trim().toLowerCase();

    // 1. Calcul HMAC standard sur le corps brut
    const hmacStandard = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex')
      .toLowerCase();

    const signatureBuffer = Buffer.from(cleanSignature, 'utf8');
    const hmacBuffer = Buffer.from(hmacStandard, 'utf8');

    if (
      signatureBuffer.length === hmacBuffer.length &&
      crypto.timingSafeEqual(signatureBuffer, hmacBuffer)
    ) {
      return true;
    }

    // 2. Variante intégrant le timestamp si fourni
    if (timestamp) {
      const hmacWithTimestamp = crypto
        .createHmac('sha256', secret)
        .update(`${timestamp}.${rawBody}`)
        .digest('hex')
        .toLowerCase();

      const hmacTimeBuffer = Buffer.from(hmacWithTimestamp, 'utf8');
      if (
        signatureBuffer.length === hmacTimeBuffer.length &&
        crypto.timingSafeEqual(signatureBuffer, hmacTimeBuffer)
      ) {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error('[Webhook GeniusPay] Erreur vérification HMAC :', error);
    return false;
  }
}

/**
 * Route POST /api/webhook
 * Écoute, valide et synchronise les statuts des paiements GeniusPay
 * avec vérification de signature et respect strict de l'idempotence.
 */
export async function POST(request) {
  try {
    const webhookSecret = process.env.GENIUSPAY_WEBHOOK_SECRET;

    // Récupération des en-têtes possibles
    const signature =
      request.headers.get('x-webhook-signature') ||
      request.headers.get('x-geniuspay-signature') ||
      request.headers.get('x-signature');

    const timestamp =
      request.headers.get('x-webhook-timestamp') ||
      request.headers.get('x-timestamp');

    const rawBody = await request.text();

    if (!rawBody) {
      return NextResponse.json({ error: 'Corps de requête vide.' }, { status: 400 });
    }

    // 1. Vérification de la signature si le secret est configuré
    if (webhookSecret) {
      if (!signature) {
        console.warn('[Webhook] Signature absente alors que GENIUSPAY_WEBHOOK_SECRET est défini.');
        return NextResponse.json(
          { error: 'Signature requise non fournie.' },
          { status: 401 }
        );
      }

      // Protection Replay Attack (5 minutes = 300 secondes) selon la doc officielle
      if (timestamp) {
        const now = Math.floor(Date.now() / 1000);
        const parsedTimestamp = parseInt(timestamp, 10);
        const eventTime = parsedTimestamp > 1e11 ? Math.floor(parsedTimestamp / 1000) : parsedTimestamp;
        if (!isNaN(eventTime) && Math.abs(now - eventTime) > 300) {
          console.warn('[Webhook] Timestamp trop ancien :', { now, eventTime });
          return NextResponse.json(
            { error: 'Horodatage invalide ou requête expirée.' },
            { status: 400 }
          );
        }
      }

      const isValid = verifyGeniusPaySignature(rawBody, signature, webhookSecret, timestamp);
      if (!isValid) {
        console.warn('[Webhook] Signature HMAC invalide.');
        return NextResponse.json(
          { error: 'Signature webhook non valide.' },
          { status: 401 }
        );
      }
    } else {
      console.warn(
        '[Webhook] AVERTISSEMENT : GENIUSPAY_WEBHOOK_SECRET non configuré. Validation de signature ignorée.'
      );
    }

    // 2. Analyse du corps JSON
    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Format JSON invalide.' }, { status: 400 });
    }

    console.info('[Webhook GeniusPay] Événement reçu :', JSON.stringify(payload, null, 2));

    // 3. Extraction flexible du payment_id
    const metadata = payload.data?.metadata || payload.metadata || {};
    const paymentId =
      metadata.payment_id ||
      metadata.paymentId ||
      payload.data?.payment_id ||
      payload.payment_id ||
      payload.paymentId ||
      payload.data?.id;

    // Type d'événement ou statut renvoyé
    const eventType = (
      payload.event ||
      payload.type ||
      request.headers.get('x-webhook-event') ||
      payload.status ||
      payload.data?.status ||
      ''
    ).toLowerCase();

    // Mode ou moyen de paiement (Wave, Orange, MTN, Moov...)
    const provider =
      payload.data?.provider ||
      payload.provider ||
      payload.data?.payment_method ||
      payload.payment_method ||
      'geniuspay';

    const transactionReference =
      payload.data?.reference ||
      payload.reference ||
      payload.data?.transaction_id ||
      payload.transaction_id ||
      null;

    if (!paymentId) {
      console.warn('[Webhook] Aucun payment_id exploitable dans le payload :', payload);
      // Acquitter pour éviter que la passerelle ne réessaie indéfiniment
      return NextResponse.json(
        { received: true, status: 'ignored_missing_payment_id' },
        { status: 200 }
      );
    }

    // 4. Détermination du statut cible
    const isSuccess =
      eventType === 'payment.success' ||
      eventType === 'success' ||
      eventType === 'paid' ||
      eventType === 'paye';

    const isFailure =
      eventType === 'payment.failed' ||
      eventType === 'payment.cancelled' ||
      eventType === 'failed' ||
      eventType === 'echoue' ||
      eventType === 'cancelled' ||
      eventType === 'annule';

    // 5. Application idempotente dans Supabase
    if (isSuccess) {
      // 1. Récupération des données actuelles du paiement
      const { data: currentPayment, error: fetchErr } = await supabaseAdmin
        .from('payments')
        .select('id, status, is_single_use, max_uses, times_used')
        .eq('id', paymentId)
        .single();

      if (fetchErr || !currentPayment) {
        console.error('[Webhook] Paiement introuvable pour validation :', fetchErr);
        return NextResponse.json({ error: 'Paiement introuvable.' }, { status: 404 });
      }

      const isSingleUse = currentPayment.is_single_use !== false;
      const currentTimesUsed = Number(currentPayment.times_used) || 0;
      const maxUses = Number(currentPayment.max_uses) || 1;

      // Protection d'idempotence si le paiement est à usage unique et déjà payé
      if (isSingleUse && currentPayment.status === 'paye' && currentTimesUsed >= 1) {
        console.info(`[Webhook - Idempotence] Le paiement ${paymentId} est déjà réglé.`);
        return NextResponse.json(
          { received: true, status: 'already_paid' },
          { status: 200 }
        );
      }

      const newTimesUsed = currentTimesUsed + 1;
      const shouldClose = isSingleUse || newTimesUsed >= maxUses;

      const { data: updated, error: updateError } = await supabaseAdmin
        .from('payments')
        .update({
          status: shouldClose ? 'paye' : currentPayment.status,
          times_used: newTimesUsed,
          payment_method: provider,
          geniuspay_ref: transactionReference || undefined,
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', paymentId)
        .select()
        .single();

      if (updateError) {
        console.error('[Webhook] Erreur mise à jour paiement payé :', updateError);
        return NextResponse.json(
          { error: 'Erreur mise à jour base de données.' },
          { status: 500 }
        );
      }

      console.info(`[Webhook - Succès] Paiement ${paymentId} validé avec succès (${provider}). Utilisations: ${newTimesUsed}/${maxUses}.`);
      return NextResponse.json(
        { received: true, status: 'success', payment_id: paymentId, times_used: newTimesUsed },
        { status: 200 }
      );
    }

    if (isFailure) {
      // Passe en 'echoue' uniquement s'il n'a pas été marqué payé auparavant
      const { error: updateError } = await supabaseAdmin
        .from('payments')
        .update({
          status: 'echoue',
          payment_method: provider,
          updated_at: new Date().toISOString(),
        })
        .eq('id', paymentId)
        .neq('status', 'paye');

      if (updateError) {
        console.error('[Webhook] Erreur marquage échec :', updateError);
        return NextResponse.json(
          { error: 'Erreur mise à jour base de données.' },
          { status: 500 }
        );
      }

      console.info(`[Webhook - Échec] Paiement ${paymentId} marqué comme échoué.`);
      return NextResponse.json(
        { received: true, status: 'failed', payment_id: paymentId },
        { status: 200 }
      );
    }

    // Événement non bloquant ou informatif
    console.info(`[Webhook] Événement '${eventType}' acquitté.`);
    return NextResponse.json(
      { received: true, message: `Événement ${eventType} acquitté.` },
      { status: 200 }
    );
  } catch (err) {
    console.error('[Webhook] Exception serveur inattendue :', err);
    return NextResponse.json(
      { error: 'Erreur interne du serveur lors du traitement du webhook.' },
      { status: 500 }
    );
  }
}