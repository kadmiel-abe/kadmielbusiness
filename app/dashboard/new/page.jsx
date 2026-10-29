"use client";

import React, { useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  Copy,
  Check,
  Share2,
  PlusCircle,
  LayoutDashboard,
  ArrowRight,
} from "lucide-react";

/* ─────────────────────────────────────────────────────────────
   HELPERS : FORMATAGE ET TÉLÉPHONE CI
   ───────────────────────────────────────────────────────────── */

function formatAmount(amount) {
  if (amount == null || isNaN(amount) || amount <= 0) return "0 FCFA";
  return (
    new Intl.NumberFormat("fr-FR", {
      maximumFractionDigits: 0,
    }).format(amount) + " FCFA"
  );
}

// Nettoie et normalise le numéro au format international Côte d'Ivoire (+225)
function normalizePhoneNumber(raw) {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  // Si le numéro commence déjà par 225
  if (digits.startsWith("225") && digits.length === 13) {
    return `+${digits}`;
  }
  // Si numéro local ivoirien à 10 chiffres (ex: 0701020304)
  if (digits.length === 10) {
    return `+225${digits}`;
  }
  return raw.trim();
}

/* ─────────────────────────────────────────────────────────────
   PAGE CRÉATION DE LIEN DE PAIEMENT
   ───────────────────────────────────────────────────────────── */

