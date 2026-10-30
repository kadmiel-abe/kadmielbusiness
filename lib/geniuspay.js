import crypto from 'crypto';

/**
 * =========================================================================
 * MODULE BACKEND GENIUSPAY (Côte d'Ivoire)
 * =========================================================================
 * Gère l'authentification sécurisée, l'initialisation des paiements pour
 * les opérateurs Mobile Money (Wave, Orange Money, MTN MoMo, Moov Money),
 * et la vérification cryptographique des webhooks avec protection anti-rejeu.
 *
 * NOTE DE SÉCURITÉ :
 * Ce module s'exécute exclusivement côté serveur (Node.js runtime).
 * Aucune clé secrète n'est exposée au client.
 */

export const GENIUSPAY_PROVIDERS = {
  WAVE: 'wave',
  ORANGE: 'orange',
  MTN: 'mtn',
  MOOV: 'moov',
};

export const DEFAULT_GENIUSPAY_API_URL =
  process.env.GENIUSPAY_BASE_URL || 'https://geniuspay.ci/api/v1/merchant/payments';

/**
 * Normalise l'identifiant du fournisseur / moyen de paiement.
 * @param {string} [provider]
 * @returns {string|null}
 */
export function normalizeProvider(provider) {
  if (!provider || typeof provider !== 'string') return null;
  const p = provider.trim().toLowerCase();

  if (p === 'wave' || p.includes('wave')) return GENIUSPAY_PROVIDERS.WAVE;
  if (p === 'orange' || p === 'om' || p.includes('orange')) return GENIUSPAY_PROVIDERS.ORANGE;
  if (p === 'mtn' || p === 'momo' || p.includes('mtn')) return GENIUSPAY_PROVIDERS.MTN;
  if (p === 'moov' || p === 'flooz' || p.includes('moov')) return GENIUSPAY_PROVIDERS.MOOV;

  return p;
}

/**
 * Récupère et valide les identifiants d'API GeniusPay configurés dans l'environnement.
 * @returns {{ apiKey: string, apiSecret: string, webhookSecret: string, baseUrl: string }}
 */
