/**
 * =========================================================================
 * MODULE DE RATE LIMITING EN MÉMOIRE (PROTECTION ANTI-BRUTE FORCE / SPAM)
 * =========================================================================
 * Implémente un algorithme de fenêtre glissante (sliding window) pour limiter
 * le nombre de requêtes par adresse IP sur les endpoints publics sensibles
 * (soumission de transaction SMS, initialisation de paiement, envoi d'email).
 */

const rateLimitStore = new Map();

// Nettoyage régulier des entrées expirées toutes les 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, data] of rateLimitStore.entries()) {
      if (now > data.resetTime) {
        rateLimitStore.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

/**
 * Extrait l'adresse IP cliente depuis les en-têtes Next.js
 * @param {Request} request
 * @returns {string}
 */
export function getClientIp(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }
  return '127.0.0.1';
}

/**
 * Vérifie et applique la limite de requêtes pour une clé donnée (IP + route).
 *
 * @param {object} options
 * @param {string} options.key - Clé unique (ex: `manual-verify:${ip}`)
 * @param {number} options.limit - Nombre maximal de requêtes autorisées dans la fenêtre
 * @param {number} options.windowMs - Durée de la fenêtre en millisecondes
 * @returns {{ allowed: boolean, remaining: number, resetTime: number }}
 */
export function checkRateLimit({ key, limit = 10, windowMs = 60 * 1000 }) {
  const now = Date.now();
  let record = rateLimitStore.get(key);

  if (!record || now > record.resetTime) {
    record = {
      count: 1,
      resetTime: now + windowMs,
    };
    rateLimitStore.set(key, record);
    return {
      allowed: true,
      remaining: limit - 1,
      resetTime: record.resetTime,
    };
  }

  if (record.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: record.resetTime,
    };
  }

  record.count += 1;
  return {
    allowed: true,
    remaining: limit - record.count,
    resetTime: record.resetTime,
  };
}
