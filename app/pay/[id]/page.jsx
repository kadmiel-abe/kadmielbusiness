"use client";

import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

/* ──────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────── */

/** Formate un montant en "XX XXX FCFA" */
function formatAmount(amount) {
  if (amount == null || isNaN(amount)) return "—";
  return (
    new Intl.NumberFormat("fr-FR", {
      maximumFractionDigits: 0,
    }).format(amount) + " FCFA"
  );
}

/* ──────────────────────────────────────────────
   Composants internes
   ────────────────────────────────────────────── */

/** Spinner SVG réutilisable */
function Spinner({ className = "h-5 w-5" }) {
  return (
    <svg
      className={`animate-spin ${className}`}
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
  );
}

/** Skeleton de chargement initial */
function LoadingSkeleton() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-8 animate-pulse">
          {/* Header skeleton */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-slate-200 rounded-xl" />
            <div>
              <div className="h-4 w-28 bg-slate-200 rounded mb-2" />
              <div className="h-3 w-36 bg-slate-100 rounded" />
            </div>
          </div>

          {/* Details skeleton */}
          <div className="space-y-5 mb-8">
            <div>
              <div className="h-3 w-16 bg-slate-100 rounded mb-2" />
              <div className="h-4 w-40 bg-slate-200 rounded" />
            </div>
            <div>
              <div className="h-3 w-16 bg-slate-100 rounded mb-2" />
              <div className="h-4 w-52 bg-slate-200 rounded" />
            </div>
          </div>

          {/* Amount skeleton */}
          <div className="border-t border-slate-100 pt-5 space-y-3 mb-8">
            <div className="flex justify-between">
              <div className="h-3 w-24 bg-slate-100 rounded" />
              <div className="h-3 w-20 bg-slate-200 rounded" />
            </div>
            <div className="flex justify-between">
              <div className="h-3 w-28 bg-slate-100 rounded" />
              <div className="h-3 w-16 bg-slate-200 rounded" />
            </div>
            <div className="flex justify-between pt-3 border-t border-slate-100">
              <div className="h-5 w-16 bg-slate-200 rounded" />
              <div className="h-5 w-24 bg-slate-200 rounded" />
            </div>
          </div>

          {/* Button skeleton */}
          <div className="h-14 bg-slate-200 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

/** Écran de succès (paiement déjà validé) */
function SuccessScreen({ payment }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-emerald-50 p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="bg-white rounded-2xl shadow-lg border border-emerald-100 p-8 text-center">
          {/* Icône succès */}
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
            <svg className="h-8 w-8 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>

          <h1 className="text-xl font-bold text-slate-900 mb-2">Paiement confirmé</h1>
          <p className="text-slate-500 text-sm mb-6">
            Votre paiement de{" "}
            <span className="font-semibold text-slate-700">
              {formatAmount(payment.amount_total)}
            </span>{" "}
            a bien été reçu.
          </p>

          <div className="bg-emerald-50 rounded-xl p-4 text-left text-sm space-y-1">
            <p className="text-slate-500">
              Service : <span className="font-medium text-slate-700">{payment.service_name || "—"}</span>
            </p>
            <p className="text-slate-500">
              Référence : <span className="font-mono text-xs text-slate-600">{payment.id}</span>
            </p>
          </div>

          <p className="mt-6 text-xs text-slate-400">Merci pour votre confiance.</p>
        </div>
      </div>
    </div>
  );
}

/** Écran de vérification en cours */
function VerificationScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 via-white to-amber-50 p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="bg-white rounded-2xl shadow-lg border border-amber-100 p-8 text-center">
          {/* Icône horloge */}
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
            <svg className="h-8 w-8 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>

          <h1 className="text-xl font-bold text-slate-900 mb-2">Vérification en cours</h1>
          <p className="text-slate-500 text-sm leading-relaxed">
            Votre identifiant de transaction a été enregistré. Notre équipe vérifie votre
            paiement. Vous recevrez une confirmation sous peu.
          </p>

          <div className="mt-6 flex items-center justify-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse [animation-delay:150ms]" />
            <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse [animation-delay:300ms]" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Écran d'erreur */
