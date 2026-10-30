"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  Clock,
  Clock3,
  CalendarDays,
  Wallet,
  CheckCircle2,
  Users,
  Smartphone,
  ArrowRight,
  RefreshCw,
  FileSpreadsheet,
  Zap,
  Award,
  ChevronRight,
  Layers,
  Sparkles,
  HelpCircle,
  ExternalLink,
  MessageCircle,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  X,
  PieChart as PieIcon,
  BarChart3,
  Percent,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";

/* ─────────────────────────────────────────────────────────────
   HELPERS FORMATAGE & COULEURS
   ───────────────────────────────────────────────────────────── */

function formatAmount(value) {
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(
    Number(value) || 0
  )} FCFA`;
}

function formatShortAmount(value) {
  const num = Number(value) || 0;
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(0)}k`;
  }
  return String(num);
}

const OPERATOR_THEMES = {
  wave: {
    label: "Wave",
    bg: "bg-sky-500/15 border-sky-500/30 text-sky-400",
    barColor: "#00A3FF",
    badgeBg: "bg-sky-500/20 text-sky-300 border-sky-500/40",
  },
  orange: {
    label: "Orange Money",
    bg: "bg-amber-500/15 border-amber-500/30 text-amber-400",
    barColor: "#FF7900",
    badgeBg: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  },
  mtn: {
    label: "MTN MoMo",
    bg: "bg-yellow-500/15 border-yellow-500/30 text-yellow-400",
    barColor: "#FFCC00",
    badgeBg: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
  },
  moov: {
    label: "Moov Money",
    bg: "bg-blue-600/15 border-blue-600/30 text-blue-400",
    barColor: "#0055A5",
    badgeBg: "bg-blue-600/20 text-blue-300 border-blue-600/40",
  },
};

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-emerald-500/30 bg-black/95 px-3.5 py-2.5 shadow-2xl backdrop-blur-md">
      <p className="text-[11px] font-medium text-zinc-400">{label}</p>
      <p className="text-sm font-extrabold text-emerald-400">
        {formatAmount(payload[0].value)}
      </p>
    </div>
  );
}

