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

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Impossible d'enregistrer le paiement.");
      }

      // Construction de l'URL absolue du paiement
      const origin =
        typeof window !== "undefined"
          ? window.location.origin
          : "https://kadmielbusiness.vercel.app";
      const paymentUrl = `${origin}/pay/${paymentId}`;

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
      console.error("Erreur lors de la création :", err);
      setError(err.message || "Erreur de connexion.");
    } finally {
      setLoading(false);
    }
  };

  // Copie dans le presse-papier
  const handleCopyLink = async () => {
    if (!createdPayment?.url) return;
    try {
      await navigator.clipboard.writeText(createdPayment.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Erreur copie :", err);
    }
  };

  // Envoi WhatsApp en 1 clic
  const handleShareWhatsApp = () => {
    if (!createdPayment) return;
    const cleanPhone = createdPayment.client_phone.replace(/[^\d]/g, "");
    const message = `Bonjour ${createdPayment.client_name},\n\nVoici votre lien de paiement sécurisé pour la prestation "${createdPayment.service_name}" :\n👉 ${createdPayment.url}\n\nMontant total : ${formatAmount(createdPayment.amount_total)}\nRèglement possible par Wave, Orange Money, MTN MoMo ou Moov Money.\n\nMerci pour votre confiance !`;
    window.open(
      `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  return (
    <div className="py-4 sm:py-8 flex flex-col items-center justify-center relative">
      {/* Halo lumineux d'ambiance émeraude */}
      <div className="pointer-events-none fixed inset-0 flex items-center justify-center overflow-hidden">
        <div className="h-[460px] w-[460px] rounded-full bg-emerald-500/10 blur-3xl" />
      </div>

      <div className="relative z-10 max-w-xl w-full space-y-6">
        {/* Navigation retour & Statut */}
        <div className="flex items-center justify-between">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-white transition-colors px-3 py-1.5 rounded-xl bg-zinc-900 border border-white/10 shadow-sm group hover:border-emerald-500/30"
          >
            <ArrowLeft className="w-3.5 h-3.5 transition-transform duration-150 group-hover:-translate-x-0.5" />
            <span>Retour au Dashboard</span>
          </Link>

          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] font-semibold text-emerald-400">
              Passerelle GeniusPay Active
            </span>
          </div>
        </div>

        {/* ═══ ÉCRAN 1 : LIEN CRÉÉ AVEC SUCCÈS ═══ */}
        {createdPayment ? (
          <div className="bg-zinc-900/90 backdrop-blur-xl rounded-3xl border border-emerald-500/20 shadow-2xl overflow-hidden animate-slide-up">
            <div className="p-6 sm:p-8 text-center space-y-4 border-b border-white/5">
              <div className="h-14 w-14 rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 mx-auto flex items-center justify-center shadow-lg shadow-emerald-500/10">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Lien de paiement prêt !
                </h2>
                <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                  Facture générée pour{" "}
                  <span className="font-semibold text-white">
                    {createdPayment.client_name}
                  </span>{" "}
                  ({createdPayment.service_name})
                </p>
              </div>

              {/* Récapitulatif montant */}
              <div className="inline-flex items-center gap-4 bg-black/60 border border-white/10 px-5 py-2.5 rounded-2xl">
                <div>
                  <span className="text-[10px] uppercase font-bold text-zinc-400 block">
                    Total client
                  </span>
                  <span className="text-base font-black text-white">
                    {formatAmount(createdPayment.amount_total)}
                  </span>
                </div>
                <div className="h-6 w-px bg-white/10" />
                <div>
                  <span className="text-[10px] uppercase font-bold text-zinc-400 block">
                    Net pour vous
                  </span>
                  <span className="text-base font-black text-emerald-400">
                    {formatAmount(createdPayment.amount_net)}
                  </span>
                </div>
              </div>

              {/* Champ Lien avec bouton copie */}
              <div className="mt-4 flex items-center gap-2 bg-zinc-950 border border-white/10 rounded-xl p-2 text-left">
                <input
                  type="text"
                  readOnly
                  value={createdPayment.url}
                  className="w-full bg-transparent text-xs font-mono text-zinc-300 outline-none px-2"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="shrink-0 h-9 px-3.5 rounded-lg bg-white/10 hover:bg-emerald-500 hover:text-black border border-white/10 text-xs font-bold text-zinc-200 transition-all flex items-center gap-1.5"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copié !</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copier</span>
                    </>
                  )}
                </button>
              </div>

              {/* Bouton Partager sur WhatsApp */}
              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
              >
                <Share2 className="w-4 h-4" />
                <span>Envoyer sur WhatsApp à {createdPayment.client_name}</span>
              </button>
            </div>

            {/* Actions secondaires */}
            <div className="bg-black/40 p-4 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleReset}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 text-xs font-bold text-zinc-300 hover:text-white px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 transition-colors"
              >
                <PlusCircle className="w-3.5 h-3.5 text-emerald-400" />
                <span>Créer un autre lien</span>
              </button>

              <button
                type="button"
                onClick={() => router.push("/dashboard")}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 text-xs font-bold text-white bg-emerald-500/20 border border-emerald-500/30 hover:bg-emerald-500/30 px-4 py-2.5 rounded-xl transition-colors"
              >
                <LayoutDashboard className="w-3.5 h-3.5 text-emerald-400" />
                <span>Voir le tableau de bord</span>
              </button>
            </div>
          </div>
        ) : (
          /* ═══ ÉCRAN 2 : FORMULAIRE DE CRÉATION ═══ */
          <div className="bg-zinc-900/90 backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl overflow-hidden transition-all duration-200">
            {/* Header avec Logo Kadmiel officiel */}
            <div className="px-6 sm:px-8 pt-8 pb-6 border-b border-white/5 flex items-start gap-4">
              <div className="h-12 w-12 rounded-xl overflow-hidden shadow-md border border-emerald-500/30 bg-black shrink-0 flex items-center justify-center">
                <Image
                  src="/logo.png"
                  alt="Logo Officiel"
                  width={48}
                  height={48}
                  priority
                  className="h-full w-full object-cover"
                />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Nouveau Lien de Paiement
                </h1>
                <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                  Générez une facture sécurisée avec calcul automatique des
                  frais.
                </p>
              </div>
            </div>

            {/* Formulaire */}
            <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-5">
              {/* Alerte Erreur */}
              {error && (
                <div className="rounded-2xl bg-rose-500/10 border border-rose-500/20 p-4 flex items-start gap-3 text-xs text-rose-300 animate-slide-up">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Erreur de validation</p>
                    <p className="mt-0.5 text-rose-300">{error}</p>
                  </div>
                </div>
              )}

              {/* Champ 1 : Nom du client */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Nom du client</span>
                  <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex : Jean-Marc Koffi ou Société Ivoire Tech"
                  value={formData.client_name}
                  onChange={(e) =>
                    setFormData({ ...formData, client_name: e.target.value })
                  }
                  className="w-full h-11 px-3.5 text-xs sm:text-sm rounded-xl border border-white/10 bg-zinc-950 text-white placeholder:text-zinc-500 outline-none transition-all duration-150 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 font-medium"
                />
              </div>

              {/* Champ 2 : Numéro WhatsApp */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Numéro WhatsApp (Côte d'Ivoire)</span>
                    <span className="text-rose-400">*</span>
                  </label>
                  <span className="text-[10px] text-zinc-400 font-medium">
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
                  className="w-full h-11 px-3.5 text-xs sm:text-sm rounded-xl border border-white/10 bg-zinc-950 text-white placeholder:text-zinc-500 outline-none transition-all duration-150 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 font-medium font-mono"
                />
              </div>

              {/* Champ 3 : Nom de la prestation */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Nom de la prestation</span>
                  <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex : Développement Site Web, Audit, Community Management..."
                  value={formData.service_name}
                  onChange={(e) =>
                    setFormData({ ...formData, service_name: e.target.value })
                  }
                  className="w-full h-11 px-3.5 text-xs sm:text-sm rounded-xl border border-white/10 bg-zinc-950 text-white placeholder:text-zinc-500 outline-none transition-all duration-150 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 font-medium"
                />
              </div>

              {/* Champ 4 : Montant Net Souhaité */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                    <Coins className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Montant Net souhaité (ce que vous touchez)</span>
                    <span className="text-rose-400">*</span>
                  </label>
                  <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/30">
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
                    className="w-full h-12 pl-3.5 pr-16 text-sm sm:text-base rounded-xl border border-white/10 bg-zinc-950 text-white font-bold placeholder:text-zinc-500 outline-none transition-all duration-150 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-extrabold text-zinc-400 pointer-events-none">
                    FCFA
                  </span>
                </div>

                {/* Raccourcis montants */}
                <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                  <span className="text-[10px] text-zinc-400 mr-1">
                    Exemples :
                  </span>
                  {[25000, 50000, 100000, 250000, 500000].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setQuickAmount(val)}
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-lg border border-white/10 bg-zinc-950 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors"
                    >
                      {new Intl.NumberFormat("fr-FR").format(val)} F
                    </button>
                  ))}
                </div>
              </div>

              {/* ═══ Calculateur en temps réel ═══ */}
              <div className="rounded-2xl bg-black/60 text-white p-5 border border-emerald-500/20 shadow-md space-y-3.5">
                <div className="flex items-center justify-between pb-2.5 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-200">
                      Décomposition Financière
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-full">
                    Frais = Total - Net
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between text-zinc-300">
                    <span className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      Montant Net (versé sur votre compte)
                    </span>
                    <span className="font-semibold text-white">
                      {formatAmount(calculations.net)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-zinc-300">
                    <span className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                      Frais client (passerelle GeniusPay)
                    </span>
                    <span className="font-semibold text-amber-400">
                      + {formatAmount(calculations.fees)}
                    </span>
                  </div>

                  <div className="pt-2.5 border-t border-white/10 flex items-center justify-between">
                    <div>
                      <span className="text-xs uppercase font-extrabold tracking-wider text-zinc-200">
                        Total à payer par le client
                      </span>
                      <p className="text-[10px] text-zinc-400">
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
                className="group relative w-full h-13 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm sm:text-[15px] transition-all duration-200 hover:shadow-xl hover:shadow-emerald-500/20 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2.5 border border-emerald-500/40 overflow-hidden"
              >
                {loading ? (
                  <>
                    <div className="animate-spin h-5 w-5 border-2 border-slate-950 border-t-transparent rounded-full" />
                    <span>Création du lien en cours…</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-5 h-5 text-slate-950 transition-transform duration-200 group-hover:scale-110" />
                    <span>Générer le lien sécurisé</span>
                    <ArrowRight className="w-4 h-4 text-slate-950 transition-transform duration-200 group-hover:translate-x-1" />
                  </>
                )}
              </button>
            </form>

            {/* Footer */}
            <div className="bg-black/60 border-t border-white/5 px-6 sm:px-8 py-3.5 flex items-center justify-between text-[11px] text-zinc-400">
              <span className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-emerald-400" />
                Génération instantanée
              </span>
              <span>Wave · Orange · MTN · Moov</span>
            </div>
          </div>
        )}

        <p className="text-center text-xs text-zinc-500">
          Kadmiel Business Pay · Infrastructure de facturation sécurisée
        </p>
      </div>
    </div>
  );
}
