import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendReceiptEmail } from '@/lib/receiptService';
import { getClientIp, checkRateLimit } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * =========================================================================
 * ROUTE /api/manual-verify — GESTION DU MODE DE SECOURS SÉCURISÉE
 * =========================================================================
 * 1. GET : Déclenché par l'ADMINISTRATEUR (Dashboard)
 *    Sécurisé : Nécessite une session Supabase active.
 *    Liste tous les paiements avec le statut 'a_verifier'.
 *
 * 2. POST : Déclenché par le CLIENT sur la page de paiement
 *    Public mais protégé contre les abus (Rate Limiting + validation stricte).
 *    Enregistre la référence de transaction SMS et passe le statut en 'a_verifier'.
 *
 * 3. PATCH : Déclenché par l'ADMINISTRATEUR (Dashboard)
 *    Sécurisé : Nécessite une session Supabase active.
 *    Permet la validation ('validate') ou le refus ('reject') d'un paiement de secours.
 */

/**
 * GET /api/manual-verify (ADMIN SEULEMENT)
 */
export async function GET() {
  try {
    // 1. Contrôle d'accès strict : Vérification de la session administrateur
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json(
        { error: 'Accès refusé. Session administrateur requise.' },
        { status: 401 }
      );
    }

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
 * POST /api/manual-verify (CLIENT - SOUMISSION SMS TRANSACTION)
 * Sécurisé avec limitation de débit (5 requêtes par 5 min par IP) et assainissement des entrées.
 */
export async function POST(request) {
  try {
    // 1. Protection Anti-Brute Force / Déni de Service (Rate Limiting)
    const clientIp = getClientIp(request);
    const rateCheck = checkRateLimit({
      key: `manual-verify:${clientIp}`,
      limit: 5,
      windowMs: 5 * 60 * 1000,
    });

    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: 'Trop de tentatives de soumission. Veuillez patienter quelques minutes avant de réessayer.',
        },
        { status: 429 }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Format JSON invalide.' }, { status: 400 });
    }

    const { paymentId, manualTxId } = body || {};

    // 2. Validation stricte du format des données d'entrée
    if (!paymentId || typeof paymentId !== 'string') {
      return NextResponse.json(
        { error: 'Le champ "paymentId" est requis et doit être valide.' },
        { status: 400 }
      );
    }

    const cleanPaymentId = paymentId.trim();
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(cleanPaymentId)) {
      return NextResponse.json(
        { error: 'Format d\'identifiant de paiement invalide.' },
        { status: 400 }
      );
    }

    if (!manualTxId || typeof manualTxId !== 'string') {
      return NextResponse.json(
        { error: 'Le champ "manualTxId" est requis.' },
        { status: 400 }
      );
    }

    // Assainissement de la référence (longueur max 64, caractères alphanumériques et séparateurs usuels)
    const sanitizedTxId = manualTxId.trim().replace(/[^a-zA-Z0-9_\-\.\:\/]/g, '').slice(0, 64);
    if (sanitizedTxId.length < 3) {
      return NextResponse.json(
        { error: 'La référence de transaction SMS doit comporter au moins 3 caractères valides.' },
        { status: 400 }
      );
    }

    // 3. Récupération et vérification de la validité du paiement (par id ou token)
    let { data: payment, error: fetchError } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('id', cleanPaymentId)
      .maybeSingle();

    if (!payment) {
      try {
        const tokenRes = await supabaseAdmin
          .from('payments')
          .select('*')
          .eq('token', cleanPaymentId)
          .maybeSingle();
        if (tokenRes.data) {
          payment = tokenRes.data;
          fetchError = null;
        }
      } catch {
        // Ignorer si pas de colonne token
      }
    }

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

    // 4. Mise à jour de la référence manuelle et bascule en 'a_verifier'
    const { error: updateError } = await supabaseAdmin
      .from('payments')
      .update({
        manual_tx_id: sanitizedTxId,
        status: 'a_verifier',
        updated_at: now.toISOString(),
      })
      .eq('id', payment.id);

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
 * PATCH /api/manual-verify (ADMINISTRATEUR SEULEMENT)
 * Sécurisé : Nécessite impérativement une session active pour valider ou rejeter.
 */
