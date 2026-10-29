import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GENIUSPAY_API_URL = process.env.GENIUSPAY_BASE_URL || 'https://geniuspay.ci/api/v1/merchant/payments';

/**
 * Route POST /api/create-payment
 * Initialise une session de paiement avec l'API GeniusPay et met à jour Supabase.
 */
export async function POST(request) {
  try {
    // 1. Vérification des clés d'API GeniusPay côté serveur
    const apiKey = process.env.GENIUSPAY_API_KEY;
    const apiSecret = process.env.GENIUSPAY_SECRET_KEY || process.env.GENIUSPAY_API_SECRET;

    if (!apiKey || !apiSecret) {
      console.error('[Create-Payment] Clés API GeniusPay (GENIUSPAY_API_KEY, GENIUSPAY_SECRET_KEY/GENIUSPAY_API_SECRET) manquantes.');
      return NextResponse.json(
        { error: 'Configuration serveur incomplète : clés GeniusPay manquantes.' },
        { status: 500 }
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

    const { paymentId } = body || {};

    if (!paymentId) {
      return NextResponse.json(
        { error: 'Le champ "paymentId" est requis.' },
        { status: 400 }
      );
    }

    // 3. Récupération des informations du paiement et du client depuis Supabase (table payments + clients)
    const { data: payment, error: dbError } = await supabaseAdmin
      .from('payments')
      .select('*, client:clients(*)')
      .eq('id', paymentId)
      .single();

    if (dbError || !payment) {
      console.error('[Create-Payment] Erreur lors de la récupération Supabase :', dbError);
      return NextResponse.json(
        {
          error: 'Paiement introuvable.',
          details: dbError?.message || null,
        },
        { status: dbError?.code === 'PGRST116' ? 404 : 500 }
      );
    }

    // Protection supplémentaire : si le paiement est déjà payé
    if (payment.status === 'paye') {
      return NextResponse.json(
        { error: 'Ce paiement a déjà été réglé avec succès.' },
        { status: 400 }
      );
    }

    // 4. Extraction souple et normalisation des informations client
    const client = payment.client || {};
    const customerName =
      client.name ||
      client.nom ||
      payment.customer_name ||
      payment.customer?.name ||
      payment.client_name ||
      payment.name ||
      'Client';

    const customerPhone =
      client.phone ||
      client.telephone ||
      payment.customer_phone ||
      payment.customer?.phone ||
      payment.client_phone ||
      payment.phone ||
      '';

    // 5. Construction du payload conforme aux exigences GeniusPay
    const geniusPayPayload = {
      amount: payment.amount_total,
      description: payment.service_name || 'Paiement de service',
      customer: {
        name: customerName,
        phone: customerPhone,
      },
      metadata: {
        payment_id: paymentId,
      },
    };

    // 6. Appel POST à l'API GeniusPay
    const geniusPayResponse = await fetch(GENIUSPAY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-API-Key': apiKey,
        'X-API-Secret': apiSecret,
      },
      body: JSON.stringify(geniusPayPayload),
    });

    const geniusPayData = await geniusPayResponse.json().catch(() => null);

    if (!geniusPayResponse.ok || !geniusPayData) {
      console.error('[Create-Payment] Erreur de réponse GeniusPay :', {
        status: geniusPayResponse.status,
        response: geniusPayData,
      });
      return NextResponse.json(
        {
          error: "Échec de l'initialisation du paiement chez GeniusPay.",
          details: geniusPayData?.message || geniusPayData?.error || 'Erreur passerelle',
        },
        { status: 502 }
      );
    }

    // Extraction de la référence et de l'URL checkout (compatible format direct ou encapsulé dans data)
    const reference = geniusPayData.reference || geniusPayData.data?.reference;
    const checkoutUrl =
      geniusPayData.checkout_url ||
      geniusPayData.data?.checkout_url ||
      geniusPayData.payment_url ||
      geniusPayData.data?.payment_url;

    if (!checkoutUrl) {
      console.error('[Create-Payment] checkout_url absente de la réponse GeniusPay :', geniusPayData);
      return NextResponse.json(
        { error: "L'URL de paiement checkout_url n'a pas été fournie par la passerelle." },
        { status: 502 }
      );
    }

    // 7. Mise à jour du champ geniuspay_ref dans Supabase
    if (reference) {
      const { error: updateError } = await supabaseAdmin
        .from('payments')
        .update({
          geniuspay_ref: reference,
          updated_at: new Date().toISOString(),
        })
        .eq('id', paymentId);

      if (updateError) {
        console.error('[Create-Payment] Avertissement: Échec mise à jour geniuspay_ref dans Supabase :', updateError);
        // Ne bloque pas la redirection de l'utilisateur si la référence n'a pu être sauvegardée
      }
    }

    // 8. Retour de l'URL checkout_url au frontend
    return NextResponse.json(
      {
        checkout_url: checkoutUrl,
        reference: reference || null,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Create-Payment] Exception non gérée :', error);
    return NextResponse.json(
      { error: 'Erreur serveur interne lors de la création du paiement.' },
      { status: 500 }
    );
  }
}
