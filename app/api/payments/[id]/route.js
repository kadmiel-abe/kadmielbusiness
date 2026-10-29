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

    // Récupération du paiement avec la relation client (clé étrangère client_id -> clients)
    const { data: payment, error } = await supabaseAdmin
      .from('payments')
      .select('id, service_name, amount_net, amount_total, status, created_at, geniuspay_ref, client:clients(id, name, phone, email)')
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
        { error: 'Lien de paiement introuvable ou expiré.' },
        { status: 404 }
      );
    }

    const client = payment.client || {};
    const clientName = client.name || 'Client';

    return NextResponse.json(
      {
        success: true,
        payment: {
          id: payment.id,
          client_name: clientName,
          service_name: payment.service_name || 'Prestation',
          amount_net: Number(payment.amount_net) || 0,
          amount_total: Number(payment.amount_total) || 0,
          status: payment.status || 'en_attente',
          created_at: payment.created_at,
          geniuspay_ref: payment.geniuspay_ref || null,
          client: {
            name: clientName,
            phone: client.phone || '',
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