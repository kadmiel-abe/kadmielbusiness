import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'ID de paiement manquant.' }, { status: 400 });
    }

    // Récupération résiliente du paiement avec la relation client (clé étrangère client_id -> clients)
    const { data: payment, error } = await supabaseAdmin
      .from('payments')
      .select('*, client:clients(id, name, phone, email)')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('[API Payment ID GET] Erreur Supabase :', error);
      return NextResponse.json(
        { error: 'Erreur lors de la récupération du paiement.', details: error.message },
        { status: 500 }
      );
    }

    if (!payment) {
      return NextResponse.json(
        { error: 'Lien de paiement introuvable ou supprimé.' },
        { status: 404 }
      );
    }

    const client = Array.isArray(payment.client) ? payment.client[0] || {} : (payment.client || {});
    const clientName = client.name || payment.client_name || payment.customer_name || 'Client';

    const now = new Date();
    const isExpired = payment.expires_at ? now > new Date(payment.expires_at) : false;
    const isSingleUse = payment.is_single_use !== false;
    const maxUses = Number(payment.max_uses) || 1;
    const timesUsed = Number(payment.times_used) || 0;
    const isPaid = payment.status === 'paye' || payment.statut === 'paye';
    const isUsageExceeded = isSingleUse ? (timesUsed >= 1 && isPaid) : (timesUsed >= maxUses);

    let effectiveStatus = payment.status || 'en_attente';
    if (isExpired && effectiveStatus === 'en_attente') {
      effectiveStatus = 'expire';
      // Mise à jour de sécurité asynchrone sans bloquer
      supabaseAdmin.from('payments').update({ status: 'expire' }).eq('id', payment.id).then(() => {}).catch(() => {});
    }

    return NextResponse.json(
      {
        success: true,
        payment: {
          id: payment.id,
          client_name: clientName,
          service_name: payment.service_name || payment.service || 'Prestation',
          amount_net: Number(payment.amount_net ?? payment.montant_net) || 0,
          amount_total: Number(payment.amount_total ?? payment.montant_total) || 0,
          status: effectiveStatus,
          statut: effectiveStatus,
          fee_bearer: payment.fee_bearer || 'client',
          payment_method: payment.payment_method || null,
          manual_tx_id: payment.manual_tx_id || null,
          receipt_email: payment.receipt_email || null,
          receipt_sent_at: payment.receipt_sent_at || null,
          created_at: payment.created_at,
          paid_at: payment.paid_at || null,
          geniuspay_ref: payment.geniuspay_ref || null,
          expires_at: payment.expires_at || null,
          is_single_use: isSingleUse,
          max_uses: maxUses,
          times_used: timesUsed,
          is_expired: isExpired,
          is_usage_exceeded: isUsageExceeded,
          client: {
            id: client.id || payment.client_id || null,
            name: clientName,
            phone: client.phone || client.telephone || payment.client_phone || '',
            email: client.email || null,
          },
        },
      },
      { status: 200 }
    );
  } catch (err) {
    console.error('[API Payment ID GET] Erreur serveur :', err);
    return NextResponse.json(
      { error: 'Erreur interne du serveur.', details: err.message },
      { status: 500 }
    );
  }
}