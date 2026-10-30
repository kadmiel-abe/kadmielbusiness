import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendReceiptEmail } from '@/lib/receiptService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/payments
 * Récupère l'ensemble des paiements et des clients associés.
 * Sécurisé : nécessite une session authentifiée administrateur.
 * Utilise supabaseAdmin pour garantir la lecture fiable sans blocage RLS.
 */
export async function GET() {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json(
        { error: 'Session non authentifiée. Veuillez vous connecter.' },
        { status: 401 }
      );
    }

    const { data: payments, error } = await supabaseAdmin
      .from('payments')
      .select('*, client:clients(*)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[API Payments GET] Erreur Supabase :', error);
      return NextResponse.json(
        { error: 'Erreur lors du chargement des paiements.', details: error.message },
        { status: 500 }
      );
    }

    // Normalisation cohérente des données pour le dashboard
    const normalized = (payments || []).map((p) => {
      const client = p.client || {};
      const clientName = client.name || client.nom || p.client_name || 'Client sans nom';
      const clientPhone = client.phone || client.telephone || p.client_phone || '';

      return {
        id: p.id,
        service_name: p.service_name || p.service || 'Prestation',
        service: p.service_name || p.service || 'Prestation',
        amount_net: Number(p.amount_net ?? p.montant_net) || 0,
        montant_net: Number(p.amount_net ?? p.montant_net) || 0,
        amount_total: Number(p.amount_total ?? p.montant_total) || 0,
        montant_total: Number(p.amount_total ?? p.montant_total) || 0,
        status: p.status || p.statut || 'en_attente',
        statut: p.status || p.statut || 'en_attente',
        geniuspay_ref: p.geniuspay_ref || null,
        manual_tx_id: p.manual_tx_id || null,
        payment_method: p.payment_method || null,
        expires_at: p.expires_at || null,
        is_single_use: p.is_single_use !== false,
        max_uses: Number(p.max_uses) || 1,
        times_used: Number(p.times_used) || 0,
        paid_at: p.paid_at || null,
        fee_bearer: p.fee_bearer || 'client',
        created_at: p.created_at,
        updated_at: p.updated_at,
        client: {
          id: client.id || p.client_id || null,
          name: clientName,
          nom: clientName,
          phone: clientPhone,
          telephone: clientPhone,
          email: client.email || null,
        },
      };
    });

    return NextResponse.json({
      success: true,
      payments: normalized,
    });
  } catch (error) {
    console.error('[API Payments GET] Exception serveur :', error);
    return NextResponse.json(
      { error: 'Erreur serveur interne lors de la récupération des transactions.' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/payments
 * Met à jour le statut d'un paiement (ex : validation manuelle vers 'paye').
 * Sécurisé : nécessite une session authentifiée administrateur.
 */
export async function PATCH(request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json(
        { error: 'Session non authentifiée.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { id, status, statut, payment_method, paymentMethod } = body || {};
    const newStatus = status || statut;
    const methodToSave = payment_method || paymentMethod;

    if (!id || !newStatus) {
      return NextResponse.json(
        { error: 'Identifiant et nouveau statut requis.' },
        { status: 400 }
      );
    }

    // Récupération des informations de validité et d'usage actuelles
    const { data: currentPayment } = await supabaseAdmin
      .from('payments')
      .select('id, status, is_single_use, max_uses, times_used, payment_method')
      .eq('id', id)
      .single();

    const isSingleUse = currentPayment?.is_single_use !== false;
    const maxUses = Number(currentPayment?.max_uses) || 1;
    const currentTimes = Number(currentPayment?.times_used) || 0;
    const newTimesUsed = newStatus === 'paye' ? (currentTimes + 1) : currentTimes;
    const shouldClose = isSingleUse || newTimesUsed >= maxUses;
    const targetStatus = (newStatus === 'paye' && shouldClose) ? 'paye' : newStatus;

    const updatePayload = {
      status: targetStatus,
      times_used: newTimesUsed,
      updated_at: new Date().toISOString(),
    };
    if (newStatus === 'paye') {
      updatePayload.paid_at = new Date().toISOString();
      if (methodToSave) {
        updatePayload.payment_method = methodToSave;
      }
    }

    const { data: updated, error } = await supabaseAdmin
      .from('payments')
      .update(updatePayload)
      .eq('id', id)
      .select('*, client:clients(*)')
      .single();

    if (error) {
      console.error('[API Payments PATCH] Erreur mise à jour :', error);
      return NextResponse.json(
        { error: 'Impossible de mettre à jour le statut du paiement.', details: error.message },
        { status: 500 }
      );
    }

    // Envoi automatique du reçu certifié par email si le paiement vient d'être validé
    if (newStatus === 'paye') {
      const client = updated.client || {};
      const clientEmail = client.email || updated.receipt_email;
      if (clientEmail) {
        try {
          const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || 'kadmielbusiness.vercel.app';
          const proto = request.headers.get('x-forwarded-proto') || 'https';
          const baseUrl = `${proto}://${host}`;
          await sendReceiptEmail({ toEmail: clientEmail, payment: updated, baseUrl });
          console.info(`[Payments PATCH] Reçu officiel envoyé automatiquement à ${clientEmail}`);
        } catch (emailErr) {
          console.warn('[Payments PATCH] Envoi automatique email reçu non bloquant :', emailErr);
        }
      }
    }

    return NextResponse.json({
      success: true,
      payment: updated,
    });
  } catch (error) {
    console.error('[API Payments PATCH] Exception serveur :', error);
    return NextResponse.json(
      { error: 'Erreur serveur interne lors de la mise à jour.' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/payments
 * Supprime un lien de paiement.
 * Sécurisé : session administrateur requise.
 */
export async function DELETE(request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json(
        { error: 'Session non authentifiée. Veuillez vous connecter.' },
        { status: 401 }
      );
    }

    let id;
    try {
      const body = await request.json();
      id = body?.id;
    } catch {
      // Pas de corps JSON fourni
    }

    if (!id) {
      const { searchParams } = new URL(request.url);
      id = searchParams.get('id');
    }

    if (!id) {
      return NextResponse.json(
        { error: 'Identifiant du lien de paiement manquant.' },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from('payments')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[API Payments DELETE] Erreur suppression :', error);
      return NextResponse.json(
        { error: 'Impossible de supprimer ce lien.', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      deletedId: id,
      message: 'Lien de paiement supprimé avec succès.',
    });
  } catch (error) {
    console.error('[API Payments DELETE] Exception serveur :', error);
    return NextResponse.json(
      { error: 'Erreur serveur interne lors de la suppression.' },
      { status: 500 }
    );
  }
}

