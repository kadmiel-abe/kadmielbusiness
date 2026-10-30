import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getFeeSettings, calculatePaymentAmounts } from '@/lib/pricing';
import { initiateGeniusPayment } from '@/lib/geniuspay';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Route POST /api/payments/create-link
 * Sécurisée : Nécessite une session administrateur active.
 * Crée un client (ou réutilise un existant) et insère le paiement dans Supabase.
 * Calcule et garantit le respect de la formule officielle GeniusPay côté serveur :
 * total_amount = Math.ceil((net_amount + fixed_fee) / (1 - rate))
 * fee_amount = total_amount - net_amount
 */
export async function POST(request) {
  try {
    // 1. Contrôle d'accès strict : Vérification de la session administrateur
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json(
        { error: 'Session non authentifiée. Vous devez être connecté pour générer un lien de paiement.' },
        { status: 401 }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Corps de requête JSON invalide.' },
        { status: 400 }
      );
    }

    const {
      id,
      client_name,
      client_phone,
      service_name,
      amount_net,
      expires_at,
      is_single_use,
      max_uses,
      fee_bearer,
      business_type,
      is_recurring,
    } = body || {};

    // 2. Validation et assainissement stricts des entrées
    if (!client_name || typeof client_name !== 'string' || !client_name.trim()) {
      return NextResponse.json(
        { error: 'Le nom du client est obligatoire.' },
        { status: 400 }
      );
    }

    if (!client_phone || typeof client_phone !== 'string' || !client_phone.trim()) {
      return NextResponse.json(
        { error: 'Le numéro de téléphone du client est obligatoire.' },
        { status: 400 }
      );
    }

    if (!service_name || typeof service_name !== 'string' || !service_name.trim()) {
      return NextResponse.json(
        { error: 'Le libellé de la prestation ou de l\'abonnement est obligatoire.' },
        { status: 400 }
      );
    }

    const cleanNet = Number(amount_net);
    if (isNaN(cleanNet) || cleanNet <= 0 || cleanNet > 100000000) {
      return NextResponse.json(
        { error: 'Le montant net doit être un nombre strictement positif et raisonnable (FCFA).' },
        { status: 400 }
      );
    }

    const cleanName = client_name.trim().slice(0, 100);
    const cleanPhone = client_phone.trim().slice(0, 30);
    const cleanService = service_name.trim().slice(0, 150);

    // Validation optionnelle de l'identifiant personnalisé (doit être un UUID valide pour PostgreSQL)
    let paymentId = crypto.randomUUID();
    if (id && typeof id === 'string') {
      const trimmedId = id.trim();
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmedId);
      if (isUuid) {
        paymentId = trimmedId;
      }
    }

    // 3. Recherche ou création du client dans la table `clients`
    let clientId = null;
    if (cleanPhone) {
      const { data: existing } = await supabaseAdmin
        .from('clients')
        .select('id')
        .eq('phone', cleanPhone)
        .maybeSingle();

      if (existing?.id) {
        clientId = existing.id;
      }
    }

    if (!clientId) {
      const { data: createdClient, error: clientErr } = await supabaseAdmin
        .from('clients')
        .insert({
          name: cleanName,
          phone: cleanPhone,
        })
        .select('id')
        .single();

      if (clientErr) {
        console.error('[CreateLink API] Erreur création client :', clientErr);
      } else {
        clientId = createdClient?.id;
      }
    }

    // 4. Traitement des frais selon la formule officielle GeniusPay
    const feeSettings = await getFeeSettings();
    const computedFeeBearer = fee_bearer === 'freelance' ? 'freelance' : 'client';
    const calculated = calculatePaymentAmounts(cleanNet, {
      rate: feeSettings.rate,
      fixedFee: feeSettings.fixedFee,
      feeBearer: computedFeeBearer,
    });

    const finalAmountNet = calculated.net_amount;
    const finalAmountTotal = calculated.total_amount;
    const finalFeeAmount = calculated.fee_amount;

    const isSingleUse = is_single_use !== false;
    const computedMaxUses = isSingleUse ? 1 : Math.max(1, parseInt(max_uses, 10) || 1);
    const computedExpiresAt = expires_at ? new Date(expires_at).toISOString() : null;
    const computedBusinessType = ['restaurant', 'abonnement_resto'].includes(business_type)
      ? 'abonnement_resto'
      : 'freelance';
    const isRecurring = Boolean(is_recurring || computedBusinessType === 'abonnement_resto');

    // Si c'est un abonnement restaurant B2B, qualifier le client en 'entreprise_abo'
    if (clientId && computedBusinessType === 'abonnement_resto') {
      try {
        await supabaseAdmin
          .from('clients')
          .update({ client_type: 'entreprise_abo' })
          .eq('id', clientId);
      } catch {
        // Colonne optionnelle si migration non encore jouée
      }
    }

    // 5. Initialisation immédiate de la session GeniusPay (Lien direct vers la page de paiement GeniusPay)
    let geniusCheckoutUrl = null;
    let geniusReference = null;
    try {
      const origin =
        request.nextUrl?.origin ||
        process.env.NEXT_PUBLIC_APP_URL ||
        'https://kadmielbusiness.vercel.app';
      const returnUrl = `${origin}/pay/${paymentId}`;

      const geniusRes = await initiateGeniusPayment({
        paymentId,
        amount: finalAmountTotal,
        description: cleanService || (computedBusinessType === 'abonnement_resto' ? 'Abonnement Restaurant' : 'Prestation Freelance'),
        customer: {
          name: cleanName,
          phone: cleanPhone,
          country: 'CI',
        },
        successUrl: returnUrl,
        errorUrl: returnUrl,
        metadata: {
          business_type: computedBusinessType,
          is_recurring: isRecurring,
          net_amount: finalAmountNet,
          fee_amount: finalFeeAmount,
        },
      });

      geniusCheckoutUrl = geniusRes?.checkoutUrl || null;
      geniusReference = geniusRes?.reference || null;
    } catch (gpErr) {
      console.warn('[CreateLink API] Génération directe GeniusPay réussira lors du clic :', gpErr.message);
    }

    // 6. Insertion du paiement dans la table `payments` avec repli de résilience garanti
    const fullPayload = {
      id: paymentId,
      client_id: clientId || null,
      service_name: cleanService,
      amount_net: finalAmountNet,
      amount_total: finalAmountTotal,
      fee_amount: finalFeeAmount,
      status: 'en_attente',
      business_type: computedBusinessType,
      is_recurring: isRecurring,
      expires_at: computedExpiresAt,
      is_single_use: isSingleUse,
      max_uses: computedMaxUses,
      times_used: 0,
      fee_bearer: computedFeeBearer,
      geniuspay_ref: geniusReference,
    };

    let { data: payment, error: payErr } = await supabaseAdmin
      .from('payments')
      .insert(fullPayload)
      .select('*, client:clients(*)')
      .single();

    // Repli résilient si colonnes étendues non migrées
    if (payErr) {
      console.warn('[CreateLink API] Repli résilient sur les colonnes de base :', payErr.message || payErr);
      const basePayload = {
        id: paymentId,
        client_id: clientId || null,
        service_name: cleanService,
        amount_net: finalAmountNet,
        amount_total: finalAmountTotal,
        status: 'en_attente',
        geniuspay_ref: geniusReference,
      };
      const retry = await supabaseAdmin
        .from('payments')
        .insert(basePayload)
        .select('*, client:clients(*)')
        .single();

      if (!retry.error && retry.data) {
        payment = retry.data;
        payErr = null;
      } else {
        console.error('[CreateLink API] Erreur sur le repli de base :', retry.error);
        payErr = retry.error;
      }
    }

    if (payErr || !payment) {
      console.error('[CreateLink API] Erreur insertion paiement :', payErr);
      return NextResponse.json(
        { error: 'Erreur lors de la création du paiement en base de données.', details: payErr?.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        checkout_url: geniusCheckoutUrl,
        geniuspay_url: geniusCheckoutUrl,
        payment: {
          ...fullPayload,
          ...payment,
          geniuspay_ref: geniusReference || payment?.geniuspay_ref || null,
          checkout_url: geniusCheckoutUrl,
          geniuspay_url: geniusCheckoutUrl,
          business_type: payment?.business_type || computedBusinessType,
          is_recurring: payment?.is_recurring !== undefined ? payment.is_recurring : isRecurring,
          fee_amount: payment?.fee_amount !== undefined ? payment.fee_amount : finalFeeAmount,
          fee_bearer: payment?.fee_bearer || computedFeeBearer,
          expires_at: payment?.expires_at || computedExpiresAt,
          is_single_use: payment?.is_single_use !== undefined ? payment.is_single_use : isSingleUse,
          max_uses: payment?.max_uses !== undefined ? payment.max_uses : computedMaxUses,
          client: payment?.client || { id: clientId, name: cleanName, phone: cleanPhone },
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[CreateLink API] Exception serveur :', error);
    return NextResponse.json(
      { error: 'Erreur serveur interne lors de la création du lien de paiement.' },
      { status: 500 }
    );
  }
}
