import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/clients/[id]
 * Récupère la fiche détaillée d'un client : coordonnées, KPIs financiers et historique complet de ses factures.
 */
export async function GET(request, { params }) {
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

    const { id } = params;
    if (!id) {
      return NextResponse.json({ error: 'Identifiant client requis.' }, { status: 400 });
    }

    // 1. Récupération du client
    const { data: client, error: clientErr } = await supabaseAdmin
      .from('clients')
      .select('*')
      .eq('id', id)
      .single();

    if (clientErr || !client) {
      return NextResponse.json(
        { error: 'Client introuvable.', details: clientErr?.message },
        { status: 404 }
      );
    }

    // 2. Récupération de tous les paiements liés à ce client
    const { data: paymentsData, error: payErr } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('client_id', id)
      .order('created_at', { ascending: false });

    const payments = paymentsData || [];
    const now = new Date();

    // 3. Calcul précis des KPIs CRM
    const totalPaymentsCount = payments.length;

    const paidPayments = payments.filter((p) => p.status === 'paye' || p.statut === 'paye');
    const paidCount = paidPayments.length;

    const pendingPayments = payments.filter((p) => {
      const isPaid = p.status === 'paye' || p.statut === 'paye';
      const isExpired = p.status === 'expire' || p.statut === 'expire' || (!isPaid && p.expires_at && now > new Date(p.expires_at));
      return !isPaid && !isExpired;
    });
    const pendingCount = pendingPayments.length;

    const expiredPayments = payments.filter((p) => {
      const isPaid = p.status === 'paye' || p.statut === 'paye';
      return p.status === 'expire' || p.statut === 'expire' || (!isPaid && p.expires_at && now > new Date(p.expires_at));
    });
    const expiredCount = expiredPayments.length;

    const totalPaidAmount = paidPayments.reduce(
      (sum, p) => sum + (Number(p.amount_total ?? p.montant_total ?? p.amount_net ?? p.montant_net) || 0),
      0
    );

    const totalPendingAmount = pendingPayments.reduce(
      (sum, p) => sum + (Number(p.amount_total ?? p.montant_total ?? p.amount_net ?? p.montant_net) || 0),
      0
    );

    const averageBasket = paidCount > 0 ? Math.round(totalPaidAmount / paidCount) : 0;
    const successRate = totalPaymentsCount > 0 ? Math.round((paidCount / totalPaymentsCount) * 100) : 0;

    // Dates d'interaction
    let lastInteractionAt = client.created_at;
    let firstInteractionAt = client.created_at;
    if (payments.length > 0) {
      const dates = payments.map((p) => new Date(p.paid_at || p.created_at).getTime()).filter((t) => !isNaN(t));
      if (dates.length > 0) {
        lastInteractionAt = new Date(Math.max(...dates)).toISOString();
        firstInteractionAt = new Date(Math.min(...dates)).toISOString();
      }
    }

    let computedStatus = client.status || 'actif';
    if (!client.status) {
      if (totalPaidAmount >= 200000 || paidCount >= 3) {
        computedStatus = 'vip';
      } else if (totalPaymentsCount === 0) {
        computedStatus = 'prospect';
      } else {
        computedStatus = 'actif';
      }
    }

    return NextResponse.json({
      success: true,
      client: {
        id: client.id,
        name: client.name || client.nom || 'Client sans nom',
        phone: client.phone || client.telephone || '',
        email: client.email || '',
        status: computedStatus,
        notes: client.notes || '',
        created_at: client.created_at,
        updated_at: client.updated_at || client.created_at,
      },
      stats: {
        total_payments_count: totalPaymentsCount,
        paid_count: paidCount,
        pending_count: pendingCount,
        expired_count: expiredCount,
        total_paid_amount: totalPaidAmount,
        total_pending_amount: totalPendingAmount,
        average_basket: averageBasket,
        success_rate: successRate,
        first_interaction_at: firstInteractionAt,
        last_interaction_at: lastInteractionAt,
      },
      payments,
    });
  } catch (error) {
    console.error('[API Clients/[id] GET] Exception serveur :', error);
    return NextResponse.json(
      { error: 'Erreur interne lors de la récupération de la fiche client.' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/clients/[id]
 * Met à jour les informations du client (nom, téléphone, email, statut CRM, notes internes).
 */
export async function PATCH(request, { params }) {
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

    const { id } = params;
    if (!id) {
      return NextResponse.json({ error: 'Identifiant client requis.' }, { status: 400 });
    }

    const body = await request.json();
    const { name, phone, email, status, notes } = body || {};

    const updatePayload = {};
    if (name !== undefined) {
      updatePayload.name = name.trim();
      updatePayload.nom = name.trim();
    }
    if (phone !== undefined) {
      updatePayload.phone = phone.trim();
      updatePayload.telephone = phone.trim();
    }
    if (email !== undefined) {
      updatePayload.email = email?.trim() || null;
    }
    if (status !== undefined) {
      updatePayload.status = status;
    }
    if (notes !== undefined) {
      updatePayload.notes = notes;
    }
    updatePayload.updated_at = new Date().toISOString();

    // Tentative de mise à jour avec l'ensemble des champs
    let { data: updated, error: updateErr } = await supabaseAdmin
      .from('clients')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    // Fallback gracieux si les colonnes status/notes n'ont pas encore été injectées dans la table
    if (updateErr && updateErr.code === 'PGRST204') {
      const safePayload = { ...updatePayload };
      delete safePayload.status;
      delete safePayload.notes;
      delete safePayload.updated_at;

      const fallback = await supabaseAdmin
        .from('clients')
        .update(safePayload)
        .eq('id', id)
        .select()
        .single();

      updated = fallback.data;
      updateErr = fallback.error;
    }

    if (updateErr || !updated) {
      console.error('[API Clients/[id] PATCH] Erreur mise à jour :', updateErr);
      return NextResponse.json(
        { error: 'Impossible de mettre à jour la fiche client.', details: updateErr?.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      client: {
        ...updated,
        status: updated.status || status || 'actif',
        notes: updated.notes !== undefined ? updated.notes : (notes || ''),
      },
      message: 'Fiche client mise à jour avec succès.',
    });
  } catch (error) {
    console.error('[API Clients/[id] PATCH] Exception serveur :', error);
    return NextResponse.json(
      { error: 'Erreur interne lors de la modification de la fiche client.' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/clients/[id]
 * Supprime un client si nécessaire.
 */
export async function DELETE(request, { params }) {
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

    const { id } = params;
    if (!id) {
      return NextResponse.json({ error: 'Identifiant client requis.' }, { status: 400 });
    }

    // Supprimer le client
    const { error: delErr } = await supabaseAdmin
      .from('clients')
      .delete()
      .eq('id', id);

    if (delErr) {
      console.error('[API Clients/[id] DELETE] Erreur suppression :', delErr);
      return NextResponse.json(
        { error: 'Impossible de supprimer ce client.', details: delErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Client supprimé du répertoire.',
    });
  } catch (error) {
    console.error('[API Clients/[id] DELETE] Exception serveur :', error);
    return NextResponse.json(
      { error: 'Erreur interne lors de la suppression du client.' },
      { status: 500 }
    );
  }
}
