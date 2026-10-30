"use client";

import React, { useState, useMemo, useEffect } from "react";
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
  Clock,
  Repeat,
  Calendar,
  Layers,
  BadgePercent,
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

  // États du formulaire & sélection d'activité (Freelance / Restaurant)
  const [businessType, setBusinessType] = useState("freelance"); // 'freelance' | 'restaurant'
  const [clientMode, setClientMode] = useState("quick"); // 'quick' (ajout rapide) | 'select' (client existant)
  const [clientsList, setClientsList] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState("");

  const [formData, setFormData] = useState({
    client_name: "",
    client_phone: "",
    service_name: "",
    amount_net: "",
  });

  // États de validité, d'usage et de répartition des frais
  const [validityPreset, setValidityPreset] = useState("7d"); // '24h' | '48h' | '7d' | '30d' | 'custom' | 'never'
  const [customExpiresAt, setCustomExpiresAt] = useState("");
  const [isSingleUse, setIsSingleUse] = useState(true);
  const [maxUses, setMaxUses] = useState("2");
  const [feeBearer, setFeeBearer] = useState("client"); // 'client' | 'freelance'

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // État de succès & données du lien créé
  const [createdPayment, setCreatedPayment] = useState(null);
  const [copied, setCopied] = useState(false);

  // Chargement des clients existants pour la sélection rapide
  useEffect(() => {
    async function loadClients() {
      try {
        const res = await fetch("/api/clients");
        const json = await res.json();
        if (json?.success && Array.isArray(json.clients)) {
          setClientsList(json.clients);
        }
      } catch (err) {
        console.warn("Échec chargement liste clients :", err);
      }
    }
    loadClients();
  }, []);

  // Pré-remplissage automatique si redirigé depuis la fiche client CRM ou réglages par défaut
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      // 1. Charger la préférence de répartition des frais par défaut configurée dans les Réglages
      const savedFeeBearer = localStorage.getItem("kadmiel_default_fee_bearer");
      if (savedFeeBearer === "client" || savedFeeBearer === "freelance") {
        setFeeBearer(savedFeeBearer);
      }

      // 2. Paramètres d'URL depuis la fiche client ou activité
      const params = new URLSearchParams(window.location.search);
      const name = params.get("client_name") || params.get("name");
      const phone = params.get("client_phone") || params.get("phone");
      const service = params.get("service_name") || params.get("service");
      const activity = params.get("business_type") || params.get("type");

      if (activity === "restaurant" || activity === "freelance") {
        setBusinessType(activity);
      }

      if (name || phone || service) {
        setFormData((prev) => ({
          ...prev,
          client_name: name ? decodeURIComponent(name) : prev.client_name,
          client_phone: phone ? decodeURIComponent(phone) : prev.client_phone,
          service_name: service ? decodeURIComponent(service) : prev.service_name,
        }));
      }
    } catch (e) {
      console.warn("Erreur lecture query params / réglages :", e);
    }
  }, []);

  const handleSelectClient = (clientId) => {
    setSelectedClientId(clientId);
    if (!clientId) return;
    const client = clientsList.find((c) => c.id === clientId);
    if (client) {
      setFormData((prev) => ({
        ...prev,
        client_name: client.name || client.nom || "",
        client_phone: client.phone || client.telephone || "",
      }));
    }
  };

  // Calcul dynamique de la date d'expiration
  const calculatedExpiresAt = useMemo(() => {
    const now = Date.now();
    if (validityPreset === "24h") {
      return new Date(now + 24 * 3600 * 1000);
    }
    if (validityPreset === "48h") {
      return new Date(now + 48 * 3600 * 1000);
    }
    if (validityPreset === "7d") {
      return new Date(now + 7 * 24 * 3600 * 1000);
    }
    if (validityPreset === "30d") {
      return new Date(now + 30 * 24 * 3600 * 1000);
    }
    if (validityPreset === "custom" && customExpiresAt) {
      const d = new Date(customExpiresAt);
      return isNaN(d.getTime()) ? null : d;
    }
    return null; // 'never' ou personnalisé non renseigné
  }, [validityPreset, customExpiresAt]);

  // Règle mathématique des frais selon le choix du porteur (Client ou Freelance) :
  // fee_rate = 0.01 (1%), fee_fixed = 100 FCFA
  const calculations = useMemo(() => {
    const rawVal = parseFloat(formData.amount_net);
    if (!rawVal || isNaN(rawVal) || rawVal <= 0) {
      return { net: 0, fees: 0, total: 0, requested: 0 };
    }

    if (feeBearer === "client") {
      // 1. Frais à la charge du client :
      // Le freelance reçoit exactement le montant net saisi (ex: 50 000 FCFA).
      // Total payé par le client = ceil((net + 100) / 0.99)
      const total = Math.ceil((rawVal + 100) / (1 - 0.01));
      const fees = total - rawVal;
      return { net: rawVal, fees, total, requested: rawVal };
    } else {
      // 2. Frais à la charge du freelance :
      // Le client ne paie que le prix net affiché de la prestation (ex: 50 000 FCFA).
      // Les frais de transaction sont prélevés sur la part du freelance.
      const total = rawVal;
      const fees = Math.ceil(total * 0.01 + 100);
      const net = Math.max(0, total - fees);
      return { net, fees, total, requested: rawVal };
    }
  }, [formData.amount_net, feeBearer]);

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
    setValidityPreset("7d");
    setCustomExpiresAt("");
    setIsSingleUse(true);
    setMaxUses("2");
    setFeeBearer("client");
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
      setError("Le montant doit être supérieur à 0 FCFA.");
      return;
    }

    setLoading(true);
    const paymentId = crypto.randomUUID();
    const computedExpiresAt = calculatedExpiresAt ? calculatedExpiresAt.toISOString() : null;
    const computedMaxUses = isSingleUse ? 1 : Math.max(1, parseInt(maxUses, 10) || 1);

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
          fee_bearer: feeBearer,
          business_type: businessType,
          expires_at: computedExpiresAt,
          is_single_use: isSingleUse,
          max_uses: computedMaxUses,
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
        business_type: businessType,
        amount_net: calculations.net,
        amount_total: calculations.total,
        fee_bearer: feeBearer,
        fees: calculations.fees,
        expires_at: computedExpiresAt,
        is_single_use: isSingleUse,
        max_uses: computedMaxUses,
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
    let expiryText = "";
    if (createdPayment.expires_at) {
      try {
        const d = new Date(createdPayment.expires_at);
        const formatted = d.toLocaleDateString("fr-FR", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
        expiryText = `\n⏳ Date limite de validité : ${formatted}`;
      } catch {}
    }
    const feeText =
      createdPayment.fee_bearer === "freelance"
        ? "\n🎁 Frais de transaction offerts par le prestataire."
        : "";
    const message = `Bonjour ${createdPayment.client_name},\n\nVoici votre lien de paiement sécurisé pour la prestation "${createdPayment.service_name}" :\n👉 ${createdPayment.url}\n\nMontant total : ${formatAmount(createdPayment.amount_total)}${feeText}${expiryText}\nRèglement possible par Wave, Orange Money, MTN MoMo ou Moov Money.\n\nMerci pour votre confiance !`;
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

              {/* Badges Validité, Type d'usage & Répartition des frais */}
              <div className="flex items-center justify-center gap-2 flex-wrap pt-1">
                {/* Badge Répartition des frais */}
                {createdPayment.fee_bearer === "freelance" ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    <BadgePercent className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Frais offerts au client (déduits de votre net)</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                    <BadgePercent className="w-3.5 h-3.5 text-amber-400" />
                    <span>Frais supportés par le client (+1% + 100 F)</span>
                  </span>
                )}

                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Clock className="w-3.5 h-3.5 text-emerald-400" />
                  {createdPayment.expires_at ? (
                    <span>
                      Expire le{" "}
                      {new Date(createdPayment.expires_at).toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  ) : (
                    <span>Validité illimitée</span>
                  )}
                </span>

                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-zinc-800 text-zinc-300 border border-zinc-700">
                  <Repeat className="w-3.5 h-3.5 text-zinc-400" />
                  {createdPayment.is_single_use ? (
                    <span>Usage unique (1 paiement max)</span>
                  ) : (
                    <span>Multi-usage ({createdPayment.max_uses} utilisations max)</span>
                  )}
                </span>
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
            <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
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

              {/* ═══ 1. CHOIX DU TYPE D'ACTIVITÉ (FREELANCE / RESTAURANT) ═══ */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-200 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Type d'activité</span>
                  </span>
                  <span className="text-[10px] text-zinc-400 font-mono">
                    {businessType === "restaurant" ? "Mode Restauration" : "Mode Prestations"}
                  </span>
                </label>

                <div className="grid grid-cols-2 gap-2.5">
                  {/* Bouton Freelance */}
                  <button
                    type="button"
                    onClick={() => setBusinessType("freelance")}
                    className={`p-3 sm:p-3.5 rounded-2xl border text-left transition-all active:scale-[0.98] ${
                      businessType === "freelance"
                        ? "bg-emerald-500/15 border-emerald-500 text-white shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/30"
                        : "bg-zinc-950 border-white/10 text-zinc-400 hover:text-zinc-200 hover:border-white/20"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">💼</span>
                        <div>
                          <p className="text-xs font-bold text-white">Freelance</p>
                          <p className="text-[10px] text-zinc-400">Services & missions</p>
                        </div>
                      </div>
                      <span
                        className={`h-4 w-4 rounded-full border flex items-center justify-center shrink-0 ${
                          businessType === "freelance"
                            ? "border-emerald-400 bg-emerald-400"
                            : "border-zinc-700"
                        }`}
                      >
                        {businessType === "freelance" && (
                          <span className="h-1.5 w-1.5 rounded-full bg-black" />
                        )}
                      </span>
                    </div>
                  </button>

                  {/* Bouton Restaurant */}
                  <button
                    type="button"
                    onClick={() => setBusinessType("restaurant")}
                    className={`p-3 sm:p-3.5 rounded-2xl border text-left transition-all active:scale-[0.98] ${
                      businessType === "restaurant"
                        ? "bg-amber-500/15 border-amber-500 text-white shadow-lg shadow-amber-500/10 ring-1 ring-amber-500/30"
                        : "bg-zinc-950 border-white/10 text-zinc-400 hover:text-zinc-200 hover:border-white/20"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">🍽️</span>
                        <div>
                          <p className="text-xs font-bold text-white">Restaurant</p>
                          <p className="text-[10px] text-zinc-400">Plats & commandes</p>
                        </div>
                      </div>
                      <span
                        className={`h-4 w-4 rounded-full border flex items-center justify-center shrink-0 ${
                          businessType === "restaurant"
                            ? "border-amber-400 bg-amber-400"
                            : "border-zinc-700"
                        }`}
                      >
                        {businessType === "restaurant" && (
                          <span className="h-1.5 w-1.5 rounded-full bg-black" />
                        )}
                      </span>
                    </div>
                  </button>
                </div>
              </div>

              {/* ═══ 2. SÉLECTION DU CLIENT (OU AJOUT RAPIDE) ═══ */}
              <div className="space-y-2.5 pt-2 border-t border-white/5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Client destinataire</span>
                    <span className="text-rose-400">*</span>
                  </label>

                  {/* Bascule Sélection client vs Ajout rapide */}
                  {clientsList.length > 0 && (
                    <div className="inline-flex items-center gap-1 bg-zinc-900 border border-white/10 p-0.5 rounded-lg text-[10px]">
                      <button
                        type="button"
                        onClick={() => setClientMode("quick")}
                        className={`px-2 py-0.5 rounded-md font-semibold transition ${
                          clientMode === "quick"
                            ? "bg-emerald-500 text-black shadow-sm"
                            : "text-zinc-400 hover:text-white"
                        }`}
                      >
                        Saisie rapide
                      </button>
                      <button
                        type="button"
                        onClick={() => setClientMode("select")}
                        className={`px-2 py-0.5 rounded-md font-semibold transition ${
                          clientMode === "select"
                            ? "bg-emerald-500 text-black shadow-sm"
                            : "text-zinc-400 hover:text-white"
                        }`}
                      >
                        Choisir existant ({clientsList.length})
                      </button>
                    </div>
                  )}
                </div>

                {/* Si mode sélection dans la liste existante */}
                {clientMode === "select" && clientsList.length > 0 ? (
                  <div className="space-y-2">
                    <select
                      value={selectedClientId}
                      onChange={(e) => handleSelectClient(e.target.value)}
                      className="w-full h-11 px-3 text-xs sm:text-sm rounded-xl border border-emerald-500/40 bg-zinc-950 text-white outline-none focus:border-emerald-400"
                    >
                      <option value="">Sélectionnez un client du carnet...</option>
                      {clientsList.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name || c.nom} ({c.phone || c.telephone || "Sans tél"})
                        </option>
                      ))}
                    </select>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        required
                        placeholder="Nom du client"
                        value={formData.client_name}
                        onChange={(e) =>
                          setFormData({ ...formData, client_name: e.target.value })
                        }
                        className="w-full h-10 px-3 text-xs rounded-xl border border-white/10 bg-zinc-900/80 text-white placeholder:text-zinc-500 outline-none focus:border-emerald-500"
                      />
                      <input
                        type="tel"
                        required
                        placeholder="Numéro WhatsApp (+225...)"
                        value={formData.client_phone}
                        onChange={(e) =>
                          setFormData({ ...formData, client_phone: e.target.value })
                        }
                        className="w-full h-10 px-3 text-xs rounded-xl border border-white/10 bg-zinc-900/80 text-white placeholder:text-zinc-500 outline-none focus:border-emerald-500 font-mono"
                      />
                    </div>
                  </div>
                ) : (
                  /* Mode Ajout Rapide direct */
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <span className="text-[11px] text-zinc-400">Nom complet ou Entreprise</span>
                        <input
                          type="text"
                          required
                          placeholder="Ex : Jean-Marc Koffi ou Ivoire Tech"
                          value={formData.client_name}
                          onChange={(e) =>
                            setFormData({ ...formData, client_name: e.target.value })
                          }
                          className="w-full h-11 px-3.5 text-xs sm:text-sm rounded-xl border border-white/10 bg-zinc-950 text-white placeholder:text-zinc-500 outline-none transition-all duration-150 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 font-medium"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[11px] text-zinc-400">WhatsApp (Côte d'Ivoire)</span>
                        <input
                          type="tel"
                          required
                          placeholder="Ex : 07 08 09 10 11"
                          value={formData.client_phone}
                          onChange={(e) =>
                            setFormData({ ...formData, client_phone: e.target.value })
                          }
                          className="w-full h-11 px-3.5 text-xs sm:text-sm rounded-xl border border-white/10 bg-zinc-950 text-white placeholder:text-zinc-500 outline-none transition-all duration-150 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 font-medium font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ═══ 3. NOM DU SERVICE OU DU PLAT ═══ */}
              <div className="space-y-1.5 pt-2 border-t border-white/5">
                <label className="text-xs font-bold text-zinc-200 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    {businessType === "restaurant" ? (
                      <span className="text-sm">🍽️</span>
                    ) : (
                      <Briefcase className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                    <span>
                      {businessType === "restaurant"
                        ? "Nom du plat ou de la commande"
                        : "Nom de la prestation"}
                    </span>
                    <span className="text-rose-400">*</span>
                  </span>
                  <span className="text-[10px] text-zinc-400">
                    {businessType === "restaurant" ? "Addition / Menu" : "Facturation"}
                  </span>
                </label>
                <input
                  type="text"
                  required
                  placeholder={
                    businessType === "restaurant"
                      ? "Ex : Garba Thon Braisé, Menu Dégustation, Commande Table 4..."
                      : "Ex : Développement Site Web, Audit, Community Management..."
                  }
                  value={formData.service_name}
                  onChange={(e) =>
                    setFormData({ ...formData, service_name: e.target.value })
                  }
                  className="w-full h-11 px-3.5 text-xs sm:text-sm rounded-xl border border-white/10 bg-zinc-950 text-white placeholder:text-zinc-500 outline-none transition-all duration-150 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 font-medium"
                />
              </div>

              {/* Champ 3bis : Répartition des frais de transaction (Client vs Freelance) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                    <BadgePercent className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Prise en charge des frais (1% + 100 FCFA)</span>
                  </label>
                  <span className="text-[10px] font-mono text-zinc-400">
                    {feeBearer === "client" ? "Frais additionnels client" : "Frais inclus & offerts"}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {/* Option 1 : Client supporte les frais */}
                  <button
                    type="button"
                    onClick={() => setFeeBearer("client")}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      feeBearer === "client"
                        ? "bg-emerald-500/10 border-emerald-500/50 text-white ring-1 ring-emerald-500/30"
                        : "bg-black border-white/10 text-zinc-400 hover:border-white/20 hover:text-zinc-200"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">À la charge du client (défaut)</span>
                      <span
                        className={`h-3.5 w-3.5 rounded-full border flex items-center justify-center ${
                          feeBearer === "client"
                            ? "border-emerald-400 bg-emerald-400"
                            : "border-zinc-600"
                        }`}
                      >
                        {feeBearer === "client" && (
                          <span className="h-1.5 w-1.5 rounded-full bg-black" />
                        )}
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-1 leading-relaxed">
                      Le client paie les frais en plus. Votre net perçu reste exact à 100%.
                    </p>
                  </button>

                  {/* Option 2 : Freelance supporte les frais */}
                  <button
                    type="button"
                    onClick={() => setFeeBearer("freelance")}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      feeBearer === "freelance"
                        ? "bg-emerald-500/10 border-emerald-500/50 text-white ring-1 ring-emerald-500/30"
                        : "bg-black border-white/10 text-zinc-400 hover:border-white/20 hover:text-zinc-200"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">À ma charge (frais offerts)</span>
                      <span
                        className={`h-3.5 w-3.5 rounded-full border flex items-center justify-center ${
                          feeBearer === "freelance"
                            ? "border-emerald-400 bg-emerald-400"
                            : "border-zinc-600"
                        }`}
                      >
                        {feeBearer === "freelance" && (
                          <span className="h-1.5 w-1.5 rounded-full bg-black" />
                        )}
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-1 leading-relaxed">
                      Le client paie exactement le prix affiché. Les frais sont déduits de votre solde.
                    </p>
                  </button>
                </div>
              </div>

              {/* Champ 4 : Montant */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                    <Coins className="w-3.5 h-3.5 text-emerald-400" />
                    <span>
                      {feeBearer === "client"
                        ? "Montant Net souhaité (ce que vous touchez)"
                        : "Prix de la prestation (facturé au client)"}
                    </span>
                    <span className="text-rose-400">*</span>
                  </label>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${
                      feeBearer === "client"
                        ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
                        : "text-amber-400 bg-amber-500/10 border-amber-500/30"
                    }`}
                  >
                    {feeBearer === "client" ? "Net garanti 100%" : "Frais déduits"}
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

              {/* ═══ Validité Temporelle & Type d'usage ═══ */}
              <div className="rounded-2xl border border-white/10 bg-zinc-950/70 p-4 sm:p-5 space-y-4">
                {/* 1. Durée de validité */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Durée de validité du lien</span>
                    </label>
                    <span className="text-[10px] text-zinc-400">
                      {calculatedExpiresAt ? (
                        <span className="text-emerald-400 font-medium">
                          Expire le {calculatedExpiresAt.toLocaleDateString("fr-FR", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      ) : (
                        <span>Sans limite de validité</span>
                      )}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                    {[
                      { id: "24h", label: "24h" },
                      { id: "48h", label: "48h" },
                      { id: "7d", label: "7 jours" },
                      { id: "30d", label: "30 jours" },
                      { id: "custom", label: "Date..." },
                      { id: "never", label: "Illimité" },
                    ].map((item) => {
                      const active = validityPreset === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setValidityPreset(item.id)}
                          className={`h-9 px-2 text-xs font-bold rounded-xl transition-all duration-150 flex items-center justify-center border ${
                            active
                              ? "bg-emerald-500 text-black border-emerald-400 shadow-md shadow-emerald-500/20"
                              : "bg-black text-zinc-400 hover:text-white hover:bg-zinc-900 border-white/10"
                          }`}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Date & Heure personnalisées si 'custom' */}
                  {validityPreset === "custom" && (
                    <div className="pt-2 animate-slide-up">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-emerald-400 shrink-0" />
                        <input
                          type="datetime-local"
                          value={customExpiresAt}
                          onChange={(e) => setCustomExpiresAt(e.target.value)}
                          min={new Date().toISOString().slice(0, 16)}
                          required={validityPreset === "custom"}
                          className="w-full h-10 px-3 text-xs rounded-xl bg-black border border-emerald-500/40 text-white outline-none focus:border-emerald-400 [color-scheme:dark]"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="h-px bg-white/5" />

                {/* 2. Type d'utilisation : Unique ou Multiple */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                    <Repeat className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Type d'utilisation</span>
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {/* Option 1 : Usage unique */}
                    <button
                      type="button"
                      onClick={() => setIsSingleUse(true)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        isSingleUse
                          ? "bg-emerald-500/10 border-emerald-500/50 text-white ring-1 ring-emerald-500/30"
                          : "bg-black border-white/10 text-zinc-400 hover:border-white/20 hover:text-zinc-200"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold">Usage unique (défaut)</span>
                        <span
                          className={`h-3.5 w-3.5 rounded-full border flex items-center justify-center ${
                            isSingleUse
                              ? "border-emerald-400 bg-emerald-400"
                              : "border-zinc-600"
                          }`}
                        >
                          {isSingleUse && <span className="h-1.5 w-1.5 rounded-full bg-black" />}
                        </span>
                      </div>
                      <p className="text-[10px] text-zinc-400 mt-1 leading-relaxed">
                        Le lien se désactive automatiquement dès le premier paiement validé.
                      </p>
                    </button>

                    {/* Option 2 : Usage multiple */}
                    <button
                      type="button"
                      onClick={() => setIsSingleUse(false)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        !isSingleUse
                          ? "bg-emerald-500/10 border-emerald-500/50 text-white ring-1 ring-emerald-500/30"
                          : "bg-black border-white/10 text-zinc-400 hover:border-white/20 hover:text-zinc-200"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold">Usage multiple</span>
                        <span
                          className={`h-3.5 w-3.5 rounded-full border flex items-center justify-center ${
                            !isSingleUse
                              ? "border-emerald-400 bg-emerald-400"
                              : "border-zinc-600"
                          }`}
                        >
                          {!isSingleUse && <span className="h-1.5 w-1.5 rounded-full bg-black" />}
                        </span>
                      </div>
                      <p className="text-[10px] text-zinc-400 mt-1 leading-relaxed">
                        Autorise plusieurs paiements jusqu'à concurrence du quota fixé.
                      </p>
                    </button>
                  </div>

                  {/* Paramétrage du quota d'utilisations si usage multiple */}
                  {!isSingleUse && (
                    <div className="pt-2 flex items-center gap-3 animate-slide-up bg-black p-3 rounded-xl border border-white/10">
                      <div className="flex-1">
                        <span className="text-xs font-bold text-zinc-200 block">
                          Nombre maximal de paiements autorisés :
                        </span>
                        <span className="text-[10px] text-zinc-400">
                          Le lien se fermera automatiquement une fois ce quota atteint
                        </span>
                      </div>
                      <div className="w-24">
                        <input
                          type="number"
                          min="2"
                          max="9999"
                          value={maxUses}
                          onChange={(e) => setMaxUses(e.target.value)}
                          className="w-full h-9 px-2 text-center text-xs font-bold rounded-lg bg-zinc-900 border border-emerald-500/40 text-white outline-none focus:border-emerald-400"
                        />
                      </div>
                    </div>
                  )}
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
                    {feeBearer === "client" ? "Frais payés par le client" : "Frais offerts au client"}
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  {feeBearer === "client" ? (
                    <>
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
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-between text-zinc-300">
                        <span className="flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                          Tarif prestation (payé par le client)
                        </span>
                        <span className="font-semibold text-white">
                          {formatAmount(calculations.total)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-zinc-300">
                        <span className="flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                          Frais de transaction prélevés (1% + 100 F)
                        </span>
                        <span className="font-semibold text-amber-400">
                          - {formatAmount(calculations.fees)}
                        </span>
                      </div>

                      <div className="pt-2.5 border-t border-white/10 flex items-center justify-between">
                        <div>
                          <span className="text-xs uppercase font-extrabold tracking-wider text-zinc-200">
                            Montant Net versé sur votre compte
                          </span>
                          <p className="text-[10px] text-zinc-400">
                            Le client ne paie aucun frais supplémentaire
                          </p>
                        </div>
                        <span className="text-lg sm:text-xl font-black text-emerald-400 tracking-tight">
                          {formatAmount(calculations.net)}
                        </span>
                      </div>
                    </>
                  )}
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
