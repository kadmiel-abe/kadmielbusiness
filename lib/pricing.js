import { supabaseAdmin } from './supabaseAdmin';

/**
 * =========================================================================
 * MODULE DE CALCUL FINANCIER & FRAIS GENIUSPAY (Côte d'Ivoire)
 * =========================================================================
 * Formule officielle GeniusPay :
 * Les frais sont payés par le client (ou pris en charge par le marchand).
 * total_amount = Math.ceil((net_amount + fixed_fee) / (1 - rate))
 * fee_amount = total_amount - net_amount
 */

export const DEFAULT_RATE = 0.01; // 1%
export const DEFAULT_FIXED_FEE = 100; // 100 FCFA

/**
 * Récupère les paramètres de commission depuis la table `settings` dans Supabase,
 * avec fallback sur les valeurs par défaut (1% + 100 XOF).
 */
export async function getFeeSettings() {
  try {
    const { data: rows, error } = await supabaseAdmin
      .from('settings')
      .select('key, value');

    if (error || !rows || !rows.length) {
      return { rate: DEFAULT_RATE, fixedFee: DEFAULT_FIXED_FEE };
    }

    const settingsMap = {};
    rows.forEach((r) => {
      settingsMap[r.key] = r.value;
    });

    const rate = parseFloat(settingsMap.geniuspay_rate) || DEFAULT_RATE;
    const fixedFee = parseInt(settingsMap.geniuspay_fixed_fee, 10) || DEFAULT_FIXED_FEE;

    return { rate, fixedFee };
  } catch (err) {
    console.warn('[Pricing] Fallback sur les paramètres par défaut :', err.message);
    return { rate: DEFAULT_RATE, fixedFee: DEFAULT_FIXED_FEE };
  }
}

/**
 * Calcule les frais et le montant total client selon la formule officielle :
 * total_amount = Math.ceil((net_amount + fixed_fee) / (1 - rate))
 * fee_amount = total_amount - net_amount
 *
 * @param {number} netAmount - Montant net souhaité par le freelance / restaurant
 * @param {object} [options] - Paramètres optionnels { rate, fixedFee, feeBearer }
 * @returns {object} { net_amount, fee_amount, total_amount, fee_bearer }
 */
export function calculatePaymentAmounts(netAmount, options = {}) {
  const net = Math.max(0, Math.round(Number(netAmount) || 0));
  const rate = options.rate != null ? Number(options.rate) : DEFAULT_RATE;
  const fixedFee = options.fixedFee != null ? Number(options.fixedFee) : DEFAULT_FIXED_FEE;
  const feeBearer = options.feeBearer === 'freelance' ? 'freelance' : 'client';

  if (net <= 0) {
    return {
      net_amount: 0,
      fee_amount: 0,
      total_amount: 0,
      fee_bearer: feeBearer,
    };
  }

  if (feeBearer === 'freelance') {
    // Les frais sont inclus et offerts au client : le client paie le montant net saisi
    const totalAmount = net;
    const feeAmount = Math.round(net * rate + fixedFee);
    const effectiveNet = Math.max(0, totalAmount - feeAmount);

    return {
      net_amount: effectiveNet,
      fee_amount: feeAmount,
      total_amount: totalAmount,
      fee_bearer: 'freelance',
    };
  }

  // Frais à la charge du client (défaut) :
  // Le freelance encaisse exactement net_amount
  // total_amount = Math.ceil((net_amount + fixed_fee) / (1 - rate))
  const divisor = Math.max(0.0001, 1 - rate);
  const totalAmount = Math.ceil((net + fixedFee) / divisor);
  const feeAmount = totalAmount - net;

  return {
    net_amount: net,
    fee_amount: feeAmount,
    total_amount: totalAmount,
    fee_bearer: 'client',
  };
}
