"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import {
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
  Receipt,
  Smartphone,
  Lock,
  FileText,
  AlertTriangle,
  Ban,
  Repeat,
  CalendarClock,
  Check,
  Mail,
  MessageCircle,
  Send,
  LoaderCircle,
  Sun,
  Moon,
  Sparkles,
  HelpCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { generateReceiptPDF } from "@/lib/exportUtils";

/* ─────────────────────────────────────────────────────────────
   HELPERS : FORMATAGE
   ───────────────────────────────────────────────────────────── */

function formatAmount(amount) {
  if (amount == null || isNaN(amount) || amount <= 0) return "0 FCFA";
  return (
    new Intl.NumberFormat("fr-FR", {
      maximumFractionDigits: 0,
    }).format(amount) + " FCFA"
  );
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

/* ─────────────────────────────────────────────────────────────
   PAGE DE PAIEMENT FRONT-END SÉCURISÉE (TOKEN UNIQUE / ID)
   ───────────────────────────────────────────────────────────── */

export default function PublicPaymentPage() {
  const params = useParams();
  const paymentToken = params?.id;

  // Thème Sombre / Clair (Mobile-First)
  const [theme, setTheme] = useState("dark");

  const [loading, setLoading] = useState(true);
  const [payment, setPayment] = useState(null);
  const [error, setError] = useState(null);

  // États du mode de secours (validation manuelle)
  const [showManualModal, setShowManualModal] = useState(false);
  const [transactionRef, setTransactionRef] = useState("");
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [manualSuccessMessage, setManualSuccessMessage] = useState("");

  // État du bouton de paiement GeniusPay & opérateur actif
  const [payingGenius, setPayingGenius] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [payError, setPayError] = useState(null);
  const [autoRedirectAttempted, setAutoRedirectAttempted] = useState(false);

  // États pour l'envoi automatique du reçu
  const [receiptEmail, setReceiptEmail] = useState("");
  const [sendingReceiptEmail, setSendingReceiptEmail] = useState(false);
  const [receiptEmailSent, setReceiptEmailSent] = useState(false);
  const [receiptToast, setReceiptToast] = useState("");

  // Initialisation du thème sauvegardé
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem("bp_public_theme");
      if (savedTheme === "light" || savedTheme === "dark") {
        setTheme(savedTheme);
      }
    } catch {
      // Ignorer
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    try {
      localStorage.setItem("bp_public_theme", nextTheme);
    } catch {
      // Ignorer
    }
  };

  const handleOpenWhatsAppReceipt = () => {
    if (!payment) return;
    const client = payment.client || (Array.isArray(payment.clients) ? payment.clients[0] : payment.clients) || {};
    const rawPhone = client.phone || client.telephone || payment.client_phone || "";
    const cleanPhone = rawPhone.replace(/[^\d]/g, "");
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://kadmielbusiness.vercel.app";
    const receiptUrl = `${baseUrl}/receipt/${payment.id}`;
    const clientName = client.name || client.nom || payment.client_name || "Client";
    const service = payment.service_name || payment.service || "Prestation";
    const totalAmount = formatAmount(payment.amount_total ?? payment.montant_total ?? payment.amount_net);

    const message = `*REÇU OFFICIEL DE PAIEMENT — KADMIEL BUSINESS PAY* 🧾✨\n\nBonjour *${clientName}*,\nVotre règlement a été validé et encaissé avec succès.\n\n📌 *Détails de la transaction :*\n• *Prestation :* ${service}\n• *Montant réglé :* ${totalAmount}\n• *Date & heure :* ${formatDate(payment.paid_at || payment.updated_at || payment.created_at)}\n• *Réf. transaction :* ${payment.geniuspay_ref || payment.manual_tx_id || payment.id.slice(0, 12)}\n\n🔗 *Consultez et téléchargez votre reçu officiel certifié ici :*\n👉 ${receiptUrl}\n\nMerci pour votre confiance !\n— _Kadmiel Business Pay_`;

    window.open(
      `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  const handleSendReceiptEmail = async (e) => {
    if (e) e.preventDefault();
    if (!receiptEmail.trim()) return;

    setSendingReceiptEmail(true);
    try {
      const res = await fetch("/api/receipt/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId: payment.id,
          email: receiptEmail.trim(),
          channel: "email",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Impossible d'envoyer l'email.");
      }
      setReceiptEmailSent(true);
      setReceiptToast("Reçu certifié envoyé par email avec succès !");
      setTimeout(() => setReceiptToast(""), 3500);
    } catch (err) {
      alert(err.message || "Erreur lors de l'envoi de l'email.");
    } finally {
      setSendingReceiptEmail(false);
    }
  };

  // 1. Charger les détails du paiement (accessible par token unique ou par ID)
  const fetchPayment = async () => {
    try {
      const res = await fetch(`/api/payments/${paymentToken}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Impossible de charger la facture.");
      }

      setPayment(data.payment);
      return data.payment;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  // 2. Initialisation de la session de paiement GeniusPay (Wave, Orange, MTN, Moov)
  const handlePayGenius = useCallback(
    async (operator = null, targetPaymentId = null) => {
      const targetProvider = operator || selectedProvider;
      if (operator) setSelectedProvider(operator);

      setPayError(null);
      setPayingGenius(true);

      try {
        const activeId = targetPaymentId || payment?.id || paymentToken;
        const res = await fetch("/api/create-payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paymentId: activeId,
            provider: targetProvider || undefined,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(
            data.details ||
              data.error ||
              "Échec de l'initialisation de la passerelle GeniusPay."
          );
        }

        if (data.checkout_url) {
          // Redirection directe vers la passerelle sécurisée
          window.location.href = data.checkout_url;
        } else {
          throw new Error("L'URL de paiement fournie par la passerelle est vide.");
        }
      } catch (err) {
        console.error("[PayPage] Erreur passerelle :", err);
        setPayError(err.message || "Erreur de connexion à la passerelle.");
      } finally {
        setPayingGenius(false);
      }
    },
    [selectedProvider, payment, paymentToken]
  );

  useEffect(() => {
    if (!paymentToken) return;

    fetchPayment().then((p) => {
      // Redirection automatique immédiate vers la page GeniusPay lors de l'ouverture du lien
      if (
        p &&
        (p.status === "en_attente" || p.statut === "en_attente") &&
        !p.is_expired &&
        !p.is_usage_exceeded
      ) {
        if (typeof window !== "undefined") {
          const params = new URLSearchParams(window.location.search);
          const isCancelled =
            params.get("genius_status") === "cancel" ||
            params.get("cancel") === "true" ||
            params.get("stay") === "true" ||
            params.get("manual") === "true";

          if (!isCancelled && !autoRedirectAttempted) {
            setAutoRedirectAttempted(true);
            handlePayGenius(null, p.id);
          }
        }
      }
    });

    // Polling toutes les 5 secondes si le paiement est en attente ou en vérification
    const interval = setInterval(async () => {
      const updated = await fetchPayment();
      if (updated?.status === "paye" || updated?.status === "expire") {
        clearInterval(interval);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [paymentToken, handlePayGenius, autoRedirectAttempted]);

  // 3. Soumission du mode de secours manuel (saisie de l'ID SMS)
  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!transactionRef.trim()) return;

    setManualSubmitting(true);
    setPayError(null);
    setManualSuccessMessage("");

    try {
      const res = await fetch("/api/manual-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId: payment?.id || paymentToken,
          manualTxId: transactionRef.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erreur lors de la soumission de la référence.");
      }

      setManualSuccessMessage(
        `Votre référence "${transactionRef.trim()}" a été enregistrée avec succès. Notre équipe confirme la réception dès vérification du transfert.`
      );

      // Bascule instantanée du statut local vers 'a_verifier'
      setPayment((prev) => (prev ? { ...prev, status: "a_verifier", manual_tx_id: transactionRef.trim() } : null));
      setTransactionRef("");
    } catch (err) {
      alert(err.message || "Erreur lors de la soumission de la référence.");
    } finally {
      setManualSubmitting(false);
    }
  };

  const isDark = theme === "dark";

  // ═══ ÉTAT : CHARGEMENT ═══
  if (loading) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center px-4 transition-colors duration-300 ${
          isDark ? "bg-slate-950 text-white" : "bg-slate-50 text-slate-900"
        }`}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin h-10 w-10 border-3 border-emerald-500 border-t-transparent rounded-full" />
          <p
            className={`text-xs font-semibold tracking-wide ${
              isDark ? "text-slate-400" : "text-slate-600"
            }`}
          >
            Chargement sécurisé de votre lien de paiement...
          </p>
        </div>
      </div>
    );
  }

  // ═══ ÉTAT : ERREUR / LIEN INVALIDE ═══
  if (error || !payment) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center p-4 transition-colors duration-300 ${
          isDark ? "bg-slate-950 text-white" : "bg-slate-50 text-slate-900"
        }`}
      >
        <div
          className={`max-w-md w-full rounded-3xl p-6 sm:p-8 text-center space-y-4 shadow-2xl border ${
            isDark
              ? "bg-slate-900 border-slate-800"
              : "bg-white border-slate-200"
          }`}
        >
          <div className="h-12 w-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto border border-rose-500/20">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h1 className="text-lg font-bold">Lien de paiement indisponible</h1>
          <p
            className={`text-xs leading-relaxed ${
              isDark ? "text-slate-400" : "text-slate-600"
            }`}
          >
            {error || "Ce lien de paiement est invalide, expiré ou introuvable."}
          </p>
          <div className="pt-2">
            <a
              href="https://wa.me/2250706978570"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-emerald-500 hover:text-emerald-400 font-bold"
            >
              <span>Contacter le support sur WhatsApp</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Calculs d'état
  const isPaid = payment.status === "paye" || payment.statut === "paye";
  const isPendingVerification = payment.status === "a_verifier";
  const isFeeBearerFreelance = payment.fee_bearer === "freelance";
  const feeAmount = (payment.amount_total || 0) - (payment.amount_net || 0);

  const isSingleUse = payment.is_single_use !== false;
  const timesUsed = Number(payment.times_used) || 0;
  const maxUses = Number(payment.max_uses) || 1;

  const now = new Date();
  const isExpired =
    Boolean(payment.is_expired) ||
    Boolean(payment.expires_at && now > new Date(payment.expires_at)) ||
    payment.status === "expire";

  const isUsageExceeded = isSingleUse
    ? timesUsed >= 1 && !isPaid
    : timesUsed >= maxUses && !isPaid;

  const isSubscription =
    payment.business_type === "abonnement_resto" || Boolean(payment.is_recurring);
  const isRestaurant = payment.business_type === "restaurant";

  return (
    <div
      className={`min-h-screen font-sans py-8 sm:py-12 px-4 flex flex-col items-center justify-center relative transition-colors duration-300 selection:bg-emerald-500 selection:text-white ${
        isDark ? "bg-slate-950 text-slate-100" : "bg-slate-100 text-slate-900"
      }`}
    >
      {/* Halo lumineux d'ambiance */}
      <div className="pointer-events-none fixed inset-0 flex items-center justify-center overflow-hidden">
        <div
          className={`h-[440px] w-[440px] rounded-full blur-3xl transition-opacity duration-500 ${
            isDark ? "bg-emerald-500/10 opacity-100" : "bg-emerald-500/15 opacity-80"
          }`}
        />
      </div>

      <div className="relative z-10 max-w-md w-full space-y-5">
        {/* ═══ Header de marque avec bascule Thème Sombre / Clair ═══ */}
        <div className="flex items-center justify-between pb-1">
          <div className="flex items-center gap-3">
            <div
              className={`h-11 w-11 rounded-2xl flex items-center justify-center overflow-hidden border shadow-md ${
                isDark ? "bg-black border-slate-800" : "bg-white border-slate-200"
              }`}
            >
              <Image
                src="/logo.png"
                alt="Logo Kadmiel Business Pay"
                width={44}
                height={44}
                priority
                className="object-cover"
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-black tracking-tight">
                  Business Pay
                </span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 px-1.5 py-0.2 rounded-full font-bold">
                  Vérifié
                </span>
              </div>
              <p
                className={`text-[11px] font-medium ${
                  isDark ? "text-slate-400" : "text-slate-500"
                }`}
              >
                Paiement direct Mobile Money (Côte d'Ivoire)
              </p>
            </div>
          </div>

          {/* Bouton de bascule Mode Sombre / Mode Clair */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Basculer le thème"
            className={`h-9 px-3 rounded-xl border flex items-center gap-1.5 text-xs font-semibold transition-all shadow-sm active:scale-95 ${
              isDark
                ? "bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800"
                : "bg-white border-slate-300 text-slate-700 hover:text-black hover:bg-slate-50"
            }`}
          >
            {isDark ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[11px]">Clair</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-indigo-500" />
                <span className="text-[11px]">Sombre</span>
              </>
            )}
          </button>
        </div>

        {/* ═══ Carte Principale Mobile-First ═══ */}
        <div
          className={`backdrop-blur-xl rounded-3xl p-6 sm:p-7 shadow-2xl border transition-all duration-300 space-y-5 ${
            isDark
              ? "bg-slate-900/95 border-slate-800 shadow-black/40"
              : "bg-white/95 border-slate-200/90 shadow-slate-300/40"
          }`}
        >
          {/* CAS 1 : FACTURE RÉGLÉE AVEC SUCCÈS */}
          {isPaid ? (
            <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-5 text-center space-y-3.5 animate-slide-up">
              <div className="h-12 w-12 rounded-full bg-emerald-500/20 text-emerald-500 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <p className="text-base font-bold text-emerald-500">
                  Paiement validé avec succès !
                </p>
                <p
                  className={`text-xs mt-1 ${
                    isDark ? "text-slate-400" : "text-slate-600"
                  }`}
                >
                  Votre règlement de{" "}
                  <span className="font-bold underline decoration-emerald-500">
                    {formatAmount(payment.amount_total)}
                  </span>{" "}
                  a bien été reçu.
                </p>
                {isSingleUse && (
                  <span
                    className={`inline-block mt-2 text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${
                      isDark
                        ? "text-zinc-300 bg-zinc-800/80 border-zinc-700"
                        : "text-zinc-700 bg-zinc-200 border-zinc-300"
                    }`}
                  >
                    Lien à usage unique · Paiement clôturé
                  </span>
                )}
              </div>

              <div
                className={`pt-2.5 border-t text-xs flex items-center justify-between ${
                  isDark ? "border-emerald-500/20 text-slate-400" : "border-emerald-500/30 text-slate-600"
                }`}
              >
                <span>{isSubscription || isRestaurant ? "Abonnement :" : "Prestation :"}</span>
                <span className="font-semibold">{payment.service_name}</span>
              </div>

              {/* Module Reçu Automatique Intégré */}
              <div className="pt-3 space-y-3 border-t border-emerald-500/20 text-left">
                {receiptToast && (
                  <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-600 dark:text-emerald-300 text-xs font-bold text-center animate-slide-up flex items-center justify-center gap-1.5">
                    <Check className="w-4 h-4 text-emerald-500" />
                    <span>{receiptToast}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <a
                    href={`/receipt/${payment.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-11 px-3 rounded-xl bg-emerald-500 text-black font-extrabold text-xs flex items-center justify-center gap-2 hover:bg-emerald-400 transition shadow-md shadow-emerald-500/20 active:scale-95 text-center"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Consulter le Reçu</span>
                  </a>

                  <button
                    type="button"
                    onClick={handleOpenWhatsAppReceipt}
                    className="h-11 px-3 rounded-xl bg-[#25D366] text-black font-extrabold text-xs flex items-center justify-center gap-2 hover:bg-[#20ba59] transition shadow-md shadow-[#25D366]/20 active:scale-95 text-center"
                  >
                    <MessageCircle className="w-4 h-4 fill-black" />
                    <span>Reçu sur WhatsApp</span>
                  </button>
                </div>

                {/* Formulaire d'envoi automatique par Email */}
                <div
                  className={`p-3.5 rounded-2xl border space-y-2 ${
                    isDark ? "bg-black/60 border-white/10" : "bg-slate-50 border-slate-200"
                  }`}
                >
                  <span className="text-[11px] font-semibold flex items-center justify-between">
                    <span>Recevoir votre reçu certifié par email :</span>
                    <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider">
                      Instantané
                    </span>
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Mail className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        placeholder="votre.email@domaine.com"
                        value={receiptEmail}
                        onChange={(e) => setReceiptEmail(e.target.value)}
                        className={`w-full h-9 pl-9 pr-2.5 rounded-xl border text-xs outline-none transition-colors ${
                          isDark
                            ? "bg-zinc-900 border-emerald-500/30 text-white placeholder:text-zinc-600 focus:border-emerald-400"
                            : "bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-emerald-500"
                        }`}
                      />
                    </div>
                    <button
                      type="button"
                      disabled={sendingReceiptEmail || !receiptEmail.trim()}
                      onClick={handleSendReceiptEmail}
                      className="h-9 px-3.5 rounded-xl bg-emerald-500 text-black font-bold text-xs hover:bg-emerald-400 transition shrink-0 flex items-center gap-1.5 disabled:opacity-50 active:scale-95"
                    >
                      {sendingReceiptEmail ? (
                        <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
                      ) : receiptEmailSent ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Envoyé</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>Envoyer</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => generateReceiptPDF(payment)}
                  className={`w-full h-9 rounded-xl font-medium text-[11px] transition flex items-center justify-center gap-1.5 border ${
                    isDark
                      ? "text-zinc-400 hover:text-white hover:bg-white/5 border-white/5"
                      : "text-slate-600 hover:text-black hover:bg-slate-100 border-slate-200"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Télécharger une copie PDF du reçu</span>
                </button>
              </div>
            </div>
          ) : isExpired ? (
            /* CAS 2 : LIEN EXPIRÉ */
            <div className="rounded-2xl bg-rose-500/10 border border-rose-500/30 p-6 text-center space-y-4 animate-slide-up">
              <div className="h-14 w-14 rounded-2xl bg-rose-500/20 text-rose-500 mx-auto flex items-center justify-center border border-rose-500/30">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <div>
                <span className="inline-block text-[10px] uppercase font-bold tracking-wider text-rose-500 bg-rose-500/10 border border-rose-500/20 px-2.5 py-0.5 rounded-full mb-1.5">
                  Lien Expiré
                </span>
                <h2 className="text-lg font-black">Ce lien de paiement a expiré</h2>
                <p
                  className={`text-xs mt-1 leading-relaxed ${
                    isDark ? "text-slate-400" : "text-slate-600"
                  }`}
                >
                  La date d'expiration fixée par le prestataire a été atteinte. Veuillez lui demander un nouveau lien.
                </p>
                {payment.expires_at && (
                  <p className="text-[11px] font-mono text-rose-500 mt-2 bg-rose-500/10 border border-rose-500/20 py-1 px-2.5 rounded-lg inline-block">
                    Échéance : {formatDate(payment.expires_at)}
                  </p>
                )}
              </div>

              <div className="pt-2 border-t border-rose-500/20">
                <a
                  href="https://wa.me/2250706978570?text=Bonjour,%20mon%20lien%20de%20paiement%20a%20expiré,%20pouvez-vous%20m'en%20générer%20un%20nouveau%20?"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`w-full h-11 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-2 border ${
                    isDark
                      ? "bg-slate-800 hover:bg-slate-700 text-white border-slate-700"
                      : "bg-slate-200 hover:bg-slate-300 text-slate-900 border-slate-300"
                  }`}
                >
                  <span>Demander un nouveau lien sur WhatsApp</span>
                  <ExternalLink className="w-3.5 h-3.5 text-emerald-500" />
                </a>
              </div>
            </div>
          ) : isUsageExceeded ? (
            /* CAS 3 : QUOTA DÉPASSÉ */
            <div className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-6 text-center space-y-4 animate-slide-up">
              <div className="h-14 w-14 rounded-2xl bg-amber-500/20 text-amber-500 mx-auto flex items-center justify-center border border-amber-500/30">
                <Ban className="w-7 h-7" />
              </div>
              <div>
                <span className="inline-block text-[10px] uppercase font-bold tracking-wider text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full mb-1.5">
                  Lien non réutilisable
                </span>
                <h2 className="text-lg font-black">Ce lien a déjà été utilisé</h2>
                <p
                  className={`text-xs mt-1 leading-relaxed ${
                    isDark ? "text-slate-400" : "text-slate-600"
                  }`}
                >
                  Ce lien était configuré pour un usage unique et a déjà été validé.
                </p>
              </div>

              <div className="pt-2 border-t border-amber-500/20">
                <a
                  href="https://wa.me/2250706978570"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`w-full h-11 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-2 border ${
                    isDark
                      ? "bg-slate-800 hover:bg-slate-700 text-white border-slate-700"
                      : "bg-slate-200 hover:bg-slate-300 text-slate-900 border-slate-300"
                  }`}
                >
                  <span>Contacter le prestataire</span>
                  <ExternalLink className="w-3.5 h-3.5 text-emerald-500" />
                </a>
              </div>
            </div>
          ) : isPendingVerification ? (
            /* CAS 4 : MODE SECOURS SOUMIS — EN ATTENTE DE CONFIRMATION MANUELLE */
            <div className="rounded-2xl bg-amber-500/10 border border-amber-500/25 p-5 text-center space-y-3.5 animate-slide-up">
              <div className="h-12 w-12 rounded-full bg-amber-500/20 text-amber-500 mx-auto flex items-center justify-center">
                <Clock className="w-7 h-7 animate-pulse" />
              </div>
              <div>
                <p className="text-sm font-bold text-amber-500">
                  Référence soumise · En cours de validation
                </p>
                <p
                  className={`text-xs mt-1 leading-relaxed ${
                    isDark ? "text-slate-400" : "text-slate-600"
                  }`}
                >
                  Votre référence de transaction Mobile Money a été transmise. Validation imminente dès confirmation de l'opérateur.
                </p>
                {payment.manual_tx_id && (
                  <p className="text-[11px] font-mono text-amber-500 mt-2 font-bold bg-amber-500/10 border border-amber-500/20 py-1 px-3 rounded-lg inline-block">
                    Réf : {payment.manual_tx_id}
                  </p>
                )}
              </div>
              <div
                className={`pt-2 border-t text-[11px] ${
                  isDark ? "border-amber-500/20 text-slate-400" : "border-amber-500/30 text-slate-600"
                }`}
              >
                Cette page s'actualise automatiquement dès validation.
              </div>
            </div>
          ) : (
            /* CAS 5 : FACTURE EN ATTENTE DE RÈGLEMENT (FORMULAIRE PRINCIPAL) */
            <>
              {/* Badge d'en-tête client & activité */}
              <div className="flex items-center justify-between pb-1 flex-wrap gap-2">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full border ${
                      isSubscription || isRestaurant
                        ? "bg-purple-500/10 text-purple-400 border-purple-500/25"
                        : "bg-emerald-500/10 text-emerald-500 border-emerald-500/25"
                    }`}
                  >
                    {isSubscription || isRestaurant
                      ? "🍽️ Abonnement Restaurant B2B"
                      : "💼 Freelance"}
                  </span>
                  <span
                    className={`text-xs font-semibold ${
                      isDark ? "text-slate-400" : "text-slate-600"
                    }`}
                  >
                    {isSubscription || isRestaurant ? "Abonnement émis pour " : "Facture émise pour "}
                    <strong
                      className={`font-bold ${
                        isDark ? "text-white" : "text-slate-900"
                      }`}
                    >
                      {payment.client_name || "Client"}
                    </strong>
                  </span>
                </div>

                {payment.expires_at && (
                  <div
                    className={`flex items-center gap-1 text-[11px] font-mono ${
                      isDark ? "text-slate-400" : "text-slate-600"
                    }`}
                  >
                    <CalendarClock className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Expire le {formatDate(payment.expires_at)}</span>
                  </div>
                )}
              </div>

              {/* Bannière de redirection automatique GeniusPay */}
              {payingGenius && (
                <div className="rounded-2xl bg-emerald-500/15 border border-emerald-500/30 p-4 text-center space-y-2 animate-pulse">
                  <div className="flex items-center justify-center gap-2 text-emerald-400 font-bold text-xs">
                    <LoaderCircle className="w-4 h-4 animate-spin" />
                    <span>Redirection vers la page de paiement GeniusPay en cours...</span>
                  </div>
                  <p className="text-[11px] text-zinc-300">
                    Connexion sécurisée à la passerelle officielle pour valider par Wave, Orange Money, MTN MoMo ou Moov Money.
                  </p>
                </div>
              )}

              {/* Message d'erreur de la passerelle le cas échéant */}
              {payError && (
                <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-500 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="font-bold">{payError}</p>
                    <p className="text-[11px] opacity-90">
                      Vous pouvez utiliser le mode de secours ci-dessous pour valider votre transfert.
                    </p>
                  </div>
                </div>
              )}

              {/* ═══ 1. DÉCOMPOSITION CLAIRE DES PRIX ═══ */}
              <div
                className={`rounded-2xl p-4 border space-y-2.5 ${
                  isDark ? "bg-black/40 border-slate-800" : "bg-slate-50 border-slate-200"
                }`}
              >
                <div className="flex items-center justify-between text-xs pb-1 border-b border-inherit">
                  <span
                    className={`font-semibold flex items-center gap-1.5 ${
                      isDark ? "text-slate-400" : "text-slate-600"
                    }`}
                  >
                    <Receipt className="w-3.5 h-3.5 text-emerald-500" />
                    <span>
                      {isSubscription || isRestaurant ? "Abonnement Restaurant souscrit" : "Prestation demandée"}
                    </span>
                  </span>
                  <span className="font-bold">{payment.service_name}</span>
                </div>

                {/* Montant Net */}
                <div
                  className={`flex items-center justify-between text-xs ${
                    isDark ? "text-slate-300" : "text-slate-700"
                  }`}
                >
                  <span>
                    {isSubscription || isRestaurant
                      ? "Montant net de l'abonnement mensuel"
                      : "Montant net de la prestation"}
                  </span>
                  <span className="font-semibold font-mono">
                    {formatAmount(payment.amount_net)}
                  </span>
                </div>

                {/* Frais Mobile Money */}
                <div
                  className={`flex items-center justify-between text-xs ${
                    isDark ? "text-slate-300" : "text-slate-700"
                  }`}
                >
                  <span className="flex items-center gap-1">
                    <span>Frais de passerelle Mobile Money</span>
                    <span
                      title="Frais standard opérateur 1% + 100 FCFA"
                      className="cursor-help text-zinc-500 hover:text-emerald-500"
                    >
                      <HelpCircle className="w-3 h-3" />
                    </span>
                  </span>

                  {isFeeBearerFreelance ? (
                    <span className="text-emerald-500 font-bold flex items-center gap-1 text-[11px]">
                      <Sparkles className="w-3 h-3" />
                      Offerts par le freelance (0 FCFA)
                    </span>
                  ) : (
                    <span className="font-semibold font-mono text-amber-500">
                      +{formatAmount(feeAmount)}
                    </span>
                  )}
                </div>
              </div>

              {/* ═══ TOTAL À RÉGLER ═══ */}
              <div
                className={`rounded-2xl p-4 border flex items-center justify-between transition-colors ${
                  isDark
                    ? "bg-emerald-950/20 border-emerald-500/30 text-white"
                    : "bg-emerald-50/80 border-emerald-300 text-slate-950"
                }`}
              >
                <div>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider block ${
                      isDark ? "text-emerald-400" : "text-emerald-700"
                    }`}
                  >
                    Total à régler
                  </span>
                  <p
                    className={`text-[11px] font-medium ${
                      isDark ? "text-slate-400" : "text-slate-600"
                    }`}
                  >
                    {isFeeBearerFreelance
                      ? "Commission prise en charge"
                      : "Frais opérateur inclus · Débit exact"}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-2xl sm:text-3xl font-black tracking-tight text-emerald-500">
                    {formatAmount(payment.amount_total)}
                  </span>
                </div>
              </div>

              {/* ═══ 2. PARCOURS UTILISATEUR : CLIC OPÉRATEUR ═══ */}
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-bold flex items-center gap-1.5 ${
                      isDark ? "text-slate-200" : "text-slate-800"
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Choisissez votre compte Mobile Money :</span>
                  </span>
                  <span className="text-[10px] text-emerald-500 font-bold flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    Instantané
                  </span>
                </div>

                {/* Grille tactile des 4 opérateurs Wave, Orange, MTN, Moov */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {[
                    {
                      id: "wave",
                      name: "Wave",
                      icon: "🌊",
                      accent: "text-[#00A3FF]",
                      border: "border-[#00A3FF]/40 hover:border-[#00A3FF] hover:bg-[#00A3FF]/15",
                      badge: "0% retrait",
                    },
                    {
                      id: "orange",
                      name: "Orange Money",
                      icon: "🍊",
                      accent: "text-[#FF7900]",
                      border: "border-[#FF7900]/40 hover:border-[#FF7900] hover:bg-[#FF7900]/15",
                      badge: "#144#",
                    },
                    {
                      id: "mtn",
                      name: "MTN MoMo",
                      icon: "🟡",
                      accent: "text-[#FFCC00]",
                      border: "border-[#FFCC00]/40 hover:border-[#FFCC00] hover:bg-[#FFCC00]/15",
                      badge: "*133#",
                    },
                    {
                      id: "moov",
                      name: "Moov Money",
                      icon: "🟣",
                      accent: "text-[#0089cf]",
                      border: "border-[#0089cf]/40 hover:border-[#0089cf] hover:bg-[#0089cf]/15",
                      badge: "*155#",
                    },
                  ].map((op) => {
                    const isSelected = selectedProvider === op.id;
                    return (
                      <button
                        key={op.id}
                        type="button"
                        onClick={() => handlePayGenius(op.id)}
                        disabled={payingGenius}
                        className={`p-3 rounded-2xl border transition-all flex flex-col items-center justify-center gap-1 active:scale-95 disabled:opacity-50 shadow-sm relative overflow-hidden ${
                          isSelected
                            ? "border-emerald-400 bg-emerald-500/15 ring-2 ring-emerald-400/50"
                            : `${op.border} ${isDark ? "bg-slate-950/80" : "bg-slate-50"}`
                        }`}
                      >
                        <span className="text-2xl">{op.icon}</span>
                        <span className={`text-xs font-black ${op.accent}`}>
                          {op.name}
                        </span>
                        <span
                          className={`text-[9px] font-semibold px-1.5 py-0.2 rounded-full ${
                            isDark
                              ? "bg-slate-800 text-slate-400"
                              : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {op.badge}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Bouton de confirmation principal */}
                <button
                  type="button"
                  onClick={() => handlePayGenius()}
                  disabled={payingGenius}
                  className="w-full h-12 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.99] disabled:opacity-60 text-slate-950 font-black text-sm transition-all shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2"
                >
                  {payingGenius ? (
                    <>
                      <div className="animate-spin h-4 w-4 border-2 border-slate-950 border-t-transparent rounded-full" />
                      <span>
                        Connexion sécurisée{" "}
                        {selectedProvider
                          ? `(${selectedProvider.toUpperCase()})`
                          : "GeniusPay"}
                        ...
                      </span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4 text-slate-950" />
                      <span>
                        Payer {formatAmount(payment.amount_total)}
                        {selectedProvider
                          ? ` avec ${selectedProvider.toUpperCase()}`
                          : ""}
                      </span>
                      <ArrowRight className="w-4 h-4 text-slate-950" />
                    </>
                  )}
                </button>
              </div>

              {/* ═══ 3. FORMULAIRE ALTERNATIF DE SECOURS MANUEL ═══ */}
              <div
                className={`pt-3 border-t transition-colors ${
                  isDark ? "border-slate-800/80" : "border-slate-200"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setShowManualModal(!showManualModal)}
                  className={`w-full py-2 px-3 rounded-xl flex items-center justify-between text-xs font-semibold transition-colors ${
                    isDark
                      ? "text-slate-400 hover:text-white hover:bg-slate-800/60"
                      : "text-slate-600 hover:text-black hover:bg-slate-100"
                  }`}
                >
                  <span className="flex items-center gap-1.5 text-left">
                    <Smartphone className="w-3.5 h-3.5 text-amber-500" />
                    <span>
                      Réseau perturbé ? Utiliser le mode de secours (ID de transaction SMS)
                    </span>
                  </span>
                  {showManualModal ? (
                    <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                  )}
                </button>

                {showManualModal && (
                  <form
                    onSubmit={handleManualSubmit}
                    className={`mt-3 p-4 rounded-2xl border space-y-3.5 animate-slide-up text-left ${
                      isDark
                        ? "bg-black/60 border-slate-800"
                        : "bg-amber-50/50 border-amber-200/80"
                    }`}
                  >
                    <div className="space-y-1">
                      <p className="text-xs font-bold flex items-center gap-1.5 text-amber-500">
                        <span>Paiement direct & validation de secours</span>
                      </p>
                      <p
                        className={`text-[11px] leading-relaxed ${
                          isDark ? "text-slate-400" : "text-slate-600"
                        }`}
                      >
                        Si vous avez déjà envoyé les fonds au prestataire via Wave ou Mobile Money, saisissez ici l'ID ou la référence reçue par SMS pour valider instantanément votre abonnement ou facture.
                      </p>
                    </div>

                    {manualSuccessMessage ? (
                      <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-600 dark:text-emerald-300 text-xs font-medium space-y-1">
                        <div className="flex items-center gap-1.5 font-bold">
                          <Check className="w-4 h-4 text-emerald-500" />
                          <span>Référence enregistrée</span>
                        </div>
                        <p className="text-[11px]">{manualSuccessMessage}</p>
                      </div>
                    ) : (
                      <>
                        <div>
                          <label
                            className={`block text-[11px] font-semibold mb-1 ${
                              isDark ? "text-slate-300" : "text-slate-700"
                            }`}
                          >
                            Référence ou ID reçu par SMS :
                          </label>
                          <input
                            type="text"
                            placeholder="Ex: PP260309.1234.A12345 ou CI240501..."
                            value={transactionRef}
                            onChange={(e) => setTransactionRef(e.target.value)}
                            required
                            className={`w-full h-10 px-3 text-xs rounded-xl border outline-none font-mono transition-colors ${
                              isDark
                                ? "bg-slate-900 border-slate-700 text-white placeholder-slate-500 focus:border-amber-400"
                                : "bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-amber-500"
                            }`}
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={manualSubmitting || !transactionRef.trim()}
                          className="w-full h-10 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 shadow-md shadow-amber-500/20"
                        >
                          {manualSubmitting ? (
                            <>
                              <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
                              <span>Enregistrement en cours...</span>
                            </>
                          ) : (
                            <span>Valider ma référence de secours</span>
                          )}
                        </button>
                      </>
                    )}
                  </form>
                )}
              </div>
            </>
          )}
        </div>

        {/* ═══ Footer Sécurité ═══ */}
        <div className="text-center space-y-1 pb-4">
          <p
            className={`text-[11px] flex items-center justify-center gap-1.5 ${
              isDark ? "text-slate-400" : "text-slate-600"
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Chiffrement SSL 256 bits · Passerelle agréée Côte d'Ivoire</span>
          </p>
          <p
            className={`text-[10px] ${
              isDark ? "text-slate-600" : "text-slate-500"
            }`}
          >
            Business Pay · Abidjan, Côte d'Ivoire
          </p>
        </div>
      </div>
    </div>
  );
}