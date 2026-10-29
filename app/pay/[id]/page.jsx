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
  const [payError, setPayError] = useState(null);

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
      if (updated?.status === "paye") {
        clearInterval(interval);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [paymentId]);

  // 2. Initialisation de la session GeniusPay et redirection
  const handlePayGenius = async () => {
    setPayError(null);
    setPayingGenius(true);

    try {
      const res = await fetch("/api/create-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId }),
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
            {error || "Ce lien de paiement est invalide, a été supprimé ou a expiré."}
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

  const isPaid = payment.status === "paye";
  const isPendingVerification = payment.status === "a_verifier";
  const feeAmount = (payment.amount_total || 0) - (payment.amount_net || 0);

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
              </div>

              <div className="pt-2 border-t border-emerald-500/20 text-[11px] text-slate-400 flex items-center justify-between">
                <span>Prestation :</span>
                <span className="text-white font-medium">
                  {payment.service_name}
                </span>
              </div>

              {/* Bouton Téléchargement Reçu PDF officiel */}
              <button
                type="button"
                onClick={() => generateReceiptPDF(payment)}
                className="w-full mt-2 h-11 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 font-bold text-xs transition-all flex items-center justify-center gap-2"
              >
                <FileText className="w-4 h-4 text-emerald-400" />
                <span>Télécharger mon reçu officiel (PDF)</span>
              </button>
            </div>
          ) : isPendingVerification ? (
            /* CAS 2 : PAIEMENT DE SECOURS EN VÉRIFICATION */
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
            /* CAS 3 : FACTURE EN ATTENTE DE RÈGLEMENT */
            <>
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
                    <Receipt className="w-3.5 h-3.5 text-slate-400" />
                    Prestation
                  </span>
                  <span className="font-semibold text-slate-200">
                    {payment.service_name}
                  </span>
                </div>

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
              </div>

              {/* Encadré Total à régler */}
              <div className="bg-black/50 rounded-2xl p-4 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Total à régler
                  </span>
                  <p className="text-xs text-emerald-400 font-medium">
                    Frais de passerelle inclus
                  </p>
                </div>
                <span className="text-2xl font-black text-white tracking-tight">
                  {formatAmount(payment.amount_total)}
                </span>
              </div>

              {/* Bouton de Paiement Principal (GeniusPay) */}
              <button
                onClick={handlePayGenius}
                disabled={payingGenius}
                className="w-full h-13 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.99] disabled:opacity-60 text-slate-950 font-bold text-sm transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
              >
                {payingGenius ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-slate-950 border-t-transparent rounded-full" />
                    <span>Redirection sécurisée en cours...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4 text-slate-950" />
                    <span>Payer par Wave / Orange / MTN</span>
                    <ArrowRight className="w-4 h-4 text-slate-950" />
                  </>
                )}
              </button>

              {/* Badges des opérateurs acceptés */}
              <div className="pt-1 flex items-center justify-center gap-2 text-[10px] text-slate-400 flex-wrap">
                <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700/80 font-semibold text-slate-300">
                  Wave
                </span>
                <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700/80 font-semibold text-slate-300">
                  Orange Money
                </span>
                <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700/80 font-semibold text-slate-300">
                  MTN MoMo
                </span>
                <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700/80 font-semibold text-slate-300">
                  Moov Money
                </span>
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