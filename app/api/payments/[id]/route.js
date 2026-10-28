import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/payments/[id]
 * Récupère les données publiques nécessaires au client pour régler sa prestation.
 * Accessible publiquement pour les liens envoyés aux clients, sans dépendance
 * directe aux autorisations RLS de l'API anonyme.
 */
export async function GET(request, { params }) {
  try {
    const { id } = params || {};

    if (!id) {
      return NextResponse.json(
        { error: 'Identifiant de paiement requis.' },
        { status: 400 }
      );
    }

    const { data: payment, error } = await supabaseAdmin
      .from('payments')
      .select('id, service_name, amount_net, amount_total, status, created_at, client:clients(id, name, phone, email)')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('[API Payment ID GET] Erreur Supabase :', error);
      return NextResponse.json(
        { error: 'Erreur lors de la recherche du paiement.' },
        { status: 500 }
      );
    }

    if (!payment) {
      return NextResponse.json(
        { error: 'Ce lien de paiement est invalide ou a expiré.' },
        { status: 404 }
      );
    }

    const client = payment.client || {};
    const clientName = client.name || 'Client';

    return NextResponse.json({
      success: true,
      payment: {
        id: payment.id,
        service_name: payment.service_name || 'Prestation',
        amount_net: Number(payment.amount_net) || 0,
        amount_total: Number(payment.amount_total) || 0,
        status: payment.status || 'en_attente',
        created_at: payment.created_at,
        client: {
          name: clientName,
          phone: client.phone || '',
        },
      },
    });
  } catch (err) {
    console.error('[API Payment ID GET] Exception non gérée :', err);
    return NextResponse.json(
      { error: 'Erreur serveur interne lors du chargement du paiement.' },
      { status: 500 }
    );
  }
}
