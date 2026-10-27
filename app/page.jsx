"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Lock, AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const router = useRouter();
  const supabase = createClientComponentClient();

  // Vérification initiale : vérifie si une session existe déjà au montage de la page
  useEffect(() => {
    async function checkExistingSession() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session) {
          router.push("/dashboard");
          return;
        }
      } catch (err) {
        console.error("Erreur lors de la vérification de session :", err);
      } finally {
        setCheckingSession(false);
      }
    }

    checkExistingSession();
  }, [router, supabase]);

  // Traitement du formulaire de connexion
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) {
        setError("Identifiants incorrects");
        setLoading(false);
        return;
      }

      // En cas de succès : redirection vers le dashboard et rafraîchissement
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Identifiants incorrects");
      setLoading(false);
    }
  };

  // Écran d'attente fluide pendant la vérification initiale de session
  if (checkingSession) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="h-16 w-16 rounded-2xl overflow-hidden shadow-sm border border-slate-200/80 bg-black flex items-center justify-center mb-4 animate-pulse">
          <Image
            src="/logo.png"
            alt="Kadmiel Business Pay Logo"
            width={64}
            height={64}
            priority
            className="h-full w-full object-cover"
          />
        </div>
        <div className="h-5 w-5 border-2 border-slate-300 border-t-brand-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center px-4 sm:px-6 py-12">
      {/* Carte centrale d'authentification */}
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full border border-gray-100">
        {/* Branding : Logo officiel */}
        <div className="flex justify-center mb-6">
          <div className="h-16 w-16 rounded-2xl overflow-hidden shadow-sm border border-slate-200/80 bg-black flex items-center justify-center">
            <Image
              src="/logo.png"
              alt="Kadmiel Business Logo"
              width={64}
              height={64}
              priority
              className="h-full w-full object-cover"
            />
          </div>
        </div>

        {/* Textes d'accueil */}
        <h1 className="text-2xl font-bold text-center text-slate-900 tracking-tight">
          Kadmiel Business Pay
        </h1>
        <p className="text-sm text-center text-slate-500 mt-1 mb-6">
          Portail d&apos;administration sécurisé
        </p>

        {/* Message d'erreur */}
        {error && (
          <div
            role="alert"
            className="mb-6 rounded-lg bg-red-50 border border-red-200 p-3.5 text-sm text-red-600 flex items-center gap-2.5 animate-fade-in"
          >
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        {/* Formulaire de connexion */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Champ Email */}
          <div>
            <label
              htmlFor="email"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2"
            >
              Adresse Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError("");
              }}
              placeholder="admin@kadmielbusiness.com"
              className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white rounded-lg border border-slate-200 focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 transition-all placeholder:text-slate-400"
            />
          </div>

          {/* Champ Mot de passe */}
          <div>
            <label
              htmlFor="password"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2"
            >
              Mot de passe
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError("");
                }}
                placeholder="••••••••••••"
                className="w-full px-3.5 py-2.5 pr-10 text-sm text-slate-900 bg-white rounded-lg border border-slate-200 focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 transition-all placeholder:text-slate-400"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                tabIndex={-1}
                aria-label={
                  showPassword
                    ? "Masquer le mot de passe"
                    : "Afficher le mot de passe"
                }
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Bouton Se connecter */}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 flex items-center justify-center gap-2 rounded-lg bg-brand-primary text-white font-medium text-sm transition-all duration-200 hover:bg-brand-primary-hover hover:shadow-md active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Connexion en cours...</span>
              </>
            ) : (
              <span>Se connecter</span>
            )}
          </button>
        </form>

        {/* Pied de carte sécurisé */}
        <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-center gap-2 text-xs text-slate-400">
          <Lock className="w-3.5 h-3.5 text-slate-400" />
          <span>Accès réservé exclusivement aux administrateurs</span>
        </div>
      </div>
    </div>
  );
}
