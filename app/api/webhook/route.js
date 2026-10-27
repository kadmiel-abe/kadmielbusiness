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
 * Écoute et traite les événements webhook GeniusPay en garantissant l'idempotence.
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

      const TOLERANCE_WINDOW_SECONDS = 300; // 5 minutes de marge
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

    // 3. Récupération du raw body sous forme de chaîne de caractères (obligatoire pour HMAC)
    const rawBody = await request.text();

    if (!rawBody) {
      return NextResponse.json(
        { error: 'Corps de requête vide.' },
        { status: 400 }
      );
    }

    // 4. Validation de la signature HMAC-SHA256
    const isSignatureValid = verifyGeniusPaySignature(rawBody, signature, webhookSecret, timestamp);

    if (!isSignatureValid) {
      console.warn('[Webhook] Tentative non autorisée : Signature invalide.');
      return NextResponse.json(
        { error: 'Signature webhook invalide.' },
        { status: 401 }
      );
    }

    // 5. Désérialisation sécurisée du payload JSON
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

    // Détermination de l'événement (priorité au header, fallback sur le corps)
    const eventType = webhookEventHeader || payload.event || payload.type;

    // 6. Traitement spécifique de l'événement 'payment.success'
    if (eventType === 'payment.success') {
      const metadata = payload.data?.metadata || payload.metadata || {};
      const paymentId = metadata.payment_id || metadata.paymentId;
      const provider =
        payload.data?.provider ||
        payload.provider ||
        payload.data?.payment_method ||
        payload.payment_method ||
        'geniuspay';

      if (!paymentId) {
        console.warn('[Webhook] Aucun payment_id trouvé dans les métadonnées :', payload);
        return NextResponse.json(
          { error: 'payment_id introuvable dans metadata.' },
          { status: 400 }
        );
      }

      // 7. Idempotence : Mise à jour dans Supabase UNIQUEMENT si statut === 'en_attente'
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
        console.error('[Webhook] Erreur lors de la mise à jour Supabase :', updateError);
        return NextResponse.json(
          { error: 'Erreur lors de la mise à jour en base de données.' },
          { status: 500 }
        );
      }

      // Si aucune ligne n'a été modifiée, la transaction a déjà été traitée ou n'était pas 'en_attente'
      if (!updatedRows || updatedRows.length === 0) {
        console.info(
          `[Webhook - Idempotence] Le paiement ${paymentId} a déjà été validé ou n'est plus en attente. Aucun changement effectué.`
        );
        return NextResponse.json(
          {
            received: true,
            status: 'already_processed',
            message: 'Paiement déjà traité (Idempotence respectée).',
          },
          { status: 200 }
        );
      }

      console.info(`[Webhook - Succès] Paiement ${paymentId} validé avec provider : ${provider}`);
      return NextResponse.json(
        {
          received: true,
          status: 'success',
          payment_id: paymentId,
          provider: provider,
        },
        { status: 200 }
      );
    }

    // Gestion des autres événements : acquittement 200 pour éviter les relances
    console.info(`[Webhook] Événement ${eventType} ignoré mais acquitté.`);
    return NextResponse.json(
      {
        received: true,
        message: `Événement ${eventType} non traité mais bien reçu.`,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Webhook] Exception serveur inattendue :', error);
    return NextResponse.json(
      { error: 'Erreur interne lors du traitement du webhook.' },
      { status: 500 }
    );
  }
}
