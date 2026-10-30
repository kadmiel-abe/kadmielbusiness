import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/clients
 * Récupère la liste de tous les clients avec indicateurs CRM agrégés
 * (Total liens générés, Chiffre d'affaires encaissé, Validés vs En attente, Dernière interaction).
 * Sécurisé : nécessite une session administrateur.
 */
export async function GET(request) {
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

    // 1. Récupération des clients avec leurs paiements associés
    const { data: clientsData, error: clientErr } = await supabaseAdmin
      .from('clients')
      .select('*, payments(*)')
      .order('created_at', { ascending: false });

    if (clientErr) {
      console.error('[API Clients GET] Erreur Supabase :', clientErr);
      return NextResponse.json(
        { error: 'Erreur lors du chargement des clients.', details: clientErr.message },
        { status: 500 }
      );
    }

    // Paramètres optionnels de filtre par période (ex: ?startDate=...&endDate=...)
    const { searchParams } = new URL(request.url);
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const periodStartDate = startDateParam ? new Date(startDateParam) : null;
    const periodEndDate = endDateParam ? new Date(endDateParam) : null;

    // 2. Calcul des indicateurs CRM agrégés par client
    const now = new Date();
    const clients = (clientsData || []).map((c) => {
      const allPayments = Array.isArray(c.payments) ? c.payments : [];

      // Dates et paiements sur la période demandée le cas échéant
      const periodPayments = allPayments.filter((p) => {
        if (!periodStartDate && !periodEndDate) return true;
        const pDate = new Date(p.created_at);
        if (isNaN(pDate.getTime())) return true;
        if (periodStartDate && pDate < periodStartDate) return false;
        if (periodEndDate && pDate > periodEndDate) return false;
        return true;
      });

      // Statistiques globales du client
      const totalPaymentsCount = allPayments.length;
      const paidPayments = allPayments.filter((p) => p.status === 'paye' || p.statut === 'paye');
      const paidCount = paidPayments.length;

      const pendingPayments = allPayments.filter((p) => {
        const isPaid = p.status === 'paye' || p.statut === 'paye';
        const isExpired = p.status === 'expire' || p.statut === 'expire' || (!isPaid && p.expires_at && now > new Date(p.expires_at));
        return !isPaid && !isExpired;
      });
      const pendingCount = pendingPayments.length;

      const expiredPayments = allPayments.filter((p) => {
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

      // Statistiques restreintes à la période
      const periodPaidPayments = periodPayments.filter((p) => p.status === 'paye' || p.statut === 'paye');
      const periodPaidAmount = periodPaidPayments.reduce(
        (sum, p) => sum + (Number(p.amount_total ?? p.montant_total ?? p.amount_net ?? p.montant_net) || 0),
        0
      );
      const periodPaymentsCount = periodPayments.length;

      // Calcul de la dernière date d'interaction (paiement ou création de lien)
      let lastInteractionAt = c.created_at;
      if (allPayments.length > 0) {
        const paymentDates = allPayments
          .map((p) => new Date(p.paid_at || p.created_at).getTime())
          .filter((t) => !isNaN(t));
        if (paymentDates.length > 0) {
          const maxTime = Math.max(...paymentDates);
          lastInteractionAt = new Date(maxTime).toISOString();
        }
      }

      // Panier moyen et taux de conversion
      const averageBasket = paidCount > 0 ? Math.round(totalPaidAmount / paidCount) : 0;
      const successRate = totalPaymentsCount > 0 ? Math.round((paidCount / totalPaymentsCount) * 100) : 0;

      // Déterminer le statut client si non renseigné
      let computedStatus = c.status || 'actif';
      if (!c.status) {
        if (totalPaidAmount >= 200000 || paidCount >= 3) {
          computedStatus = 'vip';
        } else if (totalPaymentsCount === 0) {
          computedStatus = 'prospect';
        } else {
          computedStatus = 'actif';
        }
      }

      return {
        id: c.id,
        name: c.name || c.nom || 'Client sans nom',
        phone: c.phone || c.telephone || '',
        email: c.email || '',
        status: computedStatus,
        notes: c.notes || '',
        created_at: c.created_at,
        updated_at: c.updated_at || c.created_at,
        last_interaction_at: lastInteractionAt,
        // Métriques globales
        total_payments_count: totalPaymentsCount,
        paid_payments_count: paidCount,
        pending_payments_count: pendingCount,
        expired_payments_count: expiredCount,
        total_paid_amount: totalPaidAmount,
        total_pending_amount: totalPendingAmount,
        average_basket: averageBasket,
        success_rate: successRate,
        // Métriques de période
        period_paid_amount: periodPaidAmount,
        period_payments_count: periodPaymentsCount,
        is_active_in_period: periodPaymentsCount > 0,
      };
    });

    return NextResponse.json({
      success: true,
      clients,
      totalCount: clients.length,
    });
  } catch (error) {
    console.error('[API Clients GET] Exception serveur :', error);
    return NextResponse.json(
      { error: 'Erreur interne lors de la récupération du répertoire clients.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/clients
 * Crée manuellement un nouveau client dans le répertoire.
 */
export async function POST(request) {
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
    const { name, phone, email, status, notes } = body || {};

    if (!name?.trim() || !phone?.trim()) {
      return NextResponse.json(
        { error: 'Le nom et le numéro de téléphone sont obligatoires.' },
        { status: 400 }
      );
    }

    const cleanPhone = phone.trim();
    const cleanName = name.trim();
    const cleanEmail = email?.trim() || null;
    const cleanStatus = status || 'actif';
    const cleanNotes = notes?.trim() || '';

    // Vérifier si le numéro existe déjà
    const { data: existing } = await supabaseAdmin
      .from('clients')
      .select('id, name, phone')
      .eq('phone', cleanPhone)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        {
          error: `Un client avec le numéro ${cleanPhone} existe déjà (${existing.name}).`,
          existingClient: existing,
        },
        { status: 409 }
      );
    }

    // Insertion sécurisée
    const insertPayload = {
      name: cleanName,
      phone: cleanPhone,
      email: cleanEmail,
    };

    let { data: newClient, error: insertErr } = await supabaseAdmin
      .from('clients')
      .insert({
        ...insertPayload,
        status: cleanStatus,
        notes: cleanNotes,
      })
      .select()
      .single();

    // Si erreur colonne notes/status non trouvée (migration non encore appliquée), fallback sans ces colonnes
    if (insertErr && insertErr.code === 'PGRST204') {
      const fallback = await supabaseAdmin
        .from('clients')
        .insert(insertPayload)
        .select()
        .single();
      newClient = fallback.data;
      insertErr = fallback.error;
    }

    if (insertErr || !newClient) {
      console.error('[API Clients POST] Erreur insertion :', insertErr);
      return NextResponse.json(
        { error: 'Impossible de créer le client en base de données.', details: insertErr?.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        client: {
          ...newClient,
          status: newClient.status || cleanStatus,
          notes: newClient.notes || cleanNotes,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[API Clients POST] Exception serveur :', error);
    return NextResponse.json(
      { error: 'Erreur interne lors de la création du client.' },
      { status: 500 }
    );
  }
}