export default function NewPaymentLinkPage() {
  const router = useRouter();

  // États du formulaire
  const [formData, setFormData] = useState({
    client_name: "",
    client_phone: "",
    service_name: "",
    amount_net: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // État de succès & données du lien créé
  const [createdPayment, setCreatedPayment] = useState(null);
  const [copied, setCopied] = useState(false);

  // Règle mathématique des frais (supportés par le client) :
  // Total = Math.ceil((Net + 100) / 0.99)
  const calculations = useMemo(() => {
    const net = parseFloat(formData.amount_net);
    if (!net || isNaN(net) || net <= 0) {
      return { net: 0, fees: 0, total: 0 };
    }
    const total = Math.ceil((net + 100) / (1 - 0.01));
    const fees = total - net;
    return { net, fees, total };
  }, [formData.amount_net]);

  // Raccourcis montants fréquents
  const setQuickAmount = (val) => {
    setFormData((prev) => ({ ...prev, amount_net: val.toString() }));
  };

  // Réinitialiser le formulaire pour un nouveau lien
  const handleReset = () => {
    setFormData({
      client_name: "",
      client_phone: "",
      service_name: "",
      amount_net: "",
    });
    setCreatedPayment(null);
    setError(null);
    setCopied(false);
  };

  // Soumission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const clientName = formData.client_name.trim();
    const normalizedPhone = normalizePhoneNumber(formData.client_phone);
    const serviceName = formData.service_name.trim();

    // Validations
    if (!clientName) {
      setError("Veuillez renseigner le nom du client.");
      return;
    }
    if (!normalizedPhone) {
      setError("Veuillez renseigner un numéro WhatsApp valide.");
      return;
    }
    if (!serviceName) {
      setError("Veuillez indiquer la prestation réalisée.");
      return;
    }
    if (calculations.net <= 0) {
      setError("Le montant net souhaité doit être supérieur à 0 FCFA.");
      return;
    }

    setLoading(true);
    const paymentId = crypto.randomUUID();

    try {
      const response = await fetch("/api/payments/create-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: paymentId,
          client_name: clientName,
          client_phone: normalizedPhone,
          service_name: serviceName,
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

      // Base URL dynamique
      const baseUrl =
        typeof window !== "undefined"
          ? window.location.origin
          : "https://kadmielbusiness.vercel.app";

      const paymentUrl = `${baseUrl}/pay/${paymentId}`;

      setCreatedPayment({
        id: paymentId,
        url: paymentUrl,
        client_name: clientName,
        client_phone: normalizedPhone,
        service_name: serviceName,
        amount_net: calculations.net,
        amount_total: calculations.total,
      });
    } catch (err) {
      console.error("[New Payment] Erreur :", err);
      setError(
        err.message ||
          "Une erreur est survenue lors de la création du lien. Veuillez réessayer."
      );
    } finally {
      setLoading(false);
    }
  };

  // Copier le lien
  const handleCopyLink = () => {
    if (!createdPayment?.url) return;
    navigator.clipboard.writeText(createdPayment.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Partager via WhatsApp
  const handleShareWhatsApp = () => {
    if (!createdPayment) return;
    const cleanPhone = createdPayment.client_phone.replace(/\+/g, "");
    const message = `Bonjour ${createdPayment.client_name},\n\nVoici le lien sécurisé pour régler la prestation "${createdPayment.service_name}" :\n👉 ${createdPayment.url}\n\nMontant total : ${formatAmount(createdPayment.amount_total)}\nPaiement disponible par Wave, Orange Money, MTN ou Moov.\n\nMerci pour votre confiance !`;

    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(
      message
    )}`;
    window.open(waUrl, "_blank");
  };

  return (
    <div className="text-slate-900 font-sans py-2 selection:bg-slate-950 selection:text-white">
      {/* Effet d'ambiance vert marque */}
      <div className="pointer-events-none fixed inset-0 flex items-center justify-center overflow-hidden">
        <div className="h-[420px] w-[420px] rounded-full bg-emerald-100/35 blur-3xl opacity-60" />
      </div>

      <div className="relative z-10 max-w-xl mx-auto space-y-6">
        {/* Navigation retour */}
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

        {/* ═══ ÉCRAN 1 : LIEN CRÉÉ AVEC SUCCÈS ═══ */}
        {createdPayment ? (
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xl overflow-hidden animate-slide-up">
            <div className="p-6 sm:p-8 text-center space-y-4 border-b border-slate-100">
              <div className="h-14 w-14 rounded-2xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <h2 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight">
                  Lien de paiement prêt !
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  Facture générée pour{" "}
                  <span className="font-semibold text-slate-900">
                    {createdPayment.client_name}
                  </span>{" "}
                  ({createdPayment.service_name})
                </p>
              </div>

              {/* Récapitulatif montant */}
              <div className="inline-flex items-center gap-3 bg-slate-50 border border-slate-200/80 px-4 py-2 rounded-2xl">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Total client
                  </span>
                  <span className="text-base font-black text-slate-950">
                    {formatAmount(createdPayment.amount_total)}
                  </span>
                </div>
                <div className="h-6 w-px bg-slate-200" />
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Net pour vous
                  </span>
                  <span className="text-base font-black text-emerald-600">
                    {formatAmount(createdPayment.amount_net)}
                  </span>
                </div>
              </div>

              {/* Champ Lien avec bouton copie */}
              <div className="mt-4 flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-2 text-left">
                <input
                  type="text"
                  readOnly
                  value={createdPayment.url}
                  className="w-full bg-transparent text-xs font-mono text-slate-700 outline-none px-2"
                />
                <button
                  onClick={handleCopyLink}
                  className="shrink-0 h-9 px-3.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-xs font-bold text-slate-800 transition-colors flex items-center gap-1.5 shadow-2xs"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Copié !</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-600" />
                      <span>Copier</span>
                    </>
                  )}
                </button>
              </div>

              {/* Bouton Partager sur WhatsApp */}
              <button
                onClick={handleShareWhatsApp}
                className="w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
              >
                <Share2 className="w-4 h-4" />
                <span>Envoyer sur WhatsApp à {createdPayment.client_name}</span>
              </button>
            </div>

            {/* Actions secondaires */}
            <div className="bg-slate-50/70 p-4 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                onClick={handleReset}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 text-xs font-bold text-slate-700 hover:text-slate-950 px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                <PlusCircle className="w-3.5 h-3.5 text-emerald-600" />
                <span>Créer un autre lien</span>
              </button>

              <button
                onClick={() => router.push("/dashboard")}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 text-xs font-bold text-white bg-slate-900 hover:bg-black px-4 py-2.5 rounded-xl transition-colors"
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>Voir le tableau de bord</span>
              </button>
            </div>
          </div>
        ) : (
          /* ═══ ÉCRAN 2 : FORMULAIRE DE CRÉATION ═══ */
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-[0_10px_40px_-15px_rgba(0,0,0,0.06)] overflow-hidden transition-all duration-200">
            {/* Header */}
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
                <h1 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight">
                  Nouveau Lien de Paiement
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  Générez une facture sécurisée avec calcul automatique des
                  frais.
                </p>
              </div>
            </div>

            {/* Formulaire */}
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
                    <span>Numéro WhatsApp (Côte d'Ivoire)</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[10px] text-slate-400 font-medium">
                    Auto-format +225
                  </span>
                </div>
                <input
                  type="tel"
                  required
                  placeholder="Ex : 07 08 09 10 11 ou +225..."
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
                  placeholder="Ex : Développement Site Web, Audit, Community Management..."
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
                  <span className="text-[10px] text-slate-400 mr-1">
                    Exemples :
                  </span>
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

              {/* ═══ Calculateur en temps réel ═══ */}
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
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      Montant Net (versé sur votre compte)
                    </span>
                    <span className="font-semibold text-white">
                      {formatAmount(calculations.net)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                      Frais client (passerelle GeniusPay)
                    </span>
                    <span className="font-semibold text-amber-400">
                      + {formatAmount(calculations.fees)}
                    </span>
                  </div>

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

              {/* Bouton d'action */}
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full h-13 rounded-2xl bg-slate-950 text-white font-bold text-sm sm:text-[15px] transition-all duration-200 hover:bg-black hover:shadow-xl hover:shadow-emerald-950/20 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2.5 border border-slate-800 overflow-hidden"
              >
                {loading ? (
                  <>
                    <div className="animate-spin h-5 w-5 border-2 border-emerald-400 border-t-transparent rounded-full" />
                    <span>Création du lien en cours…</span>
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

            {/* Footer */}
            <div className="bg-slate-50/70 border-t border-slate-100 px-6 sm:px-8 py-3.5 flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-emerald-600" />
                Génération instantanée
              </span>
              <span>Wave · Orange · MTN · Moov</span>
            </div>
          </div>
        )}

        <p className="text-center text-xs text-slate-400">
          Kadmiel Business Pay · Infrastructure de facturation sécurisée
        </p>
      </div>
    </div>
  );
}
