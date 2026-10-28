"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Mail, Lock, Eye, EyeClosed, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  // 1. États React
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [focusedInput, setFocusedInput] = useState(null); // 'email' | 'password' | null
  const [error, setError] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);

  // 2. Routeur et Supabase
  const router = useRouter();
  const supabase = createClientComponentClient();

  // 3. Logique 3D & Framer Motion Hooks (Déclarés TOUS au sommet pour respecter les règles de React)
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const rotateX = useTransform(mouseY, [-0.5, 0.5], ["7deg", "-7deg"]);
  const rotateY = useTransform(mouseX, [-0.5, 0.5], ["-7deg", "7deg"]);
  const spotlightX = useTransform(mouseX, [-0.5, 0.5], ["0%", "100%"]);
  const spotlightY = useTransform(mouseY, [-0.5, 0.5], ["0%", "100%"]);

  const spotlightBackground = useTransform(
    [spotlightX, spotlightY],
    ([x, y]) =>
      `radial-gradient(400px circle at ${x} ${y}, rgba(255, 255, 255, 0.08), transparent 70%)`
  );

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    mouseX.set(x);
    mouseY.set(y);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  // 4. Vérification de session existante au montage
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

  // 5. Gestion de la soumission du formulaire
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) {
        setError("Identifiants incorrects");
        setIsLoading(false);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Identifiants incorrects");
      setIsLoading(false);
    }
  };

  // 6. Écran de chargement lors de la vérification de session
  if (checkingSession) {
    return (
      <div className="min-h-screen bg-[#030712] flex flex-col items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute w-96 h-96 rounded-full bg-brand-primary/60 blur-[130px] pointer-events-none" />
        <div className="relative z-10 flex flex-col items-center gap-4">
          <div className="relative h-16 w-16 rounded-2xl overflow-hidden border border-white/10 bg-black/80 p-1 shadow-2xl flex items-center justify-center animate-pulse">
            <Image
              src="/logo.png"
              alt="Kadmiel Business Pay Logo"
              width={60}
              height={60}
              priority
              className="h-full w-full object-contain"
            />
          </div>
          <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen w-full bg-[#030712] text-white flex items-center justify-center px-4 py-12 overflow-hidden selection:bg-white/20 selection:text-white">
      {/* 1. FOND : Grain subtil (Noise Texture) */}
      <div
        className="absolute inset-0 opacity-[0.035] pointer-events-none mix-blend-overlay z-[1]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* 2. FOND : Grille géométrique discrète */}
      <div className="absolute inset-0 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)] z-[1]" />

      {/* 3. FOND : Lueurs radiales (Radial Glows) */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 rounded-full bg-brand-primary/80 blur-[140px] pointer-events-none z-[1]" />
      <div className="absolute bottom-1/4 -right-32 w-[32rem] h-[32rem] rounded-full bg-brand-primary-light/40 blur-[160px] pointer-events-none z-[1]" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-72 bg-gradient-to-b from-brand-primary-light/20 via-brand-primary/10 to-transparent blur-[100px] pointer-events-none z-[1]" />

      {/* 4. CONTENEUR AVEC PERSPECTIVE 3D */}
      <div className="relative z-10 w-full max-w-[440px] [perspective:1000px]">
        {/* CARTE PRINCIPALE : Glassmorphism 3D */}
        <motion.div
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={{
            rotateX,
            rotateY,
            transformStyle: "preserve-3d",
          }}
          whileHover={{ scale: 1.02 }}
          transition={{
            type: "spring",
            stiffness: 260,
            damping: 20,
          }}
          className="group relative rounded-3xl p-[1px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9),0_0_50px_rgba(15,23,42,0.4)]"
        >
          {/* Faisceaux lumineux animés sur les bordures */}
          <div className="absolute -inset-[1px] rounded-3xl overflow-hidden pointer-events-none">
            <div
              className="absolute -inset-[150%] opacity-35 group-hover:opacity-100 transition-opacity duration-700 animate-[spin_6s_linear_infinite]"
              style={{
                background:
                  "conic-gradient(from 0deg at 50% 50%, transparent 0deg, transparent 60deg, rgba(255,255,255,0.7) 120deg, transparent 180deg, transparent 240deg, rgba(255,255,255,0.3) 300deg, transparent 360deg)",
              }}
            />
          </div>

          {/* Corps de la carte en verre dépoli (Glassmorphism) */}
          <div className="relative rounded-3xl bg-slate-950/70 backdrop-blur-2xl border border-white/10 px-8 py-10 sm:px-9 sm:py-11 overflow-hidden">
            {/* Lumière dynamique qui suit le curseur (Spotlight) */}
            <motion.div
              className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10"
              style={{ background: spotlightBackground }}
            />

            {/* En-tête : Logo, Titre & Sous-titre */}
            <div className="flex flex-col items-center text-center mb-8">
              <div className="relative mb-5 group/logo">
                <div className="absolute -inset-2 rounded-2xl bg-gradient-to-tr from-white/10 via-emerald-500/20 to-white/10 blur-md opacity-70 group-hover/logo:opacity-100 transition-opacity duration-300" />
                <div className="relative h-16 w-16 rounded-2xl overflow-hidden border border-white/15 bg-black/90 p-1 flex items-center justify-center shadow-xl backdrop-blur-md transition-transform duration-300 group-hover/logo:scale-105">
                  <Image
                    src="/logo.png"
                    alt="Kadmiel Business Pay Logo"
                    width={60}
                    height={60}
                    priority
                    className="h-full w-full object-contain"
                  />
                </div>
              </div>

              <h1 className="text-2xl sm:text-[26px] font-bold tracking-tight text-white mb-2">
                Kadmiel Business Pay
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 font-normal">
                Portail d&apos;administration sécurisé
              </p>
            </div>

            {/* Formulaire de connexion 100% privé */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Champ Email */}
              <div className="space-y-1.5">
                <label
                  htmlFor="email-input"
                  className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400"
                >
                  Adresse email
                </label>
                <div className="relative">
                  {focusedInput === "email" && (
                    <motion.div
                      layoutId="input-focus-highlight"
                      className="absolute -inset-[1.5px] rounded-xl bg-gradient-to-r from-white/40 via-white/80 to-white/40 -z-10 blur-[1px]"
                      transition={{ type: "spring", stiffness: 380, damping: 28 }}
                    />
                  )}
                  <div
                    className={cn(
                      "relative flex items-center rounded-xl bg-slate-900/80 border transition-all duration-200",
                      focusedInput === "email"
                        ? "border-white/40 bg-slate-900/95 shadow-[0_0_20px_rgba(255,255,255,0.06)]"
                        : "border-white/10 hover:border-white/20"
                    )}
                  >
                    <Mail
                      className={cn(
                        "w-4 h-4 ml-3.5 shrink-0 transition-colors duration-200",
                        focusedInput === "email" ? "text-white" : "text-slate-400"
                      )}
                    />
                    <input
                      id="email-input"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (error) setError("");
                      }}
                      onFocus={() => setFocusedInput("email")}
                      onBlur={() => setFocusedInput(null)}
                      placeholder="Adresse email"
                      className="w-full bg-transparent px-3 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Champ Mot de passe */}
              <div className="space-y-1.5 pt-1">
                <label
                  htmlFor="password-input"
                  className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400"
                >
                  Mot de passe
                </label>
                <div className="relative">
                  {focusedInput === "password" && (
                    <motion.div
                      layoutId="input-focus-highlight"
                      className="absolute -inset-[1.5px] rounded-xl bg-gradient-to-r from-white/40 via-white/80 to-white/40 -z-10 blur-[1px]"
                      transition={{ type: "spring", stiffness: 380, damping: 28 }}
                    />
                  )}
                  <div
                    className={cn(
                      "relative flex items-center rounded-xl bg-slate-900/80 border transition-all duration-200",
                      focusedInput === "password"
                        ? "border-white/40 bg-slate-900/95 shadow-[0_0_20px_rgba(255,255,255,0.06)]"
                        : "border-white/10 hover:border-white/20"
                    )}
                  >
                    <Lock
                      className={cn(
                        "w-4 h-4 ml-3.5 shrink-0 transition-colors duration-200",
                        focusedInput === "password" ? "text-white" : "text-slate-400"
                      )}
                    />
                    <input
                      id="password-input"
                      type={showPassword ? "text" : "password"}
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (error) setError("");
                      }}
                      onFocus={() => setFocusedInput("password")}
                      onBlur={() => setFocusedInput(null)}
                      placeholder="Mot de passe"
                      className="w-full bg-transparent px-3 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="mr-3.5 p-1 text-slate-400 hover:text-white transition-colors focus:outline-none"
                      tabIndex={-1}
                      aria-label={
                        showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"
                      }
                    >
                      {showPassword ? (
                        <EyeClosed className="w-4 h-4 transition-transform active:scale-90" />
                      ) : (
                        <Eye className="w-4 h-4 transition-transform active:scale-90" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Bouton de connexion */}
              <div className="pt-3">
                <motion.button
                  type="submit"
                  disabled={isLoading}
                  whileTap={!isLoading ? { scale: 0.985 } : {}}
                  className={cn(
                    "group relative w-full h-12 rounded-xl font-medium text-sm transition-all duration-300 flex items-center justify-center gap-2 overflow-hidden shadow-lg select-none",
                    "bg-white text-slate-950 hover:bg-slate-100 shadow-white/10 hover:shadow-white/20",
                    "disabled:opacity-60 disabled:cursor-not-allowed"
                  )}
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2.5">
                      <div className="w-4 h-4 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" />
                      <span className="font-semibold tracking-wide">Connexion en cours...</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2 font-semibold tracking-wide">
                      <span>Se connecter</span>
                      <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
                    </div>
                  )}
                </motion.button>
              </div>

              {/* Message d'erreur élégant sous le bouton */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.96 }}
                    transition={{ duration: 0.2 }}
                    role="alert"
                    className="rounded-xl bg-red-500/10 border border-red-500/25 p-3 text-xs sm:text-sm text-red-400 flex items-center justify-center gap-2 shadow-sm"
                  >
                    <div className="h-2 w-2 rounded-full bg-red-400 animate-pulse shrink-0" />
                    <span className="font-medium">{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </form>

            {/* Pied de carte sécurisé */}
            <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-center gap-2 text-[11px] text-slate-500 font-medium">
              <Lock className="w-3.5 h-3.5 text-slate-500" />
              <span>Accès réservé exclusivement aux administrateurs</span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
