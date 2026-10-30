import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';

/**
 * Middleware global de sécurité :
 * 1. Protection des pages d'administration (/dashboard, /clients, /settings) -> redirection /
 * 2. Protection des routes API d'administration (/api/analytics, /api/clients, /api/settings) -> HTTP 401
 * 3. Injection d'en-têtes HTTP de sécurité stricts (OWASP)
 */
export async function middleware(req) {
  const res = NextResponse.next();

  // En-têtes HTTP de sécurité défensifs
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'SAMEORIGIN');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('X-XSS-Protection', '1; mode=block');

  const supabase = createMiddlewareClient({ req, res });

  // Récupération de la session active de l'utilisateur
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const pathname = req.nextUrl.pathname;

  // A. Protection des routes API d'administration
  if (
    pathname.startsWith('/api/analytics') ||
    pathname.startsWith('/api/clients') ||
    pathname.startsWith('/api/settings')
  ) {
    if (!session) {
      return NextResponse.json(
        { error: 'Accès non autorisé. Session administrateur requise.' },
        { status: 401 }
      );
    }
  }

  // B. Protection des écrans front-end d'administration
  if (
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/clients') ||
    pathname.startsWith('/settings') ||
    pathname.startsWith('/analytics')
  ) {
    if (!session) {
      const redirectUrl = req.nextUrl.clone();
      redirectUrl.pathname = '/';
      return NextResponse.redirect(redirectUrl);
    }
  }

  return res;
}

export const config = {
  matcher: [
    '/dashboard',
    '/dashboard/:path*',
    '/clients',
    '/clients/:path*',
    '/settings',
    '/settings/:path*',
    '/analytics',
    '/analytics/:path*',
    '/api/analytics',
    '/api/analytics/:path*',
    '/api/clients',
    '/api/clients/:path*',
    '/api/settings',
    '/api/settings/:path*',
  ],
};
