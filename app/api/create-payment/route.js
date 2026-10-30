import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { initiateGeniusPayment, normalizeProvider } from '@/lib/geniuspay';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Route POST /api/create-payment
 * Initialise une session de paiement sécurisée auprès de l'API GeniusPay
 * pour Wave, Orange Money, MTN MoMo ou Moov Money.
 *
 * Paramètres attendus dans le body JSON :
 * - paymentId (requis) : ID du paiement dans Supabase
 * - provider (optionnel) : 'wave' | 'orange' | 'mtn' | 'moov'
 */
export async function POST(request) {
  try {
    // 1. Extraction et validation du corps de requête
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Format JSON invalide dans le corps de la requête.' },
        { status: 400 }
      );
    }

    const { paymentId, provider } = body || {};

    if (!paymentId) {
      return NextResponse.json(
        { error: 'Le champ "paymentId" est requis.' },
        { status: 400 }
      );
    }

    // 2. Récupération des informations du paiement et du client dans Supabase
    const { data: payment, error: dbError } = await supabaseAdmin
      .from('payments')
      .select('*, client:clients(*)')
      .eq('id', paymentId)
      .single();

    if (dbError || !payment) {
      console.error('[Create-Payment] Paiement introuvable dans Supabase :', dbError);
      return NextResponse.json(
        {
          error: 'Paiement introuvable.',
          details: dbError?.message || null,
        },
        { status: dbError?.code === 'PGRST116' ? 404 : 500 }
      );
    }

    // 3. Vérification de l'expiration du lien
    const now = new Date();
    if (payment.expires_at && now > new Date(payment.expires_at)) {
      supabaseAdmin
        .from('payments')
        .update({ status: 'expire', updated_at: now.toISOString() })
        .eq('id', paymentId)
        .catch(() => {});

      return NextResponse.json(
        { error: 'Ce lien de paiement a expiré.' },
        { status: 410 }
      );
    }

    // 4. Vérification de l'usage unique (verrouillage) ou dépassement du quota
    const isSingleUse = payment.is_single_use !== false;
    const maxUses = Number(payment.max_uses) || 1;
    const timesUsed = Number(payment.times_used) || 0;

    if (isSingleUse && (payment.status === 'paye' || timesUsed >= 1)) {
      return NextResponse.json(
        { error: 'Ce lien de paiement a déjà été réglé et ne peut plus être réutilisé.' },
        { status: 400 }
      );
    }

    if (!isSingleUse && timesUsed >= maxUses) {
      return NextResponse.json(
        { error: `Ce lien a atteint son quota d'utilisations autorisées (${timesUsed}/${maxUses}).` },
        { status: 400 }
      );
    }

    // 5. Normalisation des informations client
    const client = payment.client || {};
    const customerName =
      client.name ||
      client.nom ||
      payment.customer_name ||
      payment.client_name ||
      payment.name ||
      'Client';

    const customerPhone =
      client.phone ||
      client.telephone ||
      payment.customer_phone ||
      payment.client_phone ||
      payment.phone ||
      '';

    const customerEmail = client.email || payment.receipt_email || undefined;

    // Déterminer l'URL de base pour la redirection
    const origin =
      request.nextUrl?.origin ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'https://kadmielbusiness.vercel.app';

    const returnUrl = `${origin}/pay/${paymentId}`;
    const selectedProvider = normalizeProvider(provider);

    // 6. Appel du module GeniusPay backend
    const geniusResult = await initiateGeniusPayment({
      paymentId,
      amount: payment.amount_total,
      description: payment.service_name || 'Paiement prestation',
      customer: {
        name: customerName,
        phone: customerPhone,
        email: customerEmail,
        country: 'CI',
      },
      provider: selectedProvider,
      successUrl: returnUrl,
      errorUrl: returnUrl,
      metadata: {
        business_type: payment.business_type || 'freelance',
        net_amount: payment.amount_net,
        fee_amount: (payment.amount_total || 0) - (payment.amount_net || 0),
      },
    });

    // 7. Enregistrement de la référence GeniusPay et du moyen de paiement dans Supabase
    const updatePayload = {
      updated_at: new Date().toISOString(),
    };
    if (geniusResult.reference) {
      updatePayload.geniuspay_ref = geniusResult.reference;
    }
    if (selectedProvider) {
      updatePayload.payment_method = selectedProvider;
    }

    const { error: updateErr } = await supabaseAdmin
      .from('payments')
      .update(updatePayload)
      .eq('id', paymentId);

    if (updateErr) {
      console.warn('[Create-Payment] Sauvegarde de la référence non bloquante :', updateErr);
    }

    return NextResponse.json(
      {
        checkout_url: geniusResult.checkoutUrl,
        reference: geniusResult.reference,
        provider: selectedProvider,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Create-Payment] Erreur :', error);
    return NextResponse.json(
      {
        error: 'Échec de l\'initialisation du paiement.',
        details: error?.message || 'Erreur interne du serveur.',
      },
      { status: 500 }
    );
  }
}