function ErrorScreen({ message }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 via-white to-red-50 p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="bg-white rounded-2xl shadow-lg border border-red-100 p-8 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <svg className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>

          <h1 className="text-xl font-bold text-slate-900 mb-2">Erreur</h1>
          <p className="text-slate-500 text-sm">{message}</p>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────
   Page principale
   ────────────────────────────────────────────── */

export default function PaymentPage() {
  const params = useParams();
  const paymentId = params.id;
  const supabase = createClientComponentClient();

  /* — State — */
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [paying, setPaying] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manualTxId, setManualTxId] = useState("");
  const [submittingManual, setSubmittingManual] = useState(false);
  const [manualSubmitted, setManualSubmitted] = useState(false);

  /* — Fetch du paiement — */
  useEffect(() => {
    async function fetchPayment() {
      try {
        const { data, error: dbError } = await supabase
          .from("payments")
          .select("*, client:clients(*)")
          .eq("id", paymentId)
          .single();

        if (dbError || !data) {
          setError("Ce lien de paiement est invalide ou a expiré.");
        } else {
          setPayment(data);
        }
      } catch {
        setError("Impossible de charger les informations de paiement.");
      }
      setLoading(false);
    }

    if (paymentId) fetchPayment();
  }, [paymentId, supabase]);

  /* — Paiement via GeniusPay — */
  const handlePay = async () => {
    setPaying(true);
    setError(null);
    try {
      const res = await fetch("/api/create-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId }),
      });

      const data = await res.json();

      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        setError(data.error || "Impossible d'initialiser le paiement. Veuillez réessayer.");
        setPaying(false);
      }
    } catch {
      setError("Erreur de connexion. Vérifiez votre réseau et réessayez.");
      setPaying(false);
    }
  };

  /* — Soumission manuelle de l'ID de transaction — */
  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!manualTxId.trim()) return;
    setSubmittingManual(true);
    setError(null);

    try {
      const res = await fetch("/api/manual-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId, manualTxId: manualTxId.trim() }),
      });

      if (res.ok) {
        setManualSubmitted(true);
      } else {
        const data = await res.json();
        setError(data.error || "Erreur lors de la soumission.");
      }
    } catch {
      setError("Erreur de connexion au serveur.");
    }
    setSubmittingManual(false);
  };

  /* — Rendu conditionnel — */

  if (loading) return <LoadingSkeleton />;

  if (error && !payment) return <ErrorScreen message={error} />;

  if (manualSubmitted || payment?.status === "a_verifier") return <VerificationScreen />;

  if (payment?.status === "paye") return <SuccessScreen payment={payment} />;

  /* — Calculs — */
  const amountNet = payment.amount_net ?? payment.amount_total ?? 0;
  const amountTotal = payment.amount_total ?? 0;
  const fees = amountTotal - amountNet;
  const customerName =
    payment.client?.name ||
    payment.customer_name ||
    payment.client_name ||
    payment.name ||
    "—";
  const serviceName = payment.service_name || "Prestation de service";

  /* ─── UI principale ─── */
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 p-4">
      <div className="w-full max-w-md animate-slide-up">
        <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-slate-100 overflow-hidden">

          {/* ═══ En-tête ═══ */}
          <div className="px-7 pt-7 pb-5">
            <div className="flex items-center gap-3">
              {/* Logo / icône */}
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white font-bold text-lg select-none">
                K
              </div>
              <div>
                <h1 className="text-[15px] font-bold text-slate-900 tracking-tight">
                  Kadmiel ABE
                </h1>
                <p className="text-xs text-slate-400 font-medium">
                  Facture de paiement
                </p>
              </div>
            </div>
          </div>

          {/* ═══ Détails client & service ═══ */}
          <div className="px-7 pb-5">
            <div className="grid grid-cols-2 gap-5">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Client
                </p>
                <p className="text-sm font-semibold text-slate-800">
                  {customerName}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Service
                </p>
                <p className="text-sm font-semibold text-slate-800">
                  {serviceName}
                </p>
              </div>
            </div>
          </div>

          {/* ═══ Récapitulatif financier ═══ */}
          <div className="mx-7 border-t border-dashed border-slate-200" />

          <div className="px-7 py-5 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Montant net</span>
              <span className="font-medium text-slate-700">
                {formatAmount(amountNet)}
              </span>
            </div>

            {fees > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Frais de transaction</span>
                <span className="font-medium text-slate-700">
                  {formatAmount(fees)}
                </span>
              </div>
            )}

            {/* Ligne du total */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                Total
              </span>
              <span className="text-lg font-extrabold text-slate-900">
                {formatAmount(amountTotal)}
              </span>
            </div>
          </div>

          {/* ═══ Bouton de paiement ═══ */}
          <div className="px-7 pb-4">
            {error && (
              <div className="mb-4 rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <button
              id="pay-button"
              onClick={handlePay}
              disabled={paying}
              className="group relative w-full flex items-center justify-center gap-2.5 h-14 rounded-xl bg-slate-900 text-white font-semibold text-[15px] transition-all duration-200 hover:bg-black hover:shadow-lg hover:shadow-slate-900/20 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:shadow-none"
            >
              {paying ? (
                <>
                  <Spinner className="h-5 w-5 text-white" />
                  <span>Redirection…</span>
                </>
              ) : (
                <>
                  {/* Icône carte */}
                  <svg
                    className="h-5 w-5 text-white/80 transition-transform duration-200 group-hover:scale-110"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="2"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z"
                    />
                  </svg>
                  <span>Payer maintenant</span>
                </>
              )}
            </button>
          </div>

          {/* ═══ Badge sécurité ═══ */}
          <div className="px-7 pb-4 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
            <span>Paiement sécurisé via GeniusPay</span>
          </div>

          {/* ═══ Mode de secours ═══ */}
          <div className="border-t border-slate-100 px-7 py-4">
            {!showManual ? (
              <button
                id="fallback-link"
                onClick={() => setShowManual(true)}
                className="w-full text-center text-xs text-slate-400 hover:text-slate-600 transition-colors duration-200 underline underline-offset-2 decoration-dotted"
              >
                Un problème technique ? J&apos;ai déjà payé
              </button>
            ) : (
              <div className="animate-fade-in">
                <p className="text-xs text-slate-500 mb-3 text-center leading-relaxed">
                  Saisissez l&apos;identifiant de transaction reçu par SMS pour que
                  nous puissions vérifier votre paiement manuellement.
                </p>

                <form onSubmit={handleManualSubmit} className="space-y-3">
                  <input
                    id="manual-tx-input"
                    type="text"
                    placeholder="Ex : MP240101.1234.A56789"
                    value={manualTxId}
                    onChange={(e) => setManualTxId(e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition-all duration-200 focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-200"
                  />

                  <button
                    id="manual-submit-button"
                    type="submit"
                    disabled={submittingManual || !manualTxId.trim()}
                    className="w-full flex items-center justify-center gap-2 h-11 rounded-xl bg-slate-100 text-slate-700 text-sm font-semibold transition-all duration-200 hover:bg-slate-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submittingManual ? (
                      <>
                        <Spinner className="h-4 w-4 text-slate-500" />
                        <span>Envoi…</span>
                      </>
                    ) : (
                      "Envoyer pour vérification"
                    )}
                  </button>
                </form>

                <button
                  onClick={() => setShowManual(false)}
                  className="mt-2 w-full text-center text-[11px] text-slate-400 hover:text-slate-500 transition-colors"
                >
                  ← Retour
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ═══ Footer discret ═══ */}
        <p className="mt-5 text-center text-[11px] text-slate-300">
          Kadmiel ABE · Services Professionnels
        </p>
      </div>
    </div>
  );
}