export async function PATCH(request) {
  try {
    // 1. Contrôle d'accès strict : Vérification de la session administrateur
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json(
        { error: 'Accès non autorisé. Session administrateur requise pour valider un paiement.' },
        { status: 401 }
      );
    }

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

    const cleanPaymentId = String(paymentId).trim();
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(cleanPaymentId)) {
      return NextResponse.json(
        { error: 'Identifiant de paiement invalide.' },
        { status: 400 }
      );
    }

    const normalizedAction = String(action).toLowerCase().trim();
    if (!['validate', 'approve', 'reject', 'refuse'].includes(normalizedAction)) {
      return NextResponse.json(
        { error: 'Action non reconnue. Utilisez "validate" ou "reject".' },
        { status: 400 }
      );
    }

    // 2. Récupération des données du paiement
    const { data: payment, error: fetchErr } = await supabaseAdmin
      .from('payments')
      .select('*, client:clients(*)')
      .eq('id', cleanPaymentId)
      .single();

    if (fetchErr || !payment) {
      return NextResponse.json({ error: 'Paiement introuvable.' }, { status: 404 });
    }

    const nowIso = new Date().toISOString();

    // 3. Décision ADMINISTRATEUR : VALIDATION
    if (normalizedAction === 'validate' || normalizedAction === 'approve') {
      const isSingleUse = payment.is_single_use !== false;
      const currentTimesUsed = Number(payment.times_used) || 0;
      const newTimesUsed = currentTimesUsed + 1;

      const baseUpdate = {
        status: 'paye',
        payment_method: payment.payment_method || 'manuel_mobile_money',
        updated_at: nowIso,
      };

      // Tentative avec champs étendus
      let { data: updated, error: updateErr } = await supabaseAdmin
        .from('payments')
        .update({
          ...baseUpdate,
          times_used: newTimesUsed,
          paid_at: nowIso,
        })
        .eq('id', cleanPaymentId)
        .select('*, client:clients(*)')
        .single();

      // Repli si colonnes étendues non présentes
      if (updateErr && updateErr.message && (updateErr.message.includes('column') || updateErr.message.includes('schema cache'))) {
        console.warn('[Manual-Verify PATCH] Repli sur colonnes standards :', updateErr.message);
        const retry = await supabaseAdmin
          .from('payments')
          .update(baseUpdate)
          .eq('id', cleanPaymentId)
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
          event_id: `admin_manual_validate_${cleanPaymentId}_${Date.now()}`,
          payload: {
            payment_id: cleanPaymentId,
            admin_user_id: session.user.id,
            admin_email: session.user.email,
            action: 'manual_validation',
            manual_tx_id: payment.manual_tx_id,
            admin_note: adminNote ? String(adminNote).slice(0, 500) : null,
            validated_at: nowIso,
          },
          status: 'admin_validated',
        });
      } catch (logErr) {
        console.warn('[Manual-Verify PATCH] Log audit non bloquant :', logErr.message);
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

      console.info(`[Manual-Verify - Admin] Paiement ${cleanPaymentId} validé par ${session.user.email}`);

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

    // 4. Décision ADMINISTRATEUR : REFUS / REJET
    if (normalizedAction === 'reject' || normalizedAction === 'refuse') {
      const { data: updated, error: updateErr } = await supabaseAdmin
        .from('payments')
        .update({
          status: 'echoue',
          updated_at: nowIso,
        })
        .eq('id', cleanPaymentId)
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
          event_id: `admin_manual_reject_${cleanPaymentId}_${Date.now()}`,
          payload: {
            payment_id: cleanPaymentId,
            admin_user_id: session.user.id,
            admin_email: session.user.email,
            action: 'manual_rejection',
            manual_tx_id: payment.manual_tx_id,
            admin_note: adminNote ? String(adminNote).slice(0, 500) : null,
            rejected_at: nowIso,
          },
          status: 'admin_rejected',
        });
      } catch (logErr) {
        console.warn('[Manual-Verify PATCH] Log audit non bloquant :', logErr.message);
      }

      console.info(`[Manual-Verify - Admin] Paiement ${cleanPaymentId} rejeté par ${session.user.email}`);

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
