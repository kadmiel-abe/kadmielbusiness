import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Route POST /api/payments/create-link
 * Crée un client (ou réutilise un existant) et insère le paiement dans Supabase.
 * Contourne les RLS de manière sécurisée côté serveur.
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { id, client_name, client_phone, service_name, amount_net, amount_total, expires_at, is_single_use, max_uses, fee_bearer, business_type } = body || {};

    if (!client_name || !client_phone || !service_name || !amount_net || !amount_total) {
      return NextResponse.json(
        { error: 'Tous les champs obligatoires doivent être renseignés.' },
        { status: 400 }
      );
    }

    // 1. Recherche ou création du client dans la table `clients`
    let clientId = null;
    const cleanPhone = client_phone.trim();

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
          name: client_name.trim(),
          phone: cleanPhone,
        })
        .select('id')
        .single();

      if (clientErr) {
        console.error('[CreateLink API] Erreur création client :', clientErr);
        // Fallback sans bloquer si la création client échoue
      } else {
        clientId = createdClient?.id;
      }
    }

    // 2. Traitement de la validité et de l'usage
    const isSingleUse = is_single_use !== false;
    const computedMaxUses = isSingleUse ? 1 : Math.max(1, parseInt(max_uses, 10) || 1);
    const computedExpiresAt = expires_at ? new Date(expires_at).toISOString() : null;
    const computedFeeBearer = fee_bearer === 'freelance' ? 'freelance' : 'client';
    const computedBusinessType = business_type === 'restaurant' ? 'restaurant' : 'freelance';

    // 3. Insertion du paiement dans la table `payments` avec fallback automatique de résilience
    const paymentId = id || crypto.randomUUID();
    const fullPayload = {
      id: paymentId,
      client_id: clientId,
      service_name: service_name.trim(),
      amount_net: Number(amount_net),
      amount_total: Number(amount_total),
      status: 'en_attente',
      business_type: computedBusinessType,
      expires_at: computedExpiresAt,
      is_single_use: isSingleUse,
      max_uses: computedMaxUses,
      times_used: 0,
      fee_bearer: computedFeeBearer,
    };

    let { data: payment, error: payErr } = await supabaseAdmin
      .from('payments')
      .insert(fullPayload)
      .select('*, client:clients(*)')
      .single();

    // Si les colonnes étendues n'ont pas encore été créées dans Supabase, repli gracieux
    if (payErr && payErr.message && (payErr.message.includes('column') || payErr.message.includes('schema cache'))) {
      console.warn('[CreateLink API] Repli résilient sur les colonnes de base :', payErr.message);
      const basePayload = {
        id: paymentId,
        client_id: clientId,
        service_name: service_name.trim(),
        amount_net: Number(amount_net),
        amount_total: Number(amount_total),
        status: 'en_attente',
      };
      const retry = await supabaseAdmin
        .from('payments')
        .insert(basePayload)
        .select('*, client:clients(*)')
        .single();
      payment = retry.data;
      payErr = retry.error;
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
        payment,
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
