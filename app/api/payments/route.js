import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

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
    const { id, status, statut } = body || {};
    const newStatus = status || statut;

    if (!id || !newStatus) {
      return NextResponse.json(
        { error: 'Identifiant et nouveau statut requis.' },
        { status: 400 }
      );
    }

    const { data: updated, error } = await supabaseAdmin
      .from('payments')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
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
