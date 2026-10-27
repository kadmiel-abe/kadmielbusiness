"use client";

import React, { useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import {
  ArrowLeft,
  ShieldCheck,
  Zap,
  Sparkles,
  User,
  Phone,
  Briefcase,
  Coins,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ArrowRight,
} from "lucide-react";

/* ─────────────────────────────────────────────────────────────
   HELPERS DE FORMATAGE
   ───────────────────────────────────────────────────────────── */

function formatAmount(amount) {
  if (amount == null || isNaN(amount) || amount <= 0) return "0 FCFA";
  return (
    new Intl.NumberFormat("fr-FR", {
      maximumFractionDigits: 0,
    }).format(amount) + " FCFA"
  );
}

/* ─────────────────────────────────────────────────────────────
   PAGE CRÉATION DE LIEN DE PAIEMENT SÉCURISÉ
   ───────────────────────────────────────────────────────────── */

export default function NewPaymentLinkPage() {
  const router = useRouter();
  const supabase = createClientComponentClient();

  // États du formulaire
  const [formData, setFormData] = useState({
    client_name: "",
    client_phone: "",
    service_name: "",
    amount_net: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Règle mathématique GeniusPay en temps réel :
  // Total = Math.ceil((Net + 100) / 0.99)
  // Frais = Total - Net
  const calculations = useMemo(() => {
    const net = parseFloat(formData.amount_net);
    if (!net || isNaN(net) || net <= 0) {
      return { net: 0, fees: 0, total: 0 };
    }
    const total = Math.ceil((net + 100) / 0.99);
    const fees = total - net;
    return { net, fees, total };
  }, [formData.amount_net]);

  // Raccourcis montants fréquents
  const setQuickAmount = (val) => {
    setFormData((prev) => ({ ...prev, amount_net: val.toString() }));
  };

  // Soumission du formulaire
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.client_name.trim()) {
      setError("Veuillez renseigner le nom du client.");
      return;
    }
    if (!formData.client_phone.trim()) {
      setError("Veuillez renseigner le numéro WhatsApp du client.");
      return;
    }
    if (!formData.service_name.trim()) {
      setError("Veuillez indiquer le nom de la prestation.");
      return;
    }
    if (calculations.net <= 0) {
      setError("Le montant net souhaité doit être supérieur à 0 FCFA.");
      return;
    }

    setLoading(true);
    const paymentId = crypto.randomUUID();

    try {
      // 1. Appel via l'API sécurisée pour garantir la création du client et du paiement
      // même avec les règles RLS activées
      const response = await fetch("/api/payments/create-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: paymentId,
          client_name: formData.client_name.trim(),
          client_phone: formData.client_phone.trim(),
          service_name: formData.service_name.trim(),
          amount_net: calculations.net,
          amount_total: calculations.total,
          status: "en_attente",
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            result.details ||
            "Échec de l'enregistrement du paiement."
        );
      }

      setSuccess(true);

      // Redirection fluide vers le dashboard
      setTimeout(() => {
        router.push("/dashboard");
      }, 1200);
    } catch (err) {
      console.error("[New Payment] Erreur :", err);
      setError(
        err.message ||
          "Une erreur est survenue lors de la création du lien de paiement. Veuillez réessayer."
      );
      setLoading(false);
    }
  };

  return (
    <div className="text-slate-900 font-sans py-2 selection:bg-slate-950 selection:text-white">
      {/* ═══ Effet d'ambiance vert/sombre inspiré du logo ═══ */}
      <div className="pointer-events-none fixed inset-0 flex items-center justify-center overflow-hidden">
        <div className="h-[420px] w-[420px] rounded-full bg-emerald-100/35 blur-3xl opacity-60" />
      </div>

      <div className="relative z-10 max-w-xl mx-auto space-y-6">
        {/* ═══ Navigation de retour ═══ */}
        <div className="flex items-center justify-between">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-950 transition-colors px-3 py-1.5 rounded-xl bg-white border border-slate-200/80 shadow-2xs group"
          >
            <ArrowLeft className="w-3.5 h-3.5 transition-transform duration-150 group-hover:-translate-x-0.5" />
            <span>Retour au Dashboard</span>
          </Link>

          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-semibold text-slate-500">
              Passerelle GeniusPay Active
            </span>
          </div>
        </div>

        {/* ═══ Carte Principale Formulaire ═══ */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-[0_10px_40px_-15px_rgba(0,0,0,0.06)] overflow-hidden transition-all duration-200">
          {/* Header de la carte */}
          <div className="px-6 sm:px-8 pt-8 pb-6 border-b border-slate-100 flex items-start gap-4">
            <div className="h-13 w-13 rounded-2xl overflow-hidden shadow-xs border border-slate-900/10 bg-black shrink-0 flex items-center justify-center">
              <Image
                src="/logo.png"
                alt="Logo Officiel"
                width={52}
                height={52}
                priority
                className="h-full w-full object-cover"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight">
                  Nouveau Lien de Paiement
                </h1>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Générez une facture sécurisée avec calcul automatique des frais.
              </p>
            </div>
          </div>

          {/* Corps du formulaire */}
          <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-5">
            {/* Alerte Erreur */}
            {error && (
              <div className="rounded-2xl bg-rose-50 border border-rose-200 p-4 flex items-start gap-3 text-xs text-rose-800 animate-slide-up">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Erreur de validation</p>
                  <p className="mt-0.5 text-rose-700">{error}</p>
                </div>
              </div>
            )}

            {/* Alerte Succès */}
            {success && (
              <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 flex items-start gap-3 text-xs text-emerald-800 animate-slide-up">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Lien généré avec succès !</p>
                  <p className="mt-0.5 text-emerald-700">
                    Redirection vers votre tableau de bord en cours…
                  </p>
                </div>
              </div>
            )}

            {/* Champ 1 : Nom du client */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-emerald-600" />
                <span>Nom du client</span>
                <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ex : Jean-Marc Koffi ou Société Ivoire Tech"
                value={formData.client_name}
                onChange={(e) =>
                  setFormData({ ...formData, client_name: e.target.value })
                }
                className="w-full h-11 px-3.5 text-xs sm:text-sm rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-150 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 font-medium"
              />
            </div>

            {/* Champ 2 : Numéro WhatsApp */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Numéro WhatsApp</span>
                  <span className="text-rose-500">*</span>
                </label>
                <span className="text-[10px] text-slate-400 font-medium">
                  Pour la relance en 1 clic
                </span>
              </div>
              <input
                type="tel"
                required
                placeholder="Ex : +225 07 08 09 10 11 ou 0708091011"
                value={formData.client_phone}
                onChange={(e) =>
                  setFormData({ ...formData, client_phone: e.target.value })
                }
                className="w-full h-11 px-3.5 text-xs sm:text-sm rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-150 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 font-medium font-mono"
              />
            </div>

            {/* Champ 3 : Nom de la prestation */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-emerald-600" />
                <span>Nom de la prestation</span>
                <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ex : Développement Site Web, Audit API, Branding..."
                value={formData.service_name}
                onChange={(e) =>
                  setFormData({ ...formData, service_name: e.target.value })
                }
                className="w-full h-11 px-3.5 text-xs sm:text-sm rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-150 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 font-medium"
              />
            </div>

            {/* Champ 4 : Montant Net Souhaité */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Coins className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Montant Net souhaité (ce que vous touchez)</span>
                  <span className="text-rose-500">*</span>
                </label>
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  Net garanti
                </span>
              </div>
              <div className="relative">
                <input
                  type="number"
                  min="100"
                  step="100"
                  required
                  placeholder="50000"
                  value={formData.amount_net}
                  onChange={(e) =>
                    setFormData({ ...formData, amount_net: e.target.value })
                  }
                  className="w-full h-12 pl-3.5 pr-16 text-sm sm:text-base rounded-xl border border-slate-200 bg-slate-50/50 text-slate-950 font-bold placeholder:text-slate-400 outline-none transition-all duration-150 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-extrabold text-slate-400 pointer-events-none">
                  FCFA
                </span>
              </div>

              {/* Raccourcis montants */}
              <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                <span className="text-[10px] text-slate-400 mr-1">Exemples :</span>
                {[25000, 50000, 100000, 250000, 500000].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setQuickAmount(val)}
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 transition-colors"
                  >
                    {new Intl.NumberFormat("fr-FR").format(val)} F
                  </button>
                ))}
              </div>
            </div>

            {/* ═══ Le Calculateur en temps réel (Très important) ═══ */}
            <div className="rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white p-5 border border-slate-800 shadow-md space-y-3.5">
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    Décomposition Financière
                  </span>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-full">
                  Frais = Total - Net
                </span>
              </div>

              <div className="space-y-2 text-xs">
                {/* Ligne 1 : Montant Net */}
                <div className="flex items-center justify-between text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Montant Net (versé sur votre compte)
                  </span>
                  <span className="font-semibold text-white">
                    {formatAmount(calculations.net)}
                  </span>
                </div>

                {/* Ligne 2 : Frais client */}
                <div className="flex items-center justify-between text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                    Frais client (passerelle GeniusPay)
                  </span>
                  <span className="font-semibold text-amber-400">
                    + {formatAmount(calculations.fees)}
                  </span>
                </div>

                {/* Ligne 3 : Total à payer */}
                <div className="pt-2.5 border-t border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-xs uppercase font-extrabold tracking-wider text-slate-200">
                      Total à payer par le client
                    </span>
                    <p className="text-[10px] text-slate-400">
                      Montant net garanti à 100% pour vous
                    </p>
                  </div>
                  <span className="text-lg sm:text-xl font-black text-emerald-400 tracking-tight">
                    {formatAmount(calculations.total)}
                  </span>
                </div>
              </div>
            </div>

            {/* ═══ Bouton d'Action Large (Couleurs de la marque) ═══ */}
            <button
              type="submit"
              disabled={loading || success}
              className="group relative w-full h-13 rounded-2xl bg-slate-950 text-white font-bold text-sm sm:text-[15px] transition-all duration-200 hover:bg-black hover:shadow-xl hover:shadow-emerald-950/20 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2.5 border border-slate-800 overflow-hidden"
            >
              {/* Reflet subtil vert marque au survol */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-500/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 pointer-events-none" />

              {loading ? (
                <>
                  <svg
                    className="animate-spin h-5 w-5 text-emerald-400"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span>Création du lien en cours…</span>
                </>
              ) : success ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span>Lien généré ! Redirection…</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-5 h-5 text-emerald-400 transition-transform duration-200 group-hover:scale-110" />
                  <span>Générer le lien sécurisé</span>
                  <ArrowRight className="w-4 h-4 text-slate-400 transition-transform duration-200 group-hover:translate-x-1" />
                </>
              )}
            </button>
          </form>

          {/* Footer de la carte */}
          <div className="bg-slate-50/70 border-t border-slate-100 px-6 sm:px-8 py-3.5 flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-emerald-600" />
              Génération instantanée
            </span>
            <span>Wave · Orange · MTN · Moov · Carte</span>
          </div>
        </div>

        {/* Note de bas de page */}
        <p className="text-center text-xs text-slate-400">
          Kadmiel Business Pay · Infrastructure de facturation sécurisée
        </p>
      </div>
    </div>
  );
}
