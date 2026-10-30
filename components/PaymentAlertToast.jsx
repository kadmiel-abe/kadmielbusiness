"use client";

import React, { useEffect, useState } from "react";
import { useNotifications } from "@/context/NotificationContext";
import {
  Coins,
  ShieldCheck,
  AlertTriangle,
  X,
  ExternalLink,
  Sparkles,
  ArrowRight,
} from "lucide-react";

export default function PaymentAlertToast() {
  const { activeAlert, dismissAlert } = useNotifications();
  const [progress, setProgress] = useState(100);

  // Auto-fermeture après 7 secondes avec décompte visuel fluide
  useEffect(() => {
    if (!activeAlert) {
      setProgress(100);
      return;
    }

    const duration = 7000;
    const intervalTime = 50;
    const step = (intervalTime / duration) * 100;

    setProgress(100);

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev <= step) {
          clearInterval(timer);
          dismissAlert();
          return 0;
        }
        return prev - step;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [activeAlert, dismissAlert]);

  if (!activeAlert) return null;

  const isEncaissement = activeAlert.type === "encaissement";
  const formattedAmount =
    new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(
      activeAlert.amount || 0
    ) + " FCFA";

  const handleGoToTransaction = () => {
    dismissAlert();
    if (typeof window !== "undefined") {
      const el = document.getElementById("transactions");
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
      }
    }
  };

  return (
    <aside
      aria-label="Notification d'encaissement"
      className="fixed bottom-5 right-5 sm:bottom-8 sm:right-8 z-50 max-w-sm w-full animate-slide-up"
    >
      <div className="relative overflow-hidden rounded-2xl bg-zinc-950/95 backdrop-blur-2xl border border-emerald-500/40 shadow-2xl shadow-emerald-500/20 p-4 sm:p-5">
        {/* Halo lumineux d'accentuation émeraude */}
        <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-emerald-500/20 blur-2xl" />

        <div className="flex items-start gap-3.5 relative z-10">
          {/* Icône animée */}
          <div
            className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 border shadow-lg ${
              isEncaissement
                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-emerald-500/20 animate-bounce-short"
                : "bg-amber-500/20 text-amber-400 border-amber-500/40"
            }`}
          >
            {isEncaissement ? (
              <Coins className="h-6 w-6 text-emerald-400" />
            ) : (
              <AlertTriangle className="h-6 w-6 text-amber-400" />
            )}
          </div>

          <div className="flex-1 min-w-0 pr-6">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                  isEncaissement
                    ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                    : "bg-amber-500/15 text-amber-300 border-amber-500/30"
                }`}
              >
                {isEncaissement ? "Encaissement En Direct" : "Action Requise"}
              </span>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
            </div>

            <p className="mt-1 text-base font-black text-white tracking-tight flex items-baseline gap-1.5">
              <span>{isEncaissement ? "+" : ""}{formattedAmount}</span>
              <span className="text-[11px] font-medium text-emerald-400">
                {isEncaissement ? "reçu instantanément" : "à vérifier"}
              </span>
            </p>

            <p className="mt-0.5 text-xs text-zinc-300 truncate font-semibold">
              {activeAlert.clientName}
            </p>
            <p className="text-[11px] text-zinc-500 truncate">
              {activeAlert.serviceName}
            </p>

            {/* Actions rapides */}
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={handleGoToTransaction}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-black bg-emerald-400 hover:bg-emerald-300 px-3 py-1.5 rounded-lg transition-all active:scale-95 shadow-sm"
              >
                <span>Voir la facture</span>
                <ArrowRight className="h-3 w-3" />
              </button>

              {activeAlert.paymentId && (
                <a
                  href={`/pay/${activeAlert.paymentId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-400 hover:text-white px-2 py-1.5 rounded-lg hover:bg-zinc-900 transition"
                >
                  <ExternalLink className="h-3 w-3" />
                  <span>Page client</span>
                </a>
              )}
            </div>
          </div>

          {/* Bouton Fermer */}
          <button
            type="button"
            onClick={dismissAlert}
            aria-label="Fermer l'alerte"
            className="absolute top-0 right-0 p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Barre de progression décompte visuel */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-zinc-900 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-300 transition-all duration-75"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </aside>
  );
}