export function getGeniusPayCredentials() {
  const apiKey = process.env.GENIUSPAY_API_KEY;
  const apiSecret = process.env.GENIUSPAY_SECRET_KEY || process.env.GENIUSPAY_API_SECRET;
  const webhookSecret = process.env.GENIUSPAY_WEBHOOK_SECRET;
  const baseUrl = process.env.GENIUSPAY_BASE_URL || DEFAULT_GENIUSPAY_API_URL;

  if (!apiKey || !apiSecret) {
    const errorMsg =
      '[GeniusPay] Clés API manquantes : veuillez définir GENIUSPAY_API_KEY et GENIUSPAY_SECRET_KEY dans vos variables d\'environnement.';
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  return { apiKey, apiSecret, webhookSecret, baseUrl };
}

/**
 * Initialise une session de paiement auprès de la passerelle GeniusPay.
 * Compatible Wave, Orange Money, MTN MoMo et Moov Money en Côte d'Ivoire.
 *
 * @param {object} params
 * @param {string} params.paymentId - Identifiant unique du paiement dans Kadmiel Business Pay
 * @param {number} params.amount - Montant total à payer (arrondi en FCFA)
 * @param {string} [params.description] - Libellé de la prestation ou du plat
 * @param {object} [params.customer] - Informations client { name, phone, email, country }
 * @param {string} [params.provider] - 'wave' | 'orange' | 'mtn' | 'moov'
 * @param {string} params.successUrl - URL de redirection après confirmation
 * @param {string} params.errorUrl - URL de redirection en cas d'annulation ou échec
 * @param {object} [params.metadata] - Métadonnées personnalisées
 * @returns {Promise<{ checkoutUrl: string, reference: string, provider: string|null, raw: any }>}
 */
export async function initiateGeniusPayment({
  paymentId,
  amount,
  description = 'Paiement de prestation',
  customer = {},
  provider = null,
  successUrl,
  errorUrl,
  metadata = {},
}) {
  const { apiKey, apiSecret, baseUrl } = getGeniusPayCredentials();

  const totalAmount = Math.max(1, Math.round(Number(amount) || 0));
  const normalizedProvider = normalizeProvider(provider);

  // Construction du payload officiel GeniusPay
  const payload = {
    amount: totalAmount,
    currency: 'XOF', // Franc CFA UEMOA
    description: description || 'Paiement Kadmiel Business Pay',
    customer: {
      name: customer.name || 'Client',
      phone: customer.phone || '',
      email: customer.email || undefined,
      country: customer.country || 'CI',
    },
    // Spécification de l'opérateur si choisi (Wave, Orange, MTN, Moov)
    ...(normalizedProvider
      ? {
          channel: normalizedProvider,
          provider: normalizedProvider,
          payment_method: normalizedProvider,
        }
      : {}),
    success_url: successUrl,
    error_url: errorUrl,
    cancel_url: errorUrl,
    metadata: {
      payment_id: paymentId,
      provider: normalizedProvider || 'all',
      source: 'kadmiel_business_pay',
      ...metadata,
    },
  };

  console.info(`[GeniusPay] Initialisation paiement ${paymentId} (${totalAmount} XOF, opérateur: ${normalizedProvider || 'tous'})`);

  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-API-Key': apiKey,
      'X-API-Secret': apiSecret,
      'Authorization': `Bearer ${apiSecret}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || !data) {
    const errorDetails =
      data?.message || data?.error || data?.errors || `Erreur passerelle HTTP ${response.status}`;
    console.error('[GeniusPay] Échec initialisation :', {
      status: response.status,
      response: data,
    });
    throw new Error(`GeniusPay API: ${typeof errorDetails === 'object' ? JSON.stringify(errorDetails) : errorDetails}`);
  }

  // Extraction flexible pour supporter différents formats d'enveloppe GeniusPay
  const checkoutUrl =
    data.checkout_url ||
    data.data?.checkout_url ||
    data.payment_url ||
    data.data?.payment_url ||
    data.url ||
    data.data?.url;

  const reference =
    data.reference ||
    data.data?.reference ||
    data.transaction_id ||
    data.data?.transaction_id ||
    data.id ||
    data.data?.id;

  if (!checkoutUrl) {
    console.error('[GeniusPay] Aucune checkout_url dans la réponse :', data);
    throw new Error('L\'URL de paiement checkout_url est absente de la réponse de la passerelle.');
  }

  return {
    checkoutUrl,
    reference: reference || null,
    provider: normalizedProvider,
    raw: data,
  };
}

/**
 * Valide la signature cryptographique HMAC-SHA256 envoyée par GeniusPay.
 * Inclus une protection anti-rejeu (fenêtre de 5 minutes).
 *
 * @param {object} params
 * @param {string} params.rawBody - Corps brut (string non parsée) de la requête HTTP
 * @param {string} params.signature - Signature fournie dans les en-têtes
 * @param {string} params.secret - Secret webhook configuré
 * @param {string|number} [params.timestamp] - Horodatage fourni dans les en-têtes
 * @returns {boolean}
 */
export function verifyGeniusPaySignature({ rawBody, signature, secret, timestamp }) {
  if (!signature || !secret || !rawBody) {
    return false;
  }

  try {
    const cleanSignature = signature.trim().toLowerCase();

    // 1. Calcul standard HMAC-SHA256 sur le corps brut
    const hmacStandard = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex')
      .toLowerCase();

    const signatureBuffer = Buffer.from(cleanSignature, 'utf8');
    const hmacBuffer = Buffer.from(hmacStandard, 'utf8');

    if (
      signatureBuffer.length === hmacBuffer.length &&
      crypto.timingSafeEqual(signatureBuffer, hmacBuffer)
    ) {
      return true;
    }

    // 2. Variante horodatée : timestamp.rawBody
    if (timestamp) {
      // Vérification anti-rejeu : delta maximum 300 secondes (5 minutes)
      const now = Math.floor(Date.now() / 1000);
      const parsedTimestamp = parseInt(String(timestamp), 10);
      const eventTime =
        parsedTimestamp > 1e11 ? Math.floor(parsedTimestamp / 1000) : parsedTimestamp;

      if (!isNaN(eventTime) && Math.abs(now - eventTime) > 300) {
        console.warn('[GeniusPay] Timestamp de signature expiré (Replay Attack prévenue) :', {
          now,
          eventTime,
        });
        return false;
      }

      const hmacWithTimestamp = crypto
        .createHmac('sha256', secret)
        .update(`${timestamp}.${rawBody}`)
        .digest('hex')
        .toLowerCase();

      const hmacTimeBuffer = Buffer.from(hmacWithTimestamp, 'utf8');
      if (
        signatureBuffer.length === hmacTimeBuffer.length &&
        crypto.timingSafeEqual(signatureBuffer, hmacTimeBuffer)
      ) {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error('[GeniusPay] Erreur lors de la vérification de signature HMAC :', error);
    return false;
  }
}
