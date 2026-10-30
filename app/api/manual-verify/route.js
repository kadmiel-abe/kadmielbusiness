import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendReceiptEmail } from '@/lib/receiptService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * =========================================================================
 * ROUTE /api/manual-verify — GESTION DU MODE DE SECOURS
 * =========================================================================
 * 1. POST : Déclenché par le CLIENT sur la page de paiement
 *    Enregistre la référence de transaction SMS et passe le statut en 'a_verifier'.
 *
 * 2. PATCH : Déclenché par l'ADMINISTRATEUR (Dashboard)
 *    Permet la validation ('validate') ou le refus ('reject') d'un paiement de secours.
 *    - Si 'validate' : statut 'paye', verrouillage du lien (usage unique), envoi du reçu.
 *    - Si 'reject'   : statut 'echoue'.
 *
 * 3. GET : Récupère la liste des paiements en attente de vérification manuelle.
 */

/**
 * GET /api/manual-verify
 * Liste tous les paiements avec le statut 'a_verifier'.
 */
export async function GET() {
  try {
    const { data: pending, error } = await supabaseAdmin
      .from('payments')
      .select('*, client:clients(*)')
      .eq('status', 'a_verifier')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Manual-Verify GET] Erreur Supabase :', error);
      return NextResponse.json(
        { error: 'Erreur lors de la récupération des paiements à vérifier.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ payments: pending || [] }, { status: 200 });
  } catch (err) {
    console.error('[Manual-Verify GET] Exception :', err);
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
  }
}

/**
 * POST /api/manual-verify (CLIENT)
 * Permet au client de soumettre la référence SMS de son transfert mobile money.
 */
export async function POST(request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Format JSON invalide.' }, { status: 400 });
    }

    const { paymentId, manualTxId } = body || {};

    if (!paymentId || !manualTxId) {
      return NextResponse.json(
        { error: 'Les champs "paymentId" et "manualTxId" sont requis.' },
        { status: 400 }
      );
    }

    // Récupération et vérification de la validité du paiement
    const { data: payment, error: fetchError } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .single();

    if (fetchError || !payment) {
      return NextResponse.json({ error: 'Paiement introuvable.' }, { status: 404 });
    }

    const now = new Date();
    if (payment.expires_at && now > new Date(payment.expires_at)) {
      return NextResponse.json({ error: 'Ce lien de paiement a expiré.' }, { status: 410 });
    }

    const isSingleUse = payment.is_single_use !== false;
    const maxUses = Number(payment.max_uses) || 1;
    const timesUsed = Number(payment.times_used) || 0;

    if (isSingleUse && (payment.status === 'paye' || timesUsed >= 1)) {
      return NextResponse.json(
        { error: 'Ce lien a déjà été utilisé et validé.' },
        { status: 400 }
      );
    }

    if (!isSingleUse && timesUsed >= maxUses) {
      return NextResponse.json(
        { error: `Ce lien a déjà atteint son nombre maximal d'utilisations (${timesUsed}/${maxUses}).` },
        { status: 400 }
      );
    }

    // Mise à jour de la référence manuelle et bascule en 'a_verifier'
    const { error: updateError } = await supabaseAdmin
      .from('payments')
      .update({
        manual_tx_id: String(manualTxId).trim(),
        status: 'a_verifier',
        updated_at: now.toISOString(),
      })
      .eq('id', paymentId);

    if (updateError) {
      console.error('[Manual-Verify POST] Erreur mise à jour :', updateError);
      return NextResponse.json(
        { error: 'Erreur lors de l\'enregistrement de la référence.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Votre référence a bien été reçue. Validation en cours par le prestataire.',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Manual-Verify POST] Exception :', error);
    return NextResponse.json({ error: 'Erreur serveur interne.' }, { status: 500 });
  }
}

/**
 * PATCH /api/manual-verify (ADMINISTRATEUR)
 * Endpoint de décision pour l'administrateur en mode secours :
 * - action: 'validate' -> Passe en 'paye', verrouille l'usage unique, transmet le reçu officiel.
 * - action: 'reject'   -> Passe en 'echoue'.
 */
export async function PATCH(request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Format JSON invalide.' }, { status: 400 });
    }

    const { paymentId, action, adminNote } = body || {};

    if (!paymentId || !action) {
      return NextResponse.json(
        { error: 'Les champs "paymentId" et "action" (\'validate\' | \'reject\') sont requis.' },
        { status: 400 }
      );
    }

    const normalizedAction = action.toLowerCase().trim();
    if (!['validate', 'approve', 'reject', 'refuse'].includes(normalizedAction)) {
      return NextResponse.json(
        { error: 'Action non reconnue. Utilisez "validate" ou "reject".' },
        { status: 400 }
      );
    }

    // 1. Récupération des données du paiement
    const { data: payment, error: fetchErr } = await supabaseAdmin
      .from('payments')
      .select('*, client:clients(*)')
      .eq('id', paymentId)
      .single();

    if (fetchErr || !payment) {
      return NextResponse.json({ error: 'Paiement introuvable.' }, { status: 404 });
    }

    const nowIso = new Date().toISOString();

    // 2. Décision ADMINISTRATEUR : VALIDATION
    if (normalizedAction === 'validate' || normalizedAction === 'approve') {
      const isSingleUse = payment.is_single_use !== false;
      const currentTimesUsed = Number(payment.times_used) || 0;
      const newTimesUsed = currentTimesUsed + 1;

      const baseUpdate = {
        status: 'paye', // Statut officiel payé
        payment_method: payment.payment_method || 'manuel_mobile_money',
        updated_at: nowIso,
      };

      // Tentative avec champs de verrouillage étendus (times_used, paid_at)
      let { data: updated, error: updateErr } = await supabaseAdmin
        .from('payments')
        .update({
          ...baseUpdate,
          times_used: newTimesUsed,
          paid_at: nowIso,
        })
        .eq('id', paymentId)
        .select('*, client:clients(*)')
        .single();

      // Repli si les colonnes étendues n'existent pas encore
      if (updateErr && updateErr.message && (updateErr.message.includes('column') || updateErr.message.includes('schema cache'))) {
        console.warn('[Manual-Verify PATCH] Repli sur colonnes standards :', updateErr.message);
        const retry = await supabaseAdmin
          .from('payments')
          .update(baseUpdate)
          .eq('id', paymentId)
          .select('*, client:clients(*)')
          .single();
        updated = retry.data;
        updateErr = retry.error;
      }

      if (updateErr || !updated) {
        console.error('[Manual-Verify PATCH] Erreur mise à jour :', updateErr);
        return NextResponse.json(
          { error: 'Erreur lors de la validation du paiement en base de données.' },
          { status: 500 }
        );
      }

      // Enregistrement d'un log d'audit dans webhook_logs pour traçabilité
      try {
        await supabaseAdmin.from('webhook_logs').insert({
          event_id: `admin_manual_validate_${paymentId}_${Date.now()}`,
          payload: {
            payment_id: paymentId,
            action: 'manual_validation',
            manual_tx_id: payment.manual_tx_id,
            admin_note: adminNote || null,
            validated_at: nowIso,
          },
          status: 'admin_validated',
        });
      } catch (logErr) {
        console.warn('[Manual-Verify PATCH] Log audit webhook non bloquant :', logErr.message);
      }

      // Déclenchement automatique de l'envoi du reçu par email si disponible
      try {
        const clientEmail = updated.receipt_email || updated.client?.email;
        if (clientEmail) {
          const host =
            request.headers.get('x-forwarded-host') ||
            request.headers.get('host') ||
            'kadmielbusiness.vercel.app';
          const proto = request.headers.get('x-forwarded-proto') || 'https';
          const baseUrl = `${proto}://${host}`;
          await sendReceiptEmail({ toEmail: clientEmail, payment: updated, baseUrl });
          console.info(`[Manual-Verify PATCH] Reçu envoyé à ${clientEmail}`);
        }
      } catch (emailErr) {
        console.warn('[Manual-Verify PATCH] Envoi reçu non bloquant :', emailErr.message);
      }

      console.info(`[Manual-Verify - Admin] Paiement ${paymentId} validé manuellement avec succès.`);

      return NextResponse.json(
        {
          success: true,
          message: 'Paiement validé avec succès en mode secours.',
          payment: updated,
          status: 'paye',
        },
        { status: 200 }
      );
    }

    // 3. Décision ADMINISTRATEUR : REFUS / REJET
    if (normalizedAction === 'reject' || normalizedAction === 'refuse') {
      const { data: updated, error: updateErr } = await supabaseAdmin
        .from('payments')
        .update({
          status: 'echoue',
          updated_at: nowIso,
        })
        .eq('id', paymentId)
        .select()
        .single();

      if (updateErr) {
        console.error('[Manual-Verify PATCH] Erreur refus paiement :', updateErr);
        return NextResponse.json(
          { error: 'Erreur lors du rejet du paiement.' },
          { status: 500 }
        );
      }

      // Traçabilité d'audit dans webhook_logs
      try {
        await supabaseAdmin.from('webhook_logs').insert({
          event_id: `admin_manual_reject_${paymentId}_${Date.now()}`,
          payload: {
            payment_id: paymentId,
            action: 'manual_rejection',
            manual_tx_id: payment.manual_tx_id,
            admin_note: adminNote || null,
            rejected_at: nowIso,
          },
          status: 'admin_rejected',
        });
      } catch (logErr) {
        console.warn('[Manual-Verify PATCH] Log audit webhook non bloquant :', logErr.message);
      }

      console.info(`[Manual-Verify - Admin] Paiement ${paymentId} rejeté.`);

      return NextResponse.json(
        {
          success: true,
          message: 'Le paiement de secours a été refusé et marqué comme échoué.',
          payment: updated,
          status: 'echoue',
        },
        { status: 200 }
      );
    }

    return NextResponse.json({ error: 'Action non reconnue.' }, { status: 400 });
  } catch (error) {
    console.error('[Manual-Verify PATCH] Exception :', error);
    return NextResponse.json(
      { error: 'Erreur serveur interne lors du traitement administrateur.' },
      { status: 500 }
    );
  }
}
