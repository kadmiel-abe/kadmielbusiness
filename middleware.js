import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';

export async function middleware(req) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  // Récupération de la session active de l'utilisateur
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Si l'URL demandée commence par /dashboard et qu'il n'y a pas de session,
  // rediriger immédiatement vers la page d'accueil (page de connexion)
  if (req.nextUrl.pathname.startsWith('/dashboard')) {
    if (!session) {
      const redirectUrl = req.nextUrl.clone();
      redirectUrl.pathname = '/';
      return NextResponse.redirect(redirectUrl);
    }
  }

  return res;
}

export const config = {
  matcher: ['/dashboard', '/dashboard/:path*'],
};
