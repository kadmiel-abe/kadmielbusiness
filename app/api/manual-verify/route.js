import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Route POST /api/manual-verify
 * Permet au client de soumettre un ID de transaction reçu par SMS
 * en cas de problème technique avec le webhook automatique.
 * Met à jour le champ manual_tx_id et passe le statut à 'a_verifier'.
 */
export async function POST(request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Format JSON invalide.' },
        { status: 400 }
      );
    }

    const { paymentId, manualTxId } = body || {};

    if (!paymentId || !manualTxId) {
      return NextResponse.json(
        { error: 'Les champs "paymentId" et "manualTxId" sont requis.' },
        { status: 400 }
      );
    }

    // Vérification que le paiement existe et respecte les conditions de validité
    const { data: payment, error: fetchError } = await supabaseAdmin
      .from('payments')
      .select('id, status, expires_at, is_single_use, max_uses, times_used')
      .eq('id', paymentId)
      .single();

    if (fetchError || !payment) {
      return NextResponse.json(
        { error: 'Paiement introuvable.' },
        { status: 404 }
      );
    }

    const now = new Date();
    if (payment.expires_at && now > new Date(payment.expires_at)) {
      return NextResponse.json(
        { error: 'Ce lien de paiement a expiré.' },
        { status: 410 }
      );
    }

    const isSingleUse = payment.is_single_use !== false;
    const maxUses = Number(payment.max_uses) || 1;
    const timesUsed = Number(payment.times_used) || 0;

    if (isSingleUse && (payment.status === 'paye' || timesUsed >= 1)) {
      return NextResponse.json(
        { error: 'Ce lien a déjà été utilisé.' },
        { status: 400 }
      );
    }

    if (!isSingleUse && timesUsed >= maxUses) {
      return NextResponse.json(
        { error: `Ce lien a déjà atteint son nombre maximal d'utilisations (${timesUsed}/${maxUses}).` },
        { status: 400 }
      );
    }

    if (payment.status === 'paye') {
      return NextResponse.json(
        { error: 'Ce paiement est déjà confirmé.' },
        { status: 400 }
      );
    }

    // Mise à jour du champ manual_tx_id et passage en statut 'a_verifier'
    const { error: updateError } = await supabaseAdmin
      .from('payments')
      .update({
        manual_tx_id: manualTxId.trim(),
        status: 'a_verifier',
        updated_at: new Date().toISOString(),
      })
      .eq('id', paymentId);

    if (updateError) {
      console.error('[Manual-Verify] Erreur Supabase :', updateError);
      return NextResponse.json(
        { error: 'Erreur lors de la mise à jour.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Votre ID de transaction a été enregistré. Vérification en cours.',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Manual-Verify] Exception :', error);
    return NextResponse.json(
      { error: 'Erreur serveur interne.' },
      { status: 500 }
    );
  }
}
