import Link from 'next/link';
import { ArrowRight, ShieldCheck, Zap, Lock } from 'lucide-react';

export const metadata = {
  title: 'Kadmiel Business Pay — Infrastructure de paiement',
  description: 'Infrastructure de facturation et paiements sécurisés pour services professionnels.',
};

export default function HomePage() {
  return (
    <div className="relative min-h-screen flex flex-col justify-between bg-gradient-to-b from-slate-50 via-white to-slate-50 text-slate-900 font-sans selection:bg-slate-900 selection:text-white overflow-hidden">
      {/* ═══ Effet de fond subtil style Stripe / SaaS moderne ═══ */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
        <div className="h-[480px] w-[480px] rounded-full bg-gradient-to-tr from-slate-200/40 via-indigo-100/30 to-emerald-100/30 blur-3xl opacity-70" />
      </div>

      {/* ═══ Header discret ═══ */}
      <header className="relative z-10 w-full max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950 text-white font-black text-sm tracking-wider shadow-xs">
            K
          </div>
          <span className="font-bold text-sm tracking-tight text-slate-900">
            Kadmiel ABE
          </span>
        </div>

        <Link
          href="/dashboard"
          className="text-xs font-semibold text-slate-600 hover:text-slate-950 transition-colors flex items-center gap-1"
        >
          <span>Dashboard</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </header>

      {/* ═══ Section Centrale ═══ */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-2xl mx-auto text-center animate-slide-up">
          {/* Badge statut */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-slate-200/80 shadow-xs mb-8 text-xs font-medium text-slate-700">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span>Passerelle active · GeniusPay & Supabase</span>
          </div>

          {/* Grand Titre */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-slate-950 tracking-tight leading-[1.1]">
            Kadmiel Business Pay
          </h1>

          {/* Sous-titre gris */}
          <p className="mt-5 text-base sm:text-lg md:text-xl text-slate-500 max-w-lg mx-auto font-normal leading-relaxed">
            Infrastructure de facturation et paiements sécurisés
          </p>

          {/* Bouton d'action principal */}
          <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/dashboard"
              className="group relative inline-flex items-center justify-center gap-2.5 h-13 px-8 rounded-xl bg-slate-950 text-white font-semibold text-sm transition-all duration-200 hover:bg-black hover:shadow-xl hover:shadow-slate-950/15 active:scale-[0.98]"
            >
              <span>Accéder au Dashboard</span>
              <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
          </div>

          {/* Éléments de réassurance SaaS */}
          <div className="mt-14 pt-8 border-t border-slate-200/60 max-w-md mx-auto grid grid-cols-3 gap-4 text-center">
            <div className="flex flex-col items-center gap-1.5">
              <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
                <Lock className="w-3.5 h-3.5" />
              </div>
              <span className="text-[11px] font-semibold text-slate-700">HMAC SHA-256</span>
              <span className="text-[10px] text-slate-400">Signature certifiée</span>
            </div>

            <div className="flex flex-col items-center gap-1.5">
              <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
                <Zap className="w-3.5 h-3.5" />
              </div>
              <span className="text-[11px] font-semibold text-slate-700">Multi-canaux</span>
              <span className="text-[10px] text-slate-400">Wave, OM, MTN</span>
            </div>

            <div className="flex flex-col items-center gap-1.5">
              <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
                <ShieldCheck className="w-3.5 h-3.5" />
              </div>
              <span className="text-[11px] font-semibold text-slate-700">Idempotence</span>
              <span className="text-[10px] text-slate-400">Zéro double débit</span>
            </div>
          </div>
        </div>
      </main>

      {/* ═══ Footer discret ═══ */}
      <footer className="relative z-10 w-full max-w-6xl mx-auto px-6 py-6 text-center text-xs text-slate-400">
        <p>Kadmiel ABE · Services Professionnels & Solutions Digitales</p>
      </footer>
    </div>
  );
}
