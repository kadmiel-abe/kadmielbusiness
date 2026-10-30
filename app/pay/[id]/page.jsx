"use client";

import React, { useState, useEffect } from "react";
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
   PAGE PUBLIQUE DE PAIEMENT CLIENT
   ───────────────────────────────────────────────────────────── */

export default function PublicPaymentPage() {
  const params = useParams();
  const paymentId = params?.id;

  const [loading, setLoading] = useState(true);
  const [payment, setPayment] = useState(null);
  const [error, setError] = useState(null);

  // États du mode de secours (validation manuelle)
  const [showManualModal, setShowManualModal] = useState(false);
  const [transactionRef, setTransactionRef] = useState("");
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [manualSuccess, setManualSuccess] = useState(false);

  // État du bouton de paiement GeniusPay
  const [payingGenius, setPayingGenius] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [payError, setPayError] = useState(null);

  // États pour l'envoi automatique du reçu
  const [receiptEmail, setReceiptEmail] = useState("");
  const [sendingReceiptEmail, setSendingReceiptEmail] = useState(false);
  const [receiptEmailSent, setReceiptEmailSent] = useState(false);
  const [receiptToast, setReceiptToast] = useState("");

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

  // 1. Charger les détails du paiement
  const fetchPayment = async () => {
    try {
      const res = await fetch(`/api/payments/${paymentId}`);
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

  useEffect(() => {
    if (!paymentId) return;

    fetchPayment();

    // Polling toutes les 5 secondes si le paiement n'est pas encore finalisé
    const interval = setInterval(async () => {
      const updated = await fetchPayment();
      if (updated?.status === "paye" || updated?.status === "expire") {
        clearInterval(interval);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [paymentId]);

  // 2. Initialisation de la session GeniusPay (support multi-opérateur)
  const handlePayGenius = async (operator = null) => {
    const targetProvider = operator || selectedProvider;
    if (operator) setSelectedProvider(operator);

    setPayError(null);
    setPayingGenius(true);

    try {
      const res = await fetch("/api/create-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId,
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
  };

  // 3. Soumission du mode de secours (ID de transaction manuel)
  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!transactionRef.trim()) return;

    setManualSubmitting(true);
    setPayError(null);

    try {
      const res = await fetch("/api/manual-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId: paymentId,
          manualTxId: transactionRef.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erreur lors de la soumission de la référence.");
      }

      setManualSuccess(true);
      // Mise à jour immédiate du statut local vers "a_verifier"
      setPayment((prev) => (prev ? { ...prev, status: "a_verifier" } : null));
    } catch (err) {
      alert(err.message);
    } finally {
      setManualSubmitting(false);
    }
  };

  // ═══ ÉTAT : CHARGEMENT ═══
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white px-4">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin h-9 w-9 border-3 border-emerald-500 border-t-transparent rounded-full" />
          <p className="text-xs text-slate-400 font-medium tracking-wide">
            Chargement de votre facture sécurisée...
          </p>
        </div>
      </div>
    );
  }

  // ═══ ÉTAT : ERREUR / LIEN INVALIDE ═══
  if (error || !payment) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 text-white">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 text-center space-y-4 shadow-2xl">
          <div className="h-12 w-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto border border-rose-500/20">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h1 className="text-lg font-bold text-white">Facture indisponible</h1>
          <p className="text-xs text-slate-400 leading-relaxed">
            {error || "Ce lien de paiement est invalide ou a été supprimé."}
          </p>
          <div className="pt-2">
            <a
              href="https://wa.me/2250706978570"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-semibold"
            >
              <span>Contacter Kadmiel sur WhatsApp</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Calculs d'état
  const isPaid = payment.status === "paye";
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
    ? (timesUsed >= 1 && !isPaid)
    : (timesUsed >= maxUses && !isPaid);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans py-10 px-4 flex flex-col items-center justify-center selection:bg-emerald-500 selection:text-white relative">
      {/* Halo lumineux d'ambiance */}
      <div className="pointer-events-none fixed inset-0 flex items-center justify-center overflow-hidden">
        <div className="h-[460px] w-[460px] rounded-full bg-emerald-500/10 blur-3xl" />
      </div>

      <div className="relative z-10 max-w-md w-full space-y-6">
        {/* ═══ Header de marque ═══ */}
        <div className="text-center space-y-2.5">
          <div className="h-14 w-14 rounded-2xl bg-black border border-slate-800 shadow-xl mx-auto flex items-center justify-center overflow-hidden">
            <Image
              src="/logo.png"
              alt="Kadmiel Business Logo"
              width={56}
              height={56}
              priority
              className="object-cover"
            />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-white">
              Kadmiel Business Pay
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Facture émise pour{" "}
              <span className="text-white font-semibold">
                {payment.client_name || "Client"}
              </span>
            </p>
          </div>
        </div>

        {/* ═══ Carte Principale ═══ */}
        <div className="bg-slate-900/90 backdrop-blur-xl rounded-3xl border border-slate-800 p-6 sm:p-7 shadow-2xl space-y-5">
          {/* CAS 1 : FACTURE RÉGLÉE AVEC SUCCÈS */}
          {isPaid ? (
            <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-5 text-center space-y-3 animate-slide-up">
              <div className="h-12 w-12 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <p className="text-base font-bold text-emerald-400">
                  Facture réglée avec succès !
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Votre paiement de{" "}
                  <span className="text-white font-semibold">
                    {formatAmount(payment.amount_total)}
                  </span>{" "}
                  a bien été reçu.
                </p>
                {isSingleUse && (
                  <span className="inline-block mt-2 text-[10px] font-semibold text-zinc-400 bg-zinc-800/80 px-2.5 py-0.5 rounded-full border border-zinc-700">
                    Lien à usage unique · Paiement finalisé
                  </span>
                )}
              </div>

              <div className="pt-2 border-t border-emerald-500/20 text-[11px] text-slate-400 flex items-center justify-between">
                <span>Prestation :</span>
                <span className="text-white font-medium">
                  {payment.service_name}
                </span>
              </div>

              {/* Module Reçu Automatique Intégré (Partie 4 & 7) */}
              <div className="pt-3 space-y-3 border-t border-emerald-500/20 text-left">
                {receiptToast && (
                  <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold text-center animate-slide-up flex items-center justify-center gap-1.5">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>{receiptToast}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {/* Consulter le Reçu Officiel en Ligne */}
                  <a
                    href={`/receipt/${payment.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-11 px-3 rounded-xl bg-emerald-500 text-black font-extrabold text-xs flex items-center justify-center gap-2 hover:bg-emerald-400 transition shadow-md shadow-emerald-500/20 active:scale-95 text-center"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Consulter le Reçu Officiel</span>
                  </a>

                  {/* Recevoir sur WhatsApp (1 Clic) */}
                  <button
                    type="button"
                    onClick={handleOpenWhatsAppReceipt}
                    className="h-11 px-3 rounded-xl bg-[#25D366] text-black font-extrabold text-xs flex items-center justify-center gap-2 hover:bg-[#20ba59] transition shadow-md shadow-[#25D366]/20 active:scale-95 text-center"
                  >
                    <MessageCircle className="w-4 h-4 fill-black" />
                    <span>Recevoir sur WhatsApp</span>
                  </button>
                </div>

                {/* Formulaire d'envoi automatique par Email */}
                <div className="p-3.5 rounded-2xl bg-black/60 border border-white/10 space-y-2">
                  <span className="text-[11px] font-semibold text-zinc-300 flex items-center justify-between">
                    <span>Recevoir votre reçu certifié par Email :</span>
                    <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Automatique</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Mail className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        placeholder="votre.email@exemple.com"
                        value={receiptEmail}
                        onChange={(e) => setReceiptEmail(e.target.value)}
                        className="w-full h-9 pl-9 pr-2.5 rounded-xl bg-zinc-900 border border-emerald-500/30 text-white text-xs outline-none focus:border-emerald-400 placeholder:text-zinc-600"
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

                {/* Téléchargement PDF direct (optionnel) */}
                <button
                  type="button"
                  onClick={() => generateReceiptPDF(payment)}
                  className="w-full h-9 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 font-medium text-[11px] transition flex items-center justify-center gap-1.5 border border-white/5"
                >
                  <FileText className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Télécharger également une copie PDF sur cet appareil</span>
                </button>
              </div>
            </div>
          ) : isExpired ? (
            /* CAS 2 : LIEN EXPIRÉ */
            <div className="rounded-2xl bg-rose-500/10 border border-rose-500/30 p-6 text-center space-y-4 animate-slide-up">
              <div className="h-14 w-14 rounded-2xl bg-rose-500/20 text-rose-400 mx-auto flex items-center justify-center border border-rose-500/30">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <div>
                <span className="inline-block text-[10px] uppercase font-bold tracking-wider text-rose-400 bg-rose-950/80 border border-rose-800 px-2.5 py-0.5 rounded-full mb-1.5">
                  Statut : Expiré
                </span>
                <h2 className="text-lg font-black text-white">
                  Ce lien de paiement a expiré
                </h2>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  La date et l'heure limites de validité fixées par le prestataire ont été dépassées. Aucun paiement ne peut plus être initié via ce lien.
                </p>
                {payment.expires_at && (
                  <p className="text-[11px] font-mono text-rose-300 mt-2 bg-rose-950/40 border border-rose-900/40 py-1 px-2.5 rounded-lg inline-block">
                    Expiré le {formatDate(payment.expires_at)}
                  </p>
                )}
              </div>

              <div className="pt-2 border-t border-rose-500/20">
                <a
                  href="https://wa.me/2250706978570?text=Bonjour,%20mon%20lien%20de%20paiement%20a%20expiré,%20pouvez-vous%20m'en%20générer%20un%20nouveau%20?"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full h-11 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 border border-slate-700"
                >
                  <span>Demander un nouveau lien sur WhatsApp</span>
                  <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
                </a>
              </div>
            </div>
          ) : isUsageExceeded ? (
            /* CAS 3 : LIEN DÉJÀ UTILISÉ / QUOTA ATTEINT */
            <div className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-6 text-center space-y-4 animate-slide-up">
              <div className="h-14 w-14 rounded-2xl bg-amber-500/20 text-amber-400 mx-auto flex items-center justify-center border border-amber-500/30">
                <Ban className="w-7 h-7" />
              </div>
              <div>
                <span className="inline-block text-[10px] uppercase font-bold tracking-wider text-amber-400 bg-amber-950/80 border border-amber-800 px-2.5 py-0.5 rounded-full mb-1.5">
                  Lien non réutilisable
                </span>
                <h2 className="text-lg font-black text-white">
                  Ce lien a déjà été utilisé
                </h2>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  {isSingleUse
                    ? "Ce lien de paiement était configuré pour un usage unique et a déjà été validé."
                    : `Ce lien de paiement a atteint son nombre maximal d'utilisations autorisées (${timesUsed}/${maxUses}).`}
                </p>
              </div>

              <div className="pt-2 border-t border-amber-500/20">
                <a
                  href="https://wa.me/2250706978570?text=Bonjour,%20ce%20lien%20de%20paiement%20a%20déjà%20été%20utilisé,%20merci%20de%20vérifier."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full h-11 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 border border-slate-700"
                >
                  <span>Contacter le prestataire sur WhatsApp</span>
                  <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
                </a>
              </div>
            </div>
          ) : isPendingVerification ? (
            /* CAS 4 : PAIEMENT DE SECOURS EN VÉRIFICATION */
            <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-5 text-center space-y-3 animate-slide-up">
              <div className="h-12 w-12 rounded-full bg-amber-500/20 text-amber-400 mx-auto flex items-center justify-center">
                <Clock className="w-7 h-7 animate-pulse" />
              </div>
              <div>
                <p className="text-sm font-bold text-amber-400">
                  Paiement en cours de vérification
                </p>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Votre référence de transaction Mobile Money a été transmise à
                  Kadmiel. Validation imminente dès confirmation du transfert.
                </p>
              </div>
              <div className="pt-2 border-t border-amber-500/20 text-[11px] text-slate-400">
                Vous recevrez une confirmation sous peu.
              </div>
            </div>
          ) : (
            /* CAS 5 : FACTURE EN ATTENTE DE RÈGLEMENT (VALIDE & ACTIVE) */
            <>
              {/* Bannière de validité / échéance si configurée */}
              {payment.expires_at && (
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-2.5 flex items-center justify-between text-xs text-emerald-300">
                  <span className="flex items-center gap-1.5">
                    <CalendarClock className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Validité du lien :</span>
                  </span>
                  <span className="font-semibold text-white font-mono text-[11px]">
                    Expire le {formatDate(payment.expires_at)}
                  </span>
                </div>
              )}

              {/* Information lien multi-usage */}
              {!isSingleUse && maxUses > 1 && (
                <div className="rounded-xl bg-slate-800/60 border border-slate-700/60 px-3 py-1.5 flex items-center justify-between text-[11px] text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <Repeat className="w-3 h-3 text-emerald-400" />
                    <span>Lien multi-usage</span>
                  </span>
                  <span className="font-mono text-emerald-400 font-bold">
                    {timesUsed} / {maxUses} paiements effectués
                  </span>
                </div>
              )}

              {/* Message d'erreur de la passerelle le cas échéant */}
              {payError && (
                <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold">{payError}</p>
                    <p className="text-[11px] text-slate-400">
                      Vous pouvez utiliser le mode de secours ci-dessous pour payer directement.
                    </p>
                  </div>
                </div>
              )}

              {/* Détails de la Prestation & Décomposition */}
              <div className="space-y-3 pb-4 border-b border-slate-800/80">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-1.5">
                    {payment.business_type === "restaurant" ? (
                      <span className="text-sm">🍽️</span>
                    ) : (
                      <Receipt className="w-3.5 h-3.5 text-slate-400" />
                    )}
                    <span>
                      {payment.business_type === "restaurant"
                        ? "Plat / Commande"
                        : "Prestation"}
                    </span>
                  </span>
                  <span className="font-semibold text-slate-200">
                    {payment.service_name}
                  </span>
                </div>

                {isFeeBearerFreelance ? (
                  <>
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>Montant de la prestation</span>
                      <span className="font-semibold text-slate-200">
                        {formatAmount(payment.amount_total)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>Frais de transaction mobile money</span>
                      <span className="font-semibold text-emerald-400 flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block" />
                        Offerts par le prestataire (0 FCFA)
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>Montant de la prestation</span>
                      <span className="font-semibold text-slate-200">
                        {formatAmount(payment.amount_net)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>Frais de passerelle opérateur</span>
                      <span className="font-semibold text-amber-400">
                        +{formatAmount(feeAmount)}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Encadré Total à régler */}
              <div className="bg-black/50 rounded-2xl p-4 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Total à régler
                  </span>
                  <p className="text-xs text-emerald-400 font-medium">
                    {isFeeBearerFreelance
                      ? "Frais de transaction offerts"
                      : "Frais de passerelle inclus"}
                  </p>
                </div>
                <span className="text-2xl font-black text-white tracking-tight">
                  {formatAmount(payment.amount_total)}
                </span>
              </div>

              {/* ═══ BOUTONS DE PAIEMENT MOBILE MONEY (WAVE, ORANGE, MTN, MOOV) ═══ */}
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Régler avec votre compte Mobile Money :</span>
                  </span>
                  <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    Instantané
                  </span>
                </div>

                {/* Grille tactile des 4 opérateurs ivoiriens */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    {
                      id: "wave",
                      name: "Wave",
                      icon: "🌊",
                      accent: "text-[#00A3FF]",
                      border: "border-[#00A3FF]/30 hover:border-[#00A3FF] hover:bg-[#00A3FF]/10",
                    },
                    {
                      id: "orange",
                      name: "Orange Money",
                      icon: "🍊",
                      accent: "text-[#FF7900]",
                      border: "border-[#FF7900]/30 hover:border-[#FF7900] hover:bg-[#FF7900]/10",
                    },
                    {
                      id: "mtn",
                      name: "MTN MoMo",
                      icon: "🟡",
                      accent: "text-[#FFCC00]",
                      border: "border-[#FFCC00]/30 hover:border-[#FFCC00] hover:bg-[#FFCC00]/10",
                    },
                    {
                      id: "moov",
                      name: "Moov Money",
                      icon: "🟣",
                      accent: "text-[#0089cf]",
                      border: "border-[#0089cf]/30 hover:border-[#0089cf] hover:bg-[#0089cf]/10",
                    },
                  ].map((op) => {
                    const isSelected = selectedProvider === op.id;
                    return (
                      <button
                        key={op.id}
                        type="button"
                        onClick={() => handlePayGenius(op.id)}
                        disabled={payingGenius}
                        className={`p-3 rounded-2xl border transition-all flex flex-col items-center justify-center gap-1 active:scale-95 disabled:opacity-50 shadow-sm ${
                          isSelected
                            ? "border-emerald-400 bg-emerald-500/15 ring-2 ring-emerald-400/50"
                            : `${op.border} bg-slate-950/80`
                        }`}
                      >
                        <span className="text-xl">{op.icon}</span>
                        <span className={`text-xs font-bold ${op.accent}`}>{op.name}</span>
                        <span className="text-[9px] text-slate-500 font-medium">Côte d'Ivoire</span>
                      </button>
                    );
                  })}
                </div>

                {/* Bouton de confirmation principal */}
                <button
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
                        {selectedProvider ? ` avec ${selectedProvider.toUpperCase()}` : ""}
                      </span>
                      <ArrowRight className="w-4 h-4 text-slate-950" />
                    </>
                  )}
                </button>
              </div>

              {/* ═══ MODE DE SECOURS (Validation Manuelle) ═══ */}
              <div className="pt-2 text-center border-t border-slate-800/60">
                <button
                  type="button"
                  onClick={() => setShowManualModal(!showManualModal)}
                  className="text-xs text-slate-400 hover:text-slate-200 underline transition-colors"
                >
                  {showManualModal
                    ? "Masquer le mode de secours"
                    : "Problème avec la passerelle ? Utiliser le mode de secours (ID SMS)"}
                </button>

                {showManualModal && (
                  <form
                    onSubmit={handleManualSubmit}
                    className="mt-4 p-4 bg-black/60 rounded-2xl border border-slate-800 space-y-3 text-left animate-slide-up"
                  >
                    <div className="flex items-start gap-2">
                      <Smartphone className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-slate-200">
                          Transfert manuel direct
                        </p>
                        <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">
                          Si vous avez envoyé les fonds directement au prestataire,
                          saisissez ici l'ID ou la référence reçue par SMS.
                        </p>
                      </div>
                    </div>

                    <input
                      type="text"
                      placeholder="Ex : PP260309.1234.A12345 ou CI240501..."
                      value={transactionRef}
                      onChange={(e) => setTransactionRef(e.target.value)}
                      required
                      className="w-full h-10 px-3 text-xs rounded-xl bg-slate-900 border border-slate-700 text-white outline-none focus:border-emerald-500 font-mono transition-colors"
                    />

                    <button
                      type="submit"
                      disabled={manualSubmitting || manualSuccess}
                      className="w-full h-10 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-60 text-xs font-bold text-white transition-colors flex items-center justify-center gap-2"
                    >
                      {manualSubmitting ? (
                        <>
                          <div className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />
                          <span>Transmission en cours...</span>
                        </>
                      ) : manualSuccess ? (
                        "Transmis avec succès !"
                      ) : (
                        "Soumettre ma référence pour validation"
                      )}
                    </button>
                  </form>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer Sécurité */}
        <div className="text-center space-y-1">
          <p className="text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Paiement chiffré SSL 256 bits · Vérification instantanée</span>
          </p>
          <p className="text-[10px] text-slate-600">
            Kadmiel Business Pay · Abidjan, Côte d'Ivoire
          </p>
        </div>
      </div>
    </div>
  );
}