export default function AnalyticsDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [analyticsData, setAnalyticsData] = useState(null);

  // Filtre temporel
  const [periodPreset, setPeriodPreset] = useState("month"); // 'today' | 'week' | 'month' | 'quarter' | 'year' | 'all' | 'custom'
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  // Mode d'affichage graphique opérateurs ('amount' ou 'volume')
  const [operatorMetric, setOperatorMetric] = useState("amount"); // 'amount' | 'volume'

  const fetchAnalytics = useCallback(
    async (showSpinner = true) => {
      if (showSpinner) setLoading(true);
      else setRefreshing(true);
      setError(null);

      try {
        const queryParams = new URLSearchParams({
          period: periodPreset,
        });
        if (periodPreset === "custom") {
          if (customStartDate) queryParams.set("startDate", customStartDate);
          if (customEndDate) queryParams.set("endDate", customEndDate);
        }

        const res = await fetch(`/api/analytics?${queryParams.toString()}`);
        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(
            data.error || "Impossible de charger les indicateurs analytiques."
          );
        }

        setAnalyticsData(data.analytics);
      } catch (err) {
        console.error("[Analytics Page] Erreur :", err);
        setError(err.message || "Erreur de connexion au serveur.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [periodPreset, customStartDate, customEndDate]
  );

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Écoute des événements de paiement en temps réel pour actualisation transparente
  useEffect(() => {
    const handleRealtimePayment = () => {
      fetchAnalytics(false);
    };
    window.addEventListener("kadmiel:payment-event", handleRealtimePayment);
    return () => {
      window.removeEventListener("kadmiel:payment-event", handleRealtimePayment);
    };
  }, [fetchAnalytics]);

  // Données déstructurées avec fallbacks
  const delayStats = analyticsData?.delay_stats || {};
  const growth = analyticsData?.revenue_growth || {};
  const paymentMethods = analyticsData?.payment_methods || [];
  const topServices = analyticsData?.top_services || [];
  const topClients = analyticsData?.top_clients || [];
  const summary = analyticsData?.summary || {};

  // Données préparées pour le graphique Donut Recharts des opérateurs
  const operatorChartData = useMemo(() => {
    return paymentMethods.map((m) => {
      const theme = OPERATOR_THEMES[m.operator_code] || {
        barColor: m.color || "#00A3FF",
      };
      return {
        name: m.operator_label,
        value: operatorMetric === "amount" ? m.total_amount : m.transactions_count,
        percentage:
          operatorMetric === "amount"
            ? m.amount_percentage
            : m.volume_percentage,
        color: theme.barColor,
        code: m.operator_code,
        count: m.transactions_count,
        amount: m.total_amount,
        avgTicket: m.average_ticket,
      };
    });
  }, [paymentMethods, operatorMetric]);

  // Export CSV rapide des données analytiques
  const handleExportCSV = () => {
    if (!analyticsData) return;
    try {
      const rows = [
        ["RAPPORT ANALYTIQUE ET PILOTAGE FINANCIER — KADMIEL BUSINESS PAY"],
        ["Généré le", new Date().toLocaleString("fr-FR")],
        ["Période", periodPreset],
        [],
        ["1. INDICATEURS CLÉS"],
        ["Chiffre d'Affaires Net Encaissé", summary.period_revenue || 0],
        ["Transactions Validées", summary.period_transactions_count || 0],
        ["Ticket Moyen", summary.average_ticket || 0],
        ["Délai Moyen de Règlement", delayStats.formatted_avg_delay || "-"],
        ["Croissance MoM (%)", `${growth.growth_rate_pct || 0}%`],
        [],
        ["2. RÉPARTITION PAR OPÉRATEUR MOBILE MONEY"],
        ["Opérateur", "Volume (Tx)", "Part Volume (%)", "Montant Total (FCFA)", "Part CA (%)"],
        ...paymentMethods.map((m) => [
          m.operator_label,
          m.transactions_count,
          `${m.volume_percentage}%`,
          m.total_amount,
          `${m.amount_percentage}%`,
        ]),
        [],
        ["3. TOP DES SERVICES LES PLUS RENTABLES"],
        ["Prestation", "Chiffre d'Affaires (FCFA)", "Nombre de ventes", "Part dans le CA (%)", "Ticket moyen"],
        ...topServices.map((s) => [
          s.service_name,
          s.total_revenue,
          s.transactions_count,
          `${s.revenue_percentage}%`,
          s.average_ticket,
        ]),
        [],
        ["4. TOP DES MEILLEURS CLIENTS"],
        ["Client", "Téléphone", "Email", "Total Dépensé (FCFA)", "Nombre de transactions", "Délai moyen (h)"],
        ...topClients.map((c) => [
          c.client_name,
          c.client_phone,
          c.client_email || "-",
          c.total_revenue,
          c.transactions_count,
          `${c.avg_delay_hours}h`,
        ]),
      ];

      const csvContent =
        "data:text/csv;charset=utf-8,\uFEFF" +
        rows.map((e) => e.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(";")).join("\n");

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute(
        "download",
        `business_pay_analytics_${new Date().toISOString().slice(0, 10)}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error("Erreur export CSV :", e);
    }
  };

  return (
    <div className="space-y-7 pb-12">
      {/* ═══ EN-TÊTE DE LA PAGE ═══ */}
      <header className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold mb-2">
              <Zap className="h-3.5 w-3.5" />
              <span>Pilotage Financier Temps Réel</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
              Statistiques & Pilotage
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-zinc-400">
              Analyses de performance, rentabilité des prestations et vélocité de vos encaissements.
            </p>
          </div>

          {/* Boutons d'action : Actualiser + Export CSV */}
          <div className="flex items-center gap-2.5 shrink-0 flex-wrap sm:flex-nowrap">
            <button
              type="button"
              onClick={() => fetchAnalytics(false)}
              disabled={refreshing || loading}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-[#0a0a0a] px-3.5 text-xs font-semibold text-zinc-300 hover:text-white hover:border-emerald-500/40 hover:bg-zinc-900 transition active:scale-95 disabled:opacity-50"
              title="Rafraîchir les statistiques"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 text-emerald-400 ${
                  refreshing ? "animate-spin" : ""
                }`}
              />
              <span className="hidden sm:inline">Actualiser</span>
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              disabled={loading || !analyticsData}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-4 text-xs font-bold text-black transition shadow-lg shadow-emerald-500/20 border border-emerald-400 active:scale-95 disabled:opacity-50"
            >
              <FileSpreadsheet className="h-4 w-4 stroke-[2.5]" />
              <span>Exporter Rapport</span>
            </button>
          </div>
        </div>

        {/* ═══ SÉLECTEUR DE PÉRIODE ÉLARGI (Mobile First) ═══ */}
        <div className="flex flex-col gap-2.5 pt-1">
          <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-6 py-2 sm:py-2.5 rounded-2xl bg-[#0a0a0a] border border-emerald-500/30 shadow-xl overflow-x-auto no-scrollbar w-full sm:w-fit max-w-full">
            <span className="text-emerald-400 shrink-0 mr-1 flex items-center">
              <CalendarDays className="h-4 w-4" />
            </span>

            {[
              { id: "today", label: "Aujourd'hui" },
              { id: "week", label: "Cette semaine" },
              { id: "month", label: "Ce mois" },
              { id: "quarter", label: "Trimestre" },
              { id: "year", label: "Année" },
              { id: "all", label: "Tout l'historique" },
              { id: "custom", label: "Personnalisé" },
            ].map(({ id, label }) => {
              const active = periodPreset === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPeriodPreset(id)}
                  className={`px-3 sm:px-3.5 py-1.5 text-[11px] sm:text-xs font-bold rounded-xl transition-all duration-150 shrink-0 whitespace-nowrap ${
                    active
                      ? "bg-emerald-500 text-black shadow-md shadow-emerald-500/20 border border-emerald-400"
                      : "text-zinc-400 hover:text-white hover:bg-zinc-900 border border-transparent"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Sélecteur de date début/fin en mode personnalisé */}
          {periodPreset === "custom" && (
            <div className="inline-flex items-center gap-2.5 sm:gap-3 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-2xl bg-[#0a0a0a] border border-emerald-500/30 text-xs flex-wrap shadow-lg w-full sm:w-fit">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-zinc-400">Du</span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="h-8 px-2.5 rounded-lg bg-zinc-900 border border-emerald-500/30 text-white text-xs outline-none focus:border-emerald-400 [color-scheme:dark]"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-zinc-400">Au</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="h-8 px-2.5 rounded-lg bg-zinc-900 border border-emerald-500/30 text-white text-xs outline-none focus:border-emerald-400 [color-scheme:dark]"
                />
              </div>
              {(customStartDate || customEndDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setCustomStartDate("");
                    setCustomEndDate("");
                  }}
                  title="Réinitialiser les dates"
                  className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Erreur éventuelle */}
      {error && (
        <div
          role="alert"
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => fetchAnalytics(true)}
            className="rounded-lg border border-red-500/30 px-3 py-1 text-xs font-semibold text-red-200 hover:bg-red-500/20"
          >
            Réessayer
          </button>
        </div>
      )}

      {/* ═══ CARTES DE KPIS CLÉS (PILOTAGE FINANCIER) ═══ */}
      <section
        aria-label="Indicateurs de pilotage financier"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {/* KPI 1 : Délai moyen de règlement */}
        <article className="rounded-2xl border border-emerald-500/20 bg-[#0a0a0a] p-5 relative overflow-hidden hover:border-emerald-500/40 transition-all shadow-lg">
          <div className="flex items-start justify-between gap-3">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Délai Moyen de Règlement
            </p>
            <span className="rounded-xl p-2.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
              <Clock className="h-4 w-4" />
            </span>
          </div>

          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <p className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                {delayStats.formatted_avg_delay || "0.0 jour"}
              </p>
              <span className="text-[11px] font-bold text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30">
                Temps réel
              </span>
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              Entre la génération du lien et la validation finale du paiement
            </p>
          </div>

          {/* Micro-indicateurs de vélocité */}
          <div className="mt-4 pt-3 border-t border-zinc-900 grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <span className="text-zinc-500 block">Médian</span>
              <span className="font-semibold text-zinc-300">
                {delayStats.median_delay_hours !== undefined
                  ? `${delayStats.median_delay_hours}h`
                  : "-"}
              </span>
            </div>
            <div>
              <span className="text-zinc-500 block">&lt; 24 heures</span>
              <span className="font-semibold text-emerald-400">
                {delayStats.under_24h_count || 0} transaction
                {(delayStats.under_24h_count || 0) > 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </article>

        {/* KPI 2 : Tendance MoM (Ce mois vs Mois dernier) */}
        <article className="rounded-2xl border border-emerald-500/20 bg-[#0a0a0a] p-5 relative overflow-hidden hover:border-emerald-500/40 transition-all shadow-lg">
          <div className="flex items-start justify-between gap-3">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Tendance vs Mois Dernier
            </p>
            <span
              className={`rounded-xl p-2.5 border ${
                growth.trend_direction === "up"
                  ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                  : growth.trend_direction === "down"
                  ? "bg-rose-500/15 border-rose-500/30 text-rose-400"
                  : "bg-zinc-800 border-zinc-700 text-zinc-300"
              }`}
            >
              {growth.trend_direction === "up" ? (
                <TrendingUp className="h-4 w-4" />
              ) : growth.trend_direction === "down" ? (
                <TrendingDown className="h-4 w-4" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
            </span>
          </div>

          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <p
                className={`text-2xl sm:text-3xl font-black tracking-tight ${
                  growth.trend_direction === "up"
                    ? "text-emerald-400"
                    : growth.trend_direction === "down"
                    ? "text-rose-400"
                    : "text-white"
                }`}
              >
                {growth.growth_rate_pct !== undefined
                  ? `${growth.growth_rate_pct > 0 ? "+" : ""}${growth.growth_rate_pct}%`
                  : "+0%"}
              </p>
              <span
                className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${
                  growth.trend_direction === "up"
                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                    : growth.trend_direction === "down"
                    ? "bg-rose-500/20 text-rose-400 border-rose-500/40"
                    : "bg-zinc-800 text-zinc-400 border-zinc-700"
                }`}
              >
                {growth.trend_direction === "up"
                  ? "Croissance"
                  : growth.trend_direction === "down"
                  ? "Ralentissement"
                  : "Stable"}
              </span>
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              {formatAmount(growth.current_month_revenue || 0)} ce mois-ci vs{" "}
              {formatAmount(growth.previous_month_revenue || 0)}
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-zinc-900 flex items-center justify-between text-[11px]">
            <span className="text-zinc-500">Variation nette</span>
            <span
              className={`font-semibold ${
                (growth.difference_amount || 0) >= 0
                  ? "text-emerald-400"
                  : "text-rose-400"
              }`}
            >
              {(growth.difference_amount || 0) >= 0 ? "+" : ""}
              {formatAmount(growth.difference_amount || 0)}
            </span>
          </div>
        </article>

        {/* KPI 3 : Net encaissé de la période */}
        <article className="rounded-2xl border border-emerald-500/20 bg-[#0a0a0a] p-5 relative overflow-hidden hover:border-emerald-500/40 transition-all shadow-lg">
          <div className="flex items-start justify-between gap-3">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Chiffre d&apos;Affaires Net
            </p>
            <span className="rounded-xl p-2.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
              <Wallet className="h-4 w-4" />
            </span>
          </div>

          <div className="mt-3">
            <p className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              {formatAmount(summary.period_revenue || 0)}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Ticket moyen :{" "}
              <strong className="text-zinc-300">
                {formatAmount(summary.average_ticket || 0)}
              </strong>{" "}
              / facture
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-zinc-900 flex items-center justify-between text-[11px]">
            <span className="text-zinc-500">Transactions validées</span>
            <span className="font-semibold text-zinc-200">
              {summary.period_transactions_count || 0} encaissement
              {(summary.period_transactions_count || 0) > 1 ? "s" : ""}
            </span>
          </div>
        </article>

        {/* KPI 4 : Taux de conversion & Succès */}
        <article className="rounded-2xl border border-emerald-500/20 bg-[#0a0a0a] p-5 relative overflow-hidden hover:border-emerald-500/40 transition-all shadow-lg">
          <div className="flex items-start justify-between gap-3">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Taux de Rapprochement
            </p>
            <span className="rounded-xl p-2.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
            </span>
          </div>

          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <p className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                {summary.success_rate_pct !== undefined
                  ? `${summary.success_rate_pct} %`
                  : "100 %"}
              </p>
              <span className="text-[11px] font-bold text-emerald-400">
                Efficacité
              </span>
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              Factures intégralement honorées sans impayés
            </p>
          </div>

          {/* Jauge de progression */}
          <div className="mt-4 pt-3 border-t border-zinc-900">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-900 border border-zinc-800">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${Math.min(100, summary.success_rate_pct || 100)}%` }}
              />
            </div>
          </div>
        </article>
      </section>

      {/* ═══ SECTION : RÉPARTITION PAR OPÉRATEUR MOBILE MONEY (WAVE, ORANGE, MTN, MOOV) ═══ */}
      <section
        aria-label="Répartition par opérateur Mobile Money"
        className="rounded-2xl border border-emerald-500/20 bg-[#0a0a0a] p-5 sm:p-6 shadow-xl"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-emerald-400" />
              <h2 className="text-lg font-bold text-white tracking-tight">
                Répartition par Opérateur Mobile Money
              </h2>
            </div>
            <p className="mt-1 text-xs text-zinc-400">
              Parts de volume et montants encaissés via Wave, Orange Money, MTN MoMo et Moov Money.
            </p>
          </div>

          {/* Toggle : Répartition en Montant vs en Volume */}
          <div className="w-full sm:w-auto inline-flex items-center p-1 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setOperatorMetric("amount")}
              className={`flex-1 sm:flex-none text-center px-2.5 sm:px-3 py-1.5 rounded-lg transition ${
                operatorMetric === "amount"
                  ? "bg-emerald-500 text-black font-bold shadow"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Chiffre d&apos;Affaires (FCFA)
            </button>
            <button
              type="button"
              onClick={() => setOperatorMetric("volume")}
              className={`flex-1 sm:flex-none text-center px-2.5 sm:px-3 py-1.5 rounded-lg transition ${
                operatorMetric === "volume"
                  ? "bg-emerald-500 text-black font-bold shadow"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Volume de transactions
            </button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-12 items-center">
          {/* Graphique Donut (Camembert interactif) */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center">
            <div className="relative h-60 w-60">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={operatorChartData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={4}
                    stroke="none"
                  >
                    {operatorChartData.map((item) => (
                      <Cell key={item.name} fill={item.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name, item) => [
                      operatorMetric === "amount"
                        ? formatAmount(value)
                        : `${value} transaction(s)`,
                      `${name} (${item.payload.percentage}%)`,
                    ]}
                    contentStyle={{
                      backgroundColor: "#000000",
                      border: "1px solid #119134",
                      borderRadius: 12,
                      color: "#fff",
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xs font-semibold uppercase text-zinc-500 tracking-wider">
                  Total {operatorMetric === "amount" ? "CA" : "Volume"}
                </span>
                <span className="text-lg font-black text-white">
                  {operatorMetric === "amount"
                    ? formatShortAmount(summary.period_revenue)
                    : summary.period_transactions_count || 0}
                </span>
              </div>
            </div>
          </div>

          {/* Barres de progression et Détails chiffrés par opérateur */}
          <div className="lg:col-span-7 space-y-4">
            {paymentMethods.length > 0 ? (
              paymentMethods.map((method) => {
                const theme = OPERATOR_THEMES[method.operator_code] || {
                  label: method.operator_label,
                  barColor: method.color || "#00A3FF",
                  badgeBg: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
                };
                const percentage =
                  operatorMetric === "amount"
                    ? method.amount_percentage
                    : method.volume_percentage;

                return (
                  <div
                    key={method.operator_code}
                    className="p-3.5 rounded-xl border border-zinc-800/80 bg-zinc-950/60 hover:border-zinc-700 transition"
                  >
                    <div className="flex items-center justify-between gap-3 text-xs mb-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-3 w-3 rounded-full shrink-0 shadow-sm"
                          style={{ backgroundColor: theme.barColor }}
                        />
                        <span className="font-bold text-white text-sm">
                          {method.operator_label}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${theme.badgeBg}`}
                        >
                          {percentage}%
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-extrabold text-white text-sm block">
                          {formatAmount(method.total_amount)}
                        </span>
                        <span className="text-[11px] text-zinc-400">
                          {method.transactions_count} règlement
                          {method.transactions_count > 1 ? "s" : ""} · Panier :{" "}
                          {formatAmount(method.average_ticket)}
                        </span>
                      </div>
                    </div>

                    {/* Jauge animée avec couleur officielle de l'opérateur */}
                    <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-900 border border-zinc-800">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${Math.min(100, Math.max(3, percentage))}%`,
                          backgroundColor: theme.barColor,
                        }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-center text-xs text-zinc-500 py-6">
                Aucune transaction encaissée sur cette période pour les opérateurs.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ═══ SECTION EN 2 COLONNES : TOP SERVICES & TOP CLIENTS ═══ */}
      <section className="grid gap-6 lg:grid-cols-2">
        {/* TOP SERVICES LES PLUS RENTABLES */}
        <article className="rounded-2xl border border-emerald-500/20 bg-[#0a0a0a] p-4 sm:p-6 shadow-xl flex flex-col justify-between min-w-0">
          <div>
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <Award className="h-5 w-5 text-emerald-400" />
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Top des Services les Plus Rentables
                </h2>
              </div>
              <span className="text-xs font-semibold text-zinc-400">
                {topServices.length} prestation{topServices.length > 1 ? "s" : ""}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mb-5">
              Classement des prestations générant le plus fort chiffre d&apos;affaires net.
            </p>

            <div className="space-y-3.5">
              {topServices.length > 0 ? (
                topServices.map((service, index) => {
                  const maxRevenue = topServices[0]?.total_revenue || 1;
                  const relativeBarPct = Math.round(
                    (service.total_revenue / maxRevenue) * 100
                  );

                  return (
                    <div
                      key={service.service_name}
                      className="p-3.5 rounded-xl border border-zinc-800/80 bg-zinc-950/60 hover:border-emerald-500/40 transition"
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-black ${
                              index === 0
                                ? "bg-amber-400/20 text-amber-300 border border-amber-400/40"
                                : index === 1
                                ? "bg-zinc-300/20 text-zinc-200 border border-zinc-400/40"
                                : index === 2
                                ? "bg-amber-700/20 text-amber-500 border border-amber-700/40"
                                : "bg-zinc-800 text-zinc-400"
                            }`}
                          >
                            #{index + 1}
                          </span>
                          <span className="font-bold text-white text-sm truncate">
                            {service.service_name}
                          </span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-extrabold text-emerald-400 text-sm block">
                            {formatAmount(service.total_revenue)}
                          </span>
                          <span className="text-[10px] text-zinc-400">
                            {service.revenue_percentage}% du CA
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-zinc-500 mb-1.5">
                        <span>
                          {service.transactions_count} vente
                          {service.transactions_count > 1 ? "s" : ""}
                        </span>
                        <span>Ticket moy. {formatAmount(service.average_ticket)}</span>
                      </div>

                      {/* Barre relative */}
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-900">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                          style={{ width: `${relativeBarPct}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-center text-xs text-zinc-500 py-6">
                  Aucune vente enregistrée sur cette période.
                </p>
              )}
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-zinc-900 text-right">
            <Link
              href="/dashboard/new"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 hover:text-emerald-300 transition"
            >
              <span>Créer une nouvelle prestation</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </article>

        {/* TOP DES MEILLEURS CLIENTS (VIP COCKPIT) */}
        <article className="rounded-2xl border border-emerald-500/20 bg-[#0a0a0a] p-4 sm:p-6 shadow-xl flex flex-col justify-between min-w-0">
          <div>
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-emerald-400" />
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Top des Meilleurs Clients
                </h2>
              </div>
              <Link
                href="/clients"
                className="text-xs font-bold text-emerald-400 hover:text-emerald-300 transition flex items-center gap-1"
              >
                <span>Voir le CRM</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <p className="text-xs text-zinc-400 mb-5">
              Clients les plus fidèles et contributeurs majeurs à votre chiffre d&apos;affaires.
            </p>

            <div className="space-y-3.5">
              {topClients.length > 0 ? (
                topClients.map((client, index) => {
                  const initials = client.client_name
                    ? client.client_name
                        .split(/\s+/)
                        .slice(0, 2)
                        .map((w) => w[0])
                        .join("")
                        .toUpperCase()
                    : "CL";

                  return (
                    <div
                      key={client.client_id || client.client_name}
                      className="p-3.5 rounded-xl border border-zinc-800/80 bg-zinc-950/60 hover:border-emerald-500/40 transition flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-950 border border-emerald-500/30 text-emerald-300 font-extrabold text-xs">
                            {initials}
                          </span>
                          {index === 0 && (
                            <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-black text-[9px] font-black">
                              ★
                            </span>
                          )}
                        </div>

                        <div className="min-w-0">
                          <p className="font-bold text-white text-sm truncate">
                            {client.client_name}
                          </p>
                          <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                            <span>{client.client_phone || "Sans téléphone"}</span>
                            <span>·</span>
                            <span className="text-emerald-400 font-medium">
                              Règle en ~{client.avg_delay_hours}h
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-extrabold text-white text-sm block">
                          {formatAmount(client.total_revenue)}
                        </span>
                        <span className="text-[10px] text-zinc-500">
                          {client.transactions_count} paiement
                          {client.transactions_count > 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-center text-xs text-zinc-500 py-6">
                  Aucun client enregistré sur cette période.
                </p>
              )}
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-zinc-900 text-right">
            <Link
              href="/clients"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 hover:text-emerald-300 transition"
            >
              <span>Accéder au répertoire CRM complet</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </article>
      </section>

      {/* ═══ SECTION DÉTAIL VÉLOCITÉ : DISTRIBUTION DES DÉLAIS DE PAIEMENT ═══ */}
      <section
        aria-label="Distribution des délais de paiement"
        className="rounded-2xl border border-emerald-500/20 bg-[#0a0a0a] p-5 sm:p-6 shadow-xl"
      >
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-2">
            <Clock3 className="h-5 w-5 text-emerald-400" />
            <h2 className="text-lg font-bold text-white tracking-tight">
              Vélocité d&apos;Encaissement : Répartition par Tranches
            </h2>
          </div>
          <span className="text-xs font-semibold text-emerald-400 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30">
            Moyenne : {delayStats.formatted_avg_delay || "-"}
          </span>
        </div>
        <p className="text-xs text-zinc-400 mb-6">
          Mesure la réactivité des clients suite à l&apos;envoi de leur lien de règlement sécurisé.
        </p>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/70">
            <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
              <span>Éclair (&lt; 1 heure)</span>
              <span className="font-bold text-emerald-400">
                {delayStats.total_paid_count > 0
                  ? Math.round(
                      ((delayStats.under_1h_count || 0) /
                        delayStats.total_paid_count) *
                        100
                    )
                  : 0}
                %
              </span>
            </div>
            <p className="text-2xl font-black text-white">
              {delayStats.under_1h_count || 0}
            </p>
            <p className="text-[11px] text-zinc-500 mt-1">
              Règlement immédiat après réception
            </p>
          </div>

          <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/70">
            <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
              <span>Même Jour (1h à 24h)</span>
              <span className="font-bold text-sky-400">
                {delayStats.total_paid_count > 0
                  ? Math.round(
                      ((delayStats.under_24h_count || 0) /
                        delayStats.total_paid_count) *
                        100
                    )
                  : 0}
                %
              </span>
            </div>
            <p className="text-2xl font-black text-white">
              {delayStats.under_24h_count || 0}
            </p>
            <p className="text-[11px] text-zinc-500 mt-1">
              Validé dans la même journée
            </p>
          </div>

          <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/70">
            <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
              <span>Standard (1 à 3 jours)</span>
              <span className="font-bold text-amber-400">
                {delayStats.total_paid_count > 0
                  ? Math.round(
                      ((delayStats.under_3d_count || 0) /
                        delayStats.total_paid_count) *
                        100
                    )
                  : 0}
                %
              </span>
            </div>
            <p className="text-2xl font-black text-white">
              {delayStats.under_3d_count || 0}
            </p>
            <p className="text-[11px] text-zinc-500 mt-1">
              Délai moyen acceptable
            </p>
          </div>

          <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/70">
            <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
              <span>Tardif (&gt; 3 jours)</span>
              <span className="font-bold text-rose-400">
                {delayStats.total_paid_count > 0
                  ? Math.round(
                      ((delayStats.over_3d_count || 0) /
                        delayStats.total_paid_count) *
                        100
                    )
                  : 0}
                %
              </span>
            </div>
            <p className="text-2xl font-black text-white">
              {delayStats.over_3d_count || 0}
            </p>
            <p className="text-[11px] text-zinc-500 mt-1">
              Nécessitant relance WhatsApp
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
