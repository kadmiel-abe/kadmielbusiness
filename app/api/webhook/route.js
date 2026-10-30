import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendReceiptEmail } from '@/lib/receiptService';
import { verifyGeniusPaySignature, normalizeProvider } from '@/lib/geniuspay';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Route POST /api/webhook
 * Écoute les notifications serveur à serveur de GeniusPay :
 * 1. Vérifie la signature cryptographique HMAC-SHA256 (avec protection anti-rejeu).
 * 2. Garantit l'idempotence stricte via la table `webhook_logs`.
 * 3. Met à jour le statut du paiement en 'paye' et verrouille le lien à usage unique.
 * 4. Déclenche l'envoi automatique du reçu certifié par email.
 */
export async function POST(request) {
  try {
    const webhookSecret = process.env.GENIUSPAY_WEBHOOK_SECRET;

    // Récupération des en-têtes de signature et horodatage
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

    // 1. Vérification cryptographique de la signature HMAC-SHA256
    if (webhookSecret) {
      if (!signature) {
        console.warn('[Webhook] Signature absente alors que GENIUSPAY_WEBHOOK_SECRET est configuré.');
        return NextResponse.json(
          { error: 'Signature webhook requise non fournie.' },
          { status: 401 }
        );
      }

      const isValid = verifyGeniusPaySignature({
        rawBody,
        signature,
        secret: webhookSecret,
        timestamp,
      });

      if (!isValid) {
        console.warn('[Webhook] Signature HMAC-SHA256 invalide ou requête expirée.');
        return NextResponse.json(
          { error: 'Signature webhook invalide ou horodatage expiré.' },
          { status: 401 }
        );
      }
    } else {
      console.warn(
        '[Webhook] AVERTISSEMENT : GENIUSPAY_WEBHOOK_SECRET non configuré. Signature ignorée.'
      );
    }

    // 2. Parsing du corps JSON
    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Format JSON invalide.' }, { status: 400 });
    }

    console.info('[Webhook GeniusPay] Événement entrant :', JSON.stringify(payload, null, 2));

    // 3. Extraction de l'identifiant d'événement pour l'IDEMPOTENCE
    const eventId = String(
      payload.event_id ||
      payload.id ||
      payload.data?.id ||
      payload.reference ||
      payload.data?.reference ||
      crypto.createHash('sha256').update(rawBody).digest('hex')
    );

    // 4. Contrôle d'Idempotence via la table `webhook_logs`
    try {
      const { data: existingLog } = await supabaseAdmin
        .from('webhook_logs')
        .select('id, event_id, status')
        .eq('event_id', eventId)
        .maybeSingle();

      if (existingLog) {
        console.info(`[Webhook - Idempotence] Événement ${eventId} déjà traité précédemment.`);
        return NextResponse.json(
          {
            received: true,
            status: 'already_processed',
            event_id: eventId,
          },
          { status: 200 }
        );
      }
    } catch (checkErr) {
      console.warn('[Webhook] Table webhook_logs inaccessible ou non initialisée :', checkErr.message);
    }

    // 5. Extraction du paymentId et des informations de transaction
    const metadata = payload.data?.metadata || payload.metadata || {};
    const paymentId =
      metadata.payment_id ||
      metadata.paymentId ||
      payload.data?.payment_id ||
      payload.payment_id ||
      payload.paymentId ||
      payload.data?.id;

    const eventType = String(
      payload.event ||
      payload.type ||
      request.headers.get('x-webhook-event') ||
      payload.status ||
      payload.data?.status ||
      ''
    ).toLowerCase();

    const rawProvider =
      payload.data?.provider ||
      payload.provider ||
      payload.data?.payment_method ||
      payload.payment_method ||
      metadata.provider ||
      'geniuspay';

    const provider = normalizeProvider(rawProvider) || rawProvider;

    const transactionReference =
      payload.data?.reference ||
      payload.reference ||
      payload.data?.transaction_id ||
      payload.transaction_id ||
      null;

    if (!paymentId) {
      console.warn('[Webhook] Aucun payment_id exploitable trouvé.');
      // Enregistrement du log comme ignoré
      await logWebhookEvent(eventId, payload, 'ignored_missing_payment_id');
      return NextResponse.json(
        { received: true, status: 'ignored_missing_payment_id', event_id: eventId },
        { status: 200 }
      );
    }

    // 6. Qualification du résultat : Succès ou Échec
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

    // 7. Traitement en cas de succès
    if (isSuccess) {
      // Récupération de l'état actuel du paiement
      const { data: currentPayment, error: fetchErr } = await supabaseAdmin
        .from('payments')
        .select('*')
        .eq('id', paymentId)
        .single();

      if (fetchErr || !currentPayment) {
        console.error('[Webhook] Paiement introuvable en base :', fetchErr);
        await logWebhookEvent(eventId, payload, 'failed_payment_not_found');
        return NextResponse.json({ error: 'Paiement introuvable.' }, { status: 404 });
      }

      const isSingleUse = currentPayment.is_single_use !== false;
      const currentTimesUsed = Number(currentPayment.times_used) || 0;
      const maxUses = Number(currentPayment.max_uses) || 1;

      // Si le paiement est à usage unique et déjà payé, garantir l'idempotence
      if (isSingleUse && currentPayment.status === 'paye' && currentTimesUsed >= 1) {
        console.info(`[Webhook - Idempotence] Le paiement ${paymentId} est déjà finalisé.`);
        await logWebhookEvent(eventId, payload, 'already_paid');
        return NextResponse.json(
          { received: true, status: 'already_paid', event_id: eventId },
          { status: 200 }
        );
      }

      const newTimesUsed = currentTimesUsed + 1;
      const nowIso = new Date().toISOString();

      const baseUpdatePayload = {
        status: 'paye', // Verrouillage direct à l'état payé
        payment_method: provider,
        geniuspay_ref: transactionReference || currentPayment.geniuspay_ref || undefined,
        updated_at: nowIso,
      };

      // Mise à jour complète avec verrouillage (times_used et paid_at)
      let { data: updated, error: updateError } = await supabaseAdmin
        .from('payments')
        .update({
          ...baseUpdatePayload,
          times_used: newTimesUsed,
          paid_at: nowIso,
        })
        .eq('id', paymentId)
        .select()
        .single();

      // Repli si les colonnes étendues ne sont pas encore présentes dans Supabase
      if (updateError && updateError.message && (updateError.message.includes('column') || updateError.message.includes('schema cache'))) {
        console.warn('[Webhook] Repli sur colonnes de base :', updateError.message);
        const retry = await supabaseAdmin
          .from('payments')
          .update(baseUpdatePayload)
          .eq('id', paymentId)
          .select()
          .single();
        updated = retry.data;
        updateError = retry.error;
      }

      if (updateError || !updated) {
        console.error('[Webhook] Erreur mise à jour statut en base :', updateError);
        await logWebhookEvent(eventId, payload, 'error_db_update');
        return NextResponse.json(
          { error: 'Erreur lors de la mise à jour du statut.' },
          { status: 500 }
        );
      }

      // Envoi automatique du reçu certifié par email
      try {
        let clientEmail = updated?.receipt_email;
        if (!clientEmail && updated.client_id) {
          const { data: clientObj } = await supabaseAdmin
            .from('clients')
            .select('email')
            .eq('id', updated.client_id)
            .single();
          clientEmail = clientObj?.email;
        }

        if (clientEmail) {
          const host =
            request.headers.get('x-forwarded-host') ||
            request.headers.get('host') ||
            'kadmielbusiness.vercel.app';
          const proto = request.headers.get('x-forwarded-proto') || 'https';
          const baseUrl = `${proto}://${host}`;
          await sendReceiptEmail({ toEmail: clientEmail, payment: updated, baseUrl });
          console.info(`[Webhook] Reçu automatique transmis par email à ${clientEmail}`);
        }
      } catch (receiptErr) {
        console.warn('[Webhook] Envoi de reçu non bloquant :', receiptErr);
      }

      // Enregistrement dans webhook_logs pour idempotence future
      await logWebhookEvent(eventId, payload, 'processed_success');

      console.info(
        `[Webhook - Succès] Paiement ${paymentId} validé avec succès (${provider}). Lien verrouillé (usage ${newTimesUsed}/${maxUses}).`
      );

      return NextResponse.json(
        {
          received: true,
          status: 'success',
          payment_id: paymentId,
          event_id: eventId,
          times_used: newTimesUsed,
        },
        { status: 200 }
      );
    }

    // 8. Traitement en cas d'échec
    if (isFailure) {
      await supabaseAdmin
        .from('payments')
        .update({
          status: 'echoue',
          payment_method: provider,
          updated_at: new Date().toISOString(),
        })
        .eq('id', paymentId)
        .neq('status', 'paye'); // Ne jamais écraser un statut 'paye' existant

      await logWebhookEvent(eventId, payload, 'processed_failure');

      console.info(`[Webhook - Échec] Paiement ${paymentId} marqué échoué.`);
      return NextResponse.json(
        { received: true, status: 'failed', payment_id: paymentId, event_id: eventId },
        { status: 200 }
      );
    }

    // Événement non terminal (en attente, ping, etc.)
    await logWebhookEvent(eventId, payload, `processed_${eventType || 'info'}`);
    return NextResponse.json(
      { received: true, message: `Événement ${eventType} consigné.`, event_id: eventId },
      { status: 200 }
    );
  } catch (err) {
    console.error('[Webhook] Exception non gérée :', err);
    return NextResponse.json(
      { error: 'Erreur interne du serveur lors du traitement du webhook.' },
      { status: 500 }
    );
  }
}

/**
 * Insère l'événement dans la table `webhook_logs` pour garantir l'idempotence.
 */
async function logWebhookEvent(eventId, payload, status) {
  try {
    await supabaseAdmin.from('webhook_logs').insert({
      event_id: String(eventId),
      payload: payload,
      status: String(status),
    });
  } catch (e) {
    console.warn('[Webhook] Impossible d\'enregistrer dans webhook_logs :', e.message);
  }
}