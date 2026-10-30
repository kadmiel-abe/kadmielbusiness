import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { initiateGeniusPayment, normalizeProvider } from '@/lib/geniuspay';
import { getClientIp, checkRateLimit } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Route POST /api/create-payment
 * Initialise une session de paiement sécurisée auprès de l'API GeniusPay
 * pour Wave, Orange Money, MTN MoMo ou Moov Money.
 *
 * Sécurisé : Limitation de débit (Rate Limiting) et validation stricte des paramètres.
 */
export async function POST(request) {
  try {
    // 1. Protection Anti-Abus & Déni de Service (Rate Limiting)
    const clientIp = getClientIp(request);
    const rateCheck = checkRateLimit({
      key: `create-payment:${clientIp}`,
      limit: 15,
      windowMs: 5 * 60 * 1000,
    });

    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Trop de requêtes d\'initialisation. Veuillez patienter un moment.' },
        { status: 429 }
      );
    }

    // 2. Extraction et validation du corps de requête
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

    if (!paymentId || typeof paymentId !== 'string') {
      return NextResponse.json(
        { error: 'Le champ "paymentId" est requis.' },
        { status: 400 }
      );
    }

    const cleanPaymentId = paymentId.trim();
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(cleanPaymentId)) {
      return NextResponse.json(
        { error: 'Format d\'identifiant de paiement invalide.' },
        { status: 400 }
      );
    }

    // 3. Récupération des informations du paiement et du client dans Supabase (par id ou token)
    let { data: payment, error: dbError } = await supabaseAdmin
      .from('payments')
      .select('*, client:clients(*)')
      .eq('id', cleanPaymentId)
      .maybeSingle();

    if (!payment) {
      try {
        const tokenRes = await supabaseAdmin
          .from('payments')
          .select('*, client:clients(*)')
          .eq('token', cleanPaymentId)
          .maybeSingle();
        if (tokenRes.data) {
          payment = tokenRes.data;
          dbError = null;
        }
      } catch {
        // Ignorer si pas de colonne token
      }
    }

    if (dbError || !payment) {
      console.error('[Create-Payment] Paiement introuvable dans Supabase :', dbError);
      return NextResponse.json(
        {
          error: 'Paiement introuvable.',
          details: dbError?.message || null,
        },
        { status: 404 }
      );
    }

    // 4. Vérification de l'expiration du lien
    const now = new Date();
    if (payment.expires_at && now > new Date(payment.expires_at)) {
      supabaseAdmin
        .from('payments')
        .update({ status: 'expire', updated_at: now.toISOString() })
        .eq('id', payment.id)
        .catch(() => {});

      return NextResponse.json(
        { error: 'Ce lien de paiement a expiré.' },
        { status: 410 }
      );
    }

    // 5. Vérification de l'usage unique (verrouillage) ou dépassement du quota
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

    // 6. Normalisation des informations client
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

    const returnUrl = `${origin}/pay/${payment.id}`;
    const selectedProvider = normalizeProvider(provider);

    const isRestoAbo = Boolean(
      payment.business_type === 'restaurant' ||
      payment.business_type === 'abonnement_resto' ||
      payment.is_recurring ||
      (payment.service_name && (
        payment.service_name.toLowerCase().includes('resto') ||
        payment.service_name.toLowerCase().includes('restaurant') ||
        payment.service_name.toLowerCase().includes('abonnement')
      ))
    );
    const effectiveBusinessType = payment.business_type || (isRestoAbo ? 'abonnement_resto' : 'freelance');

    // 7. Appel du module GeniusPay backend (Redirection identique pour Freelance & Abonnement Restaurant)
    const geniusResult = await initiateGeniusPayment({
      paymentId: payment.id,
      amount: payment.amount_total,
      description: payment.service_name || (effectiveBusinessType === 'abonnement_resto' ? 'Abonnement Restaurant' : 'Paiement prestation'),
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
        business_type: effectiveBusinessType,
        is_recurring: isRestoAbo,
        net_amount: payment.amount_net,
        fee_amount: (payment.amount_total || 0) - (payment.amount_net || 0),
      },
    });

    // 8. Enregistrement de la référence GeniusPay et du moyen de paiement dans Supabase
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
      .eq('id', payment.id);

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
