import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Valide la signature cryptographique HMAC-SHA256 envoyée par GeniusPay.
 * Utilise crypto.timingSafeEqual pour prévenir les attaques temporelles (timing attacks).
 */
function verifyGeniusPaySignature(rawBody, signature, secret, timestamp) {
  if (!signature || !secret || !rawBody) {
    return false;
  }

  try {
    // 1. Calcul du HMAC standard sur le corps brut
    const hmacStandard = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    const signatureBuffer = Buffer.from(signature.toLowerCase(), 'utf8');
    const hmacStandardBuffer = Buffer.from(hmacStandard.toLowerCase(), 'utf8');

    if (
      signatureBuffer.length === hmacStandardBuffer.length &&
      crypto.timingSafeEqual(signatureBuffer, hmacStandardBuffer)
    ) {
      return true;
    }

    // 2. Variante de vérification intégrant le timestamp si spécifié par le webhook
    if (timestamp) {
      const hmacWithTimestamp = crypto
        .createHmac('sha256', secret)
        .update(`${timestamp}.${rawBody}`)
        .digest('hex');

      const hmacWithTimestampBuffer = Buffer.from(hmacWithTimestamp.toLowerCase(), 'utf8');

      if (
        signatureBuffer.length === hmacWithTimestampBuffer.length &&
        crypto.timingSafeEqual(signatureBuffer, hmacWithTimestampBuffer)
      ) {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error('[Webhook] Erreur durant la vérification HMAC :', error);
    return false;
  }
}

/**
 * Route POST /api/webhook
 * Écoute et traite tous les événements du cycle de vie des paiements GeniusPay
 * avec validation cryptographique HMAC-SHA256 et idempotence stricte.
 */
export async function POST(request) {
  try {
    const webhookSecret = process.env.GENIUSPAY_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error('[Webhook] Variable d’environnement GENIUSPAY_WEBHOOK_SECRET non configurée.');
      return NextResponse.json(
        { error: 'Configuration serveur incomplète.' },
        { status: 500 }
      );
    }

    // 1. Récupération des en-têtes obligatoires
    const signature = request.headers.get('x-webhook-signature');
    const timestamp = request.headers.get('x-webhook-timestamp');
    const webhookEventHeader = request.headers.get('x-webhook-event');

    if (!signature) {
      console.warn('[Webhook] Header x-webhook-signature manquant.');
      return NextResponse.json(
        { error: 'En-tête de signature x-webhook-signature manquant.' },
        { status: 401 }
      );
    }

    // 2. Protection contre les attaques par rejeu (Replay Attacks) via timestamp
    if (timestamp) {
      const nowInSeconds = Math.floor(Date.now() / 1000);
      const parsedTimestamp = parseInt(timestamp, 10);
      // Supporte les timestamps en secondes ou millisecondes
      const eventTimeInSeconds = parsedTimestamp > 1e11 ? Math.floor(parsedTimestamp / 1000) : parsedTimestamp;

      const TOLERANCE_WINDOW_SECONDS = 300; // 5 minutes de tolérance
      if (isNaN(eventTimeInSeconds) || Math.abs(nowInSeconds - eventTimeInSeconds) > TOLERANCE_WINDOW_SECONDS) {
        console.warn('[Webhook] Horodatage en dehors de la fenêtre de tolérance :', {
          now: nowInSeconds,
          timestamp: eventTimeInSeconds,
        });
        return NextResponse.json(
          { error: 'Horodatage invalide ou requête expirée.' },
          { status: 400 }
        );
      }
    }

    // 3. Récupération du raw body (requis pour la validation HMAC)
    const rawBody = await request.text();

    if (!rawBody) {
      return NextResponse.json(
        { error: 'Corps de requête vide.' },
        { status: 400 }
      );
    }

    // 4. Validation cryptographique de la signature HMAC-SHA256
    const isSignatureValid = verifyGeniusPaySignature(rawBody, signature, webhookSecret, timestamp);

    if (!isSignatureValid) {
      console.warn('[Webhook] Tentative non autorisée : Signature invalide.');
      return NextResponse.json(
        { error: 'Signature webhook invalide.' },
        { status: 401 }
      );
    }

    // 5. Désérialisation du payload JSON
    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      console.error('[Webhook] Échec du parsing JSON du raw body.');
      return NextResponse.json(
        { error: 'Corps de requête JSON malformé.' },
        { status: 400 }
      );
    }

    // 6. Extraction du type d'événement
    const rawEventType = webhookEventHeader || payload.event || payload.type || '';
    const eventType = rawEventType.toLowerCase().trim();

    // 7. Extraction des métadonnées du paiement
    const metadata = payload.data?.metadata || payload.metadata || {};
    const paymentId =
      metadata.payment_id ||
      metadata.paymentId ||
      payload.data?.payment_id ||
      payload.payment_id ||
      payload.data?.id;

    const provider =
      payload.data?.provider ||
      payload.provider ||
      payload.data?.payment_method ||
      payload.payment_method ||
      'geniuspay';

    if (!paymentId) {
      console.warn('[Webhook] Aucun payment_id trouvé dans le payload :', payload);
      // Retourne 200 car la signature est valide, pour acquitter le webhook
      return NextResponse.json(
        {
          received: true,
          status: 'ignored_missing_payment_id',
          message: 'Aucun payment_id exploitable dans les métadonnées.',
        },
        { status: 200 }
      );
    }

    // 8. Gestion selon les différents types d'événements
    switch (eventType) {
      // ─────────────────────────────────────────────────────────────
      // A. PAIEMENT RÉUSSI : payment.success
      // ─────────────────────────────────────────────────────────────
      case 'payment.success': {
        // Idempotence stricte : mise à jour UNIQUEMENT si le statut actuel est 'en_attente'
        const { data: updatedRows, error: updateError } = await supabaseAdmin
          .from('payments')
          .update({
            status: 'paye',
            payment_method: provider,
            updated_at: new Date().toISOString(),
          })
          .eq('id', paymentId)
          .eq('status', 'en_attente')
          .select();

        if (updateError) {
          console.error('[Webhook] Erreur mise à jour Supabase (payment.success) :', updateError);
          return NextResponse.json(
            { error: 'Erreur lors de la mise à jour en base de données.' },
            { status: 500 }
          );
        }

        // Si aucune ligne modifiée : le paiement a déjà été validé ou n'était pas 'en_attente'
        if (!updatedRows || updatedRows.length === 0) {
          console.info(
            `[Webhook - Idempotence] Le paiement ${paymentId} a déjà été validé ou n'est plus en attente.`
          );
          return NextResponse.json(
            {
              received: true,
              status: 'already_processed',
              message: 'Paiement déjà validé ou non éligible (Idempotence respectée).',
            },
            { status: 200 }
          );
        }

        console.info(`[Webhook - Succès] Paiement ${paymentId} validé avec méthode : ${provider}`);
        return NextResponse.json(
          {
            received: true,
            status: 'success',
            payment_id: paymentId,
            payment_method: provider,
          },
          { status: 200 }
        );
      }

      // ─────────────────────────────────────────────────────────────
      // B. PAIEMENT ÉCHOUÉ OU ANNULÉ : payment.failed / payment.cancelled
      // ─────────────────────────────────────────────────────────────
      case 'payment.failed':
      case 'payment.cancelled': {
        // Idempotence : mise à jour vers 'echoue' UNIQUEMENT si le statut n'est pas déjà 'paye'
        const { data: updatedRows, error: updateError } = await supabaseAdmin
          .from('payments')
          .update({
            status: 'echoue',
            payment_method: provider,
            updated_at: new Date().toISOString(),
          })
          .eq('id', paymentId)
          .neq('status', 'paye')
          .select();

        if (updateError) {
          console.error(`[Webhook] Erreur mise à jour Supabase (${eventType}) :`, updateError);
          return NextResponse.json(
            { error: 'Erreur lors de la mise à jour en base de données.' },
            { status: 500 }
          );
        }

        if (!updatedRows || updatedRows.length === 0) {
          console.info(
            `[Webhook - Idempotence] Ignoré (${eventType}) : Le paiement ${paymentId} est déjà marqué comme payé.`
          );
          return NextResponse.json(
            {
              received: true,
              status: 'ignored_already_paid',
              message: 'Le paiement est déjà réglé, échec ou annulation ultérieure ignorée.',
            },
            { status: 200 }
          );
        }

        console.info(`[Webhook - Échec] Paiement ${paymentId} marqué comme échoué (${eventType}).`);
        return NextResponse.json(
          {
            received: true,
            status: 'failed',
            payment_id: paymentId,
            event: eventType,
          },
          { status: 200 }
        );
      }

      // ─────────────────────────────────────────────────────────────
      // C. PAIEMENT EXPIRÉ : payment.expired
      // ─────────────────────────────────────────────────────────────
      case 'payment.expired': {
        // Idempotence : mise à jour vers 'expire' UNIQUEMENT si le statut n'est pas déjà 'paye'
        const { data: updatedRows, error: updateError } = await supabaseAdmin
          .from('payments')
          .update({
            status: 'expire',
            updated_at: new Date().toISOString(),
          })
          .eq('id', paymentId)
          .neq('status', 'paye')
          .select();

        if (updateError) {
          console.error('[Webhook] Erreur mise à jour Supabase (payment.expired) :', updateError);
          return NextResponse.json(
            { error: 'Erreur lors de la mise à jour en base de données.' },
            { status: 500 }
          );
        }

        if (!updatedRows || updatedRows.length === 0) {
          console.info(
            `[Webhook - Idempotence] Ignoré (payment.expired) : Le paiement ${paymentId} est déjà payé.`
          );
          return NextResponse.json(
            {
              received: true,
              status: 'ignored_already_paid',
              message: 'Le paiement est déjà validé, expiration ignorée.',
            },
            { status: 200 }
          );
        }

        console.info(`[Webhook - Expiré] Session de paiement ${paymentId} marquée comme expirée.`);
        return NextResponse.json(
          {
            received: true,
            status: 'expired',
            payment_id: paymentId,
          },
          { status: 200 }
        );
      }

      // ─────────────────────────────────────────────────────────────
      // D. AUTRES ÉVÉNEMENTS : Acquittement HTTP 200
      // ─────────────────────────────────────────────────────────────
      default: {
        console.info(`[Webhook] Événement '${eventType}' non traité spécifiquement mais acquitté.`);
        return NextResponse.json(
          {
            received: true,
            message: `Événement '${eventType}' non traité mais bien reçu.`,
          },
          { status: 200 }
        );
      }
    }
  } catch (error) {
    console.error('[Webhook] Exception serveur inattendue :', error);
    return NextResponse.json(
      { error: 'Erreur interne lors du traitement du webhook.' },
      { status: 500 }
    );
  }
}
