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

    // 1. Recherche par UUID (id) ou par token unique
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    let payment = null;
    let error = null;

    if (isUuid) {
      const res = await supabaseAdmin
        .from('payments')
        .select('*, client:clients(id, name, phone, email)')
        .eq('id', id)
        .maybeSingle();
      payment = res.data;
      error = res.error;
    }

    // Si non trouvé par ID ou si non-UUID, chercher par token dans payments
    if (!payment) {
      try {
        const tokenRes = await supabaseAdmin
          .from('payments')
          .select('*, client:clients(id, name, phone, email)')
          .eq('token', id)
          .maybeSingle();
        if (tokenRes.data) {
          payment = tokenRes.data;
          error = null;
        }
      } catch {
        // Ignorer si colonne absente
      }
    }

    // Repli de compatibilité dans la table payment_links
    if (!payment) {
      try {
        const linkRes = await supabaseAdmin
          .from('payment_links')
          .select('*, client:clients(id, name, phone, email)')
          .or(`token.eq.${id},id.eq.${isUuid ? id : '00000000-0000-0000-0000-000000000000'}`)
          .maybeSingle();

        if (linkRes.data) {
          const l = linkRes.data;
          payment = {
            id: l.id,
            token: l.token,
            service_name: l.service_name,
            amount_net: l.net_amount,
            amount_total: l.total_amount,
            fee_amount: l.fee_amount,
            status: l.status,
            business_type: l.business_type,
            client: l.client,
            client_id: l.client_id,
            expires_at: l.expires_at,
            created_at: l.created_at,
            payment_method: l.payment_method,
            geniuspay_ref: l.external_transaction_id,
          };
          error = null;
        }
      } catch {
        // Table optionnelle
      }
    }

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
          business_type: payment.business_type || 'freelance',
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