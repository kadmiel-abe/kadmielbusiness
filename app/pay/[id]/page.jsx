"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import {
  ShieldCheck,
  Sparkles,
  Coins,
  Briefcase,
  User,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Clock
} from "lucide-react";

function formatAmount(amount) {
  if (amount == null || isNaN(amount) || amount <= 0) return "0 FCFA";
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(amount) + " FCFA";
}

export default function PublicPaymentPage() {
  const params = useParams();
  const paymentId = params?.id;

  const [loading, setLoading] = useState(true);
  const [payment, setPayment] = useState(null);
  const [error, setError] = useState(null);

  // États pour le mode de secours (validation manuelle)
  const [showManualModal, setShowManualModal] = useState(false);
  const [transactionRef, setTransactionRef] = useState("");
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [manualSuccess, setManualSuccess] = useState(false);
  const [payingGenius, setPayingGenius] = useState(false);

  // Charger les détails du paiement
  useEffect(() => {
    async function fetchPayment() {
      try {
        const res = await fetch(`/api/payments/${paymentId}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Impossible de charger les détails du paiement.");
        }

        setPayment(data.payment);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    if (paymentId) {
      fetchPayment();
    }
  }, [paymentId]);

  // Initialisation de la session GeniusPay et redirection sécurisée
  const handlePayGenius = async () => {
    try {
      setPayingGenius(true);
      const res = await fetch("/api/create-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Impossible d'initialiser le paiement.");
      }

      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        throw new Error("L'adresse de redirection n'a pas été fournie.");
      }
    } catch (err) {
      alert(err.message || "Erreur lors de l'accès à la passerelle de paiement.");
    } finally {
      setPayingGenius(false);
    }
  };

  // Soumission du mode de secours (ID de transaction manuel)
  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!transactionRef.trim()) return;

    setManualSubmitting(true);
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
      if (!res.ok) throw new Error(data.error || "Erreur lors de la soumission.");

      setManualSuccess(true);
    } catch (err) {
      alert(err.message);
    } finally {
      setManualSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
          <p className="text-xs text-slate-400 font-medium">Chargement de votre facture sécurisée...</p>
        </div>
      </div>
    );
  }

  if (error || !payment) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 text-white">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 text-center space-y-4">
          <div className="h-12 w-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h1 className="text-lg font-bold">Lien indisponible</h1>
          <p className="text-xs text-slate-400">{error || "Ce lien de paiement n'existe pas ou a expiré."}</p>
        </div>
      </div>
    );
  }

  const isPaid = payment.status === "paye";
  const isPendingVerification = payment.status === "a_verifier";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans py-8 px-4 flex flex-col items-center justify-center selection:bg-emerald-500 selection:text-white">
      {/* Ambiance lumineuse */}
      <div className="pointer-events-none fixed inset-0 flex items-center justify-center overflow-hidden">
        <div className="h-[400px] w-[400px] rounded-full bg-emerald-500/10 blur-3xl" />
      </div>

      <div className="relative z-10 max-w-md w-full space-y-6">
        {/* En-tête / Logo */}
        <div className="text-center space-y-2">
          <div className="h-14 w-14 rounded-2xl bg-black border border-slate-800 shadow-xl mx-auto flex items-center justify-center overflow-hidden">
            <Image src="/logo.png" alt="Logo" width={56} height={56} className="object-cover" />
          </div>
          <h1 className="text-xl font-black tracking-tight">Paiement Sécurisé</h1>
          <p className="text-xs text-slate-400">Facture émise pour <span className="text-white font-semibold">{payment.client_name}</span></p>
        </div>

        {/* Carte de Facturation */}
        <div className="bg-slate-900/90 backdrop-blur-xl rounded-3xl border border-slate-800 p-6 shadow-2xl space-y-5">
          {/* Statut si déjà payé */}
          {isPaid ? (
            <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
              <p className="text-sm font-bold text-emerald-400">Facture réglée avec succès !</p>
              <p className="text-xs text-slate-400">Merci pour votre confiance. Le reçu a été transmis.</p>
            </div>
          ) : isPendingVerification ? (
            <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-4 text-center space-y-2">
              <Clock className="w-8 h-8 text-amber-400 mx-auto animate-pulse" />
              <p className="text-sm font-bold text-amber-400">Paiement en cours de vérification</p>
              <p className="text-xs text-slate-400">Votre référence a été transmise. Validation imminente.</p>
            </div>
          ) : (
            <>
              {/* Détails de la Prestation */}
              <div className="space-y-3 pb-4 border-b border-slate-800">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Prestation</span>
                  <span className="font-semibold text-slate-200">{payment.service_name}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Montant net prestataire</span>
                  <span className="font-semibold text-slate-200">{formatAmount(payment.amount_net)}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Frais de passerelle</span>
                  <span className="font-semibold text-amber-400">+{formatAmount(payment.amount_total - payment.amount_net)}</span>
                </div>
              </div>

              {/* Total à payer */}
              <div className="bg-black/40 rounded-2xl p-4 border border-slate-800/80 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total à régler</span>
                  <p className="text-xs text-emerald-400">Tous moyens de paiement inclus</p>
                </div>
                <span className="text-xl font-black text-white">{formatAmount(payment.amount_total)}</span>
              </div>

              {/* Bouton de Paiement Principal */}
              <button
                onClick={handlePayGenius}
                disabled={payingGenius}
                className="w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-slate-950 font-bold text-sm transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
              >
                <span>{payingGenius ? "Initialisation du paiement..." : "Payer par Wave / Orange / MTN"}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {/* Mode de Secours (Validation Manuelle) */}
              <div className="pt-2 text-center">
                <button
                  onClick={() => setShowManualModal(!showManualModal)}
                  className="text-xs text-slate-400 hover:text-slate-200 underline transition-colors"
                >
                  Problème avec la passerelle ? Utiliser le mode de secours (ID de transaction)
                </button>

                {showManualModal && (
                  <form onSubmit={handleManualSubmit} className="mt-4 p-4 bg-black/60 rounded-2xl border border-slate-800 space-y-3 text-left animate-slide-up">
                    <p className="text-xs font-semibold text-slate-300">Entrez l'ID de votre transaction Mobile Money :</p>
                    <input
                      type="text"
                      placeholder="Ex: PP260309.1234.A12345"
                      value={transactionRef}
                      onChange={(e) => setTransactionRef(e.target.value)}
                      required
                      className="w-full h-10 px-3 text-xs rounded-lg bg-slate-900 border border-slate-700 text-white outline-none focus:border-emerald-500 font-mono"
                    />
                    <button
                      type="submit"
                      disabled={manualSubmitting || manualSuccess}
                      className="w-full h-9 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white transition-colors flex items-center justify-center gap-2"
                    >
                      {manualSubmitting ? "Envoi..." : manualSuccess ? "Transmis avec succès !" : "Soumettre pour validation"}
                    </button>
                    {manualSuccess && (
                      <p className="text-[10px] text-emerald-400 text-center">Votre référence a été transmise à Kadmiel. Il va valider d'ici quelques instants.</p>
                    )}
                  </form>
                )}
              </div>
            </>
          )}
        </div>

        <p className="text-center text-[11px] text-slate-500">
          Propulsé par Kadmiel Business Pay · Sécurisé par SSL
        </p>
      </div>
    </div>
  );
}