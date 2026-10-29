"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Check,
  Clock3,
  Copy,
  ExternalLink,
  LoaderCircle,
  MessageCircle,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  Server,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Users,
  Wallet,
  X,
  Filter,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const CHART_COLORS = ["#10b981", "#059669", "#047857", "#34d399", "#6ee7b7"];

const formatAmount = (value) =>
  `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Number(value) || 0)} FCFA`;

const clientOf = (tx) =>
  tx.client || (Array.isArray(tx.clients) ? tx.clients[0] : tx.clients) || {};

const clientName = (tx) => {
  const c = clientOf(tx);
  return c?.name || c?.nom || tx.client_name || "Client sans nom";
};

const clientPhone = (tx) => {
  const c = clientOf(tx);
  return c?.phone || c?.telephone || tx.client_phone || "";
};

const txService = (tx) =>
  tx.service_name || tx.service || "Prestation non renseignée";

const txAmountNet = (tx) =>
  Number(tx.amount_net ?? tx.montant_net) || 0;

const txAmountTotal = (tx) =>
  Number(tx.amount_total ?? tx.montant_total) || 0;

const txIsPaid = (tx) =>
  tx.status === "paye" || tx.statut === "paye";

const txIsPending = (tx) =>
  tx.status === "en_attente" || tx.statut === "en_attente";

const txIsToVerify = (tx) =>
  tx.status === "a_verifier" || tx.statut === "a_verifier";

const dateOf = (tx) => {
  const date = new Date(tx.created_at);
  return Number.isNaN(date.getTime()) ? null : date;
};

function LoadingState() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-[55vh] flex-col items-center justify-center gap-4 text-zinc-400"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
        <LoaderCircle className="h-6 w-6 animate-spin" />
      </span>
      <span className="text-sm">Chargement de votre tableau de bord...</span>
    </div>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/5 bg-zinc-950 px-3.5 py-3 shadow-xl">
      <p className="mb-1 text-xs text-zinc-400">{label}</p>
      <p className="text-sm font-semibold text-emerald-400">
        {formatAmount(payload[0].value)}
      </p>
    </div>
  );
}

export default function DashboardPage() {
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState("Ce mois");
  const [copiedId, setCopiedId] = useState("");
  const [updatingId, setUpdatingId] = useState("");
  const [toast, setToast] = useState("");
  const [actionError, setActionError] = useState("");
  const [loadError, setLoadError] = useState("");

  // Nouveaux états : Recherche et Filtres
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // 'all' | 'a_verifier' | 'en_attente' | 'paye' | 'echoue'

  const [kpis, setKpis] = useState({
    revenue: 0,
    pending: 0,
    toVerifyCount: 0,
    toVerifyAmount: 0,
    successRate: 0,
    totalTransactions: 0,
  });

  const loadTransactions = useCallback(async (showLoader = true) => {
    if (showLoader) setIsLoading(true);
    setLoadError("");
    try {
      const res = await fetch("/api/payments");
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(
          json.error || "Impossible de charger les données financières."
        );
      }

      setTransactions(json.payments ?? []);
    } catch (error) {
      console.error("Erreur lors du chargement des transactions :", error);
      setLoadError(
        "Impossible de charger les données Supabase. Vérifiez la connexion et vos droits."
      );
      setTransactions([]);
    } finally {
      if (showLoader) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  // Filtrage par période (mois ou année)
  const periodTransactions = useMemo(() => {
    const now = new Date();
    return transactions.filter((tx) => {
      const date = dateOf(tx);
      if (!date) return false;
      return period === "Ce mois"
        ? date.getMonth() === now.getMonth() &&
            date.getFullYear() === now.getFullYear()
        : date.getFullYear() === now.getFullYear();
    });
  }, [period, transactions]);

  // Calcul dynamique des KPIs
  useEffect(() => {
    const paid = periodTransactions.filter(txIsPaid);
    const pending = periodTransactions.filter(txIsPending);
    const toVerify = periodTransactions.filter(txIsToVerify);

    setKpis({
      revenue: paid.reduce((sum, tx) => sum + txAmountNet(tx), 0),
      pending: pending.reduce((sum, tx) => sum + txAmountTotal(tx), 0),
      toVerifyCount: toVerify.length,
      toVerifyAmount: toVerify.reduce((sum, tx) => sum + txAmountTotal(tx), 0),
      successRate: periodTransactions.length
        ? Math.round((paid.length / periodTransactions.length) * 100)
        : 0,
      totalTransactions: periodTransactions.length,
    });
  }, [periodTransactions]);

  // Données du graphique d'évolution du CA
  const revenueChartData = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, index) => {
      const monthDate = new Date(
        now.getFullYear(),
        now.getMonth() - 5 + index,
        1
      );
      return {
        year: monthDate.getFullYear(),
        month: monthDate.getMonth(),
        label: new Intl.DateTimeFormat("fr-FR", { month: "short" }).format(
          monthDate
        ),
        amount: 0,
      };
    });
    transactions.forEach((tx) => {
      if (!txIsPaid(tx)) return;
      const date = dateOf(tx);
      const month = months.find(
        (item) =>
          item.year === date?.getFullYear() && item.month === date?.getMonth()
      );
      if (month) month.amount += txAmountNet(tx);
    });
    return months;
  }, [transactions]);

  // Données de répartition par prestation
  const serviceData = useMemo(() => {
    const totals = new Map();
    periodTransactions
      .filter(txIsPaid)
      .forEach((tx) => {
        const name = txService(tx);
        totals.set(name, (totals.get(name) || 0) + txAmountNet(tx));
      });
    const total = Array.from(totals.values()).reduce(
      (sum, amount) => sum + amount,
      0
    );
    return Array.from(totals, ([name, amount], index) => ({
      name,
      amount,
      percentage: total ? Math.round((amount / total) * 100) : 0,
      color: CHART_COLORS[index % CHART_COLORS.length],
    })).sort((a, b) => b.amount - a.amount);
  }, [periodTransactions]);

  // Meilleurs clients
  const topClients = useMemo(() => {
    const totals = new Map();
    periodTransactions
      .filter(txIsPaid)
      .forEach((tx) => {
        const name = clientName(tx);
        totals.set(name, (totals.get(name) || 0) + txAmountNet(tx));
      });
    const clients = Array.from(totals, ([name, revenue]) => ({
      name,
      revenue,
    }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 3);
    const max = clients[0]?.revenue || 0;
    return clients.map((client) => ({
      ...client,
      initials:
        client.name
          .split(/\s+/)
          .slice(0, 2)
          .map((part) => part[0])
          .join("")
          .toUpperCase() || "?",
      percentage: max ? Math.round((client.revenue / max) * 100) : 0,
    }));
  }, [periodTransactions]);

  // Filtrage combiné : Période + Recherche textuelle + Filtre par statut
  const filteredTransactions = useMemo(() => {
    return periodTransactions.filter((tx) => {
      // 1. Filtre par statut
      if (statusFilter === "paye" && !txIsPaid(tx)) return false;
      if (statusFilter === "en_attente" && !txIsPending(tx)) return false;
      if (statusFilter === "a_verifier" && !txIsToVerify(tx)) return false;
      if (
        statusFilter === "echoue" &&
        tx.status !== "echoue" &&
        tx.statut !== "echoue"
      )
        return false;

      // 2. Recherche instantanée
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const name = clientName(tx).toLowerCase();
        const phone = clientPhone(tx).toLowerCase();
        const service = txService(tx).toLowerCase();
        const manualId = (tx.manual_tx_id || "").toLowerCase();
        const geniusRef = (tx.geniuspay_ref || "").toLowerCase();

        return (
          name.includes(query) ||
          phone.includes(query) ||
          service.includes(query) ||
          manualId.includes(query) ||
          geniusRef.includes(query)
        );
      }

      return true;
    });
  }, [periodTransactions, statusFilter, searchQuery]);

  // Copier le lien de paiement
  const copyPaymentLink = async (id) => {
    setActionError("");
    try {
      const baseUrl =
        typeof window !== "undefined"
          ? window.location.origin
          : "https://kadmielbusiness.vercel.app";
      await navigator.clipboard.writeText(`${baseUrl}/pay/${id}`);
      setCopiedId(id);
      setToast("Lien de paiement copié !");
      window.setTimeout(() => {
        setCopiedId("");
        setToast("");
      }, 2200);
    } catch (error) {
      console.error("Impossible de copier le lien :", error);
      setActionError("Échec de la copie du lien.");
    }
  };

  // Relance WhatsApp en 1 clic
  const openWhatsApp = (tx) => {
    const phone = clientPhone(tx);
    const name = clientName(tx);
    if (!phone) {
      setActionError("Aucun numéro de téléphone enregistré pour ce client.");
      return;
    }
    setActionError("");

    const baseUrl =
      typeof window !== "undefined"
        ? window.location.origin
        : "https://kadmielbusiness.vercel.app";
    const link = `${baseUrl}/pay/${tx.id}`;
    const service = txService(tx);
    const isPaid = txIsPaid(tx);

    let message = "";
    if (isPaid) {
      message = `Bonjour ${name},\n\nVotre règlement de ${formatAmount(
        txAmountTotal(tx)
      )} pour la prestation "${service}" a bien été confirmé.\nMerci pour votre confiance !`;
    } else {
      message = `Bonjour ${name},\n\nVoici votre lien de paiement sécurisé pour la prestation "${service}" :\n👉 ${link}\n\nMontant total : ${formatAmount(
        txAmountTotal(tx)
      )}\nRèglement disponible par Wave, Orange Money, MTN ou Moov.\nMerci !`;
    }

    const cleanPhone = phone.replace(/[^\d]/g, "");
    window.open(
      `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  // Mettre à jour le statut (Validation manuelle ou Rejet)
  const updatePaymentStatus = async (tx, newStatus) => {
    setActionError("");
    setUpdatingId(tx.id);
    try {
      const res = await fetch("/api/payments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: tx.id, status: newStatus }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Impossible de mettre à jour le statut.");
      }

      setTransactions((current) =>
        current.map((item) =>
          item.id === tx.id
            ? { ...item, status: newStatus, statut: newStatus }
            : item
        )
      );

      const label =
        newStatus === "paye" ? "Paiement validé avec succès !" : "Paiement marqué comme refusé.";
      setToast(label);
      window.setTimeout(() => setToast(""), 2200);
      await loadTransactions(false);
    } catch (error) {
      console.error("Erreur lors de la mise à jour :", error);
      setActionError(
        error.message || "Erreur de mise à jour. Vérifiez votre session."
      );
    } finally {
      setUpdatingId("");
    }
  };

  const kpiCards = [
    {
      label: "Net encaissé",
      value: formatAmount(kpis.revenue),
      note: "Montant net disponible",
      icon: Wallet,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
    },
    {
      label: "En attente",
      value: formatAmount(kpis.pending),
      note: "Factures ouvertes non payées",
      icon: Clock3,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
    },
    {
      label: "À vérifier (Secours)",
      value: `${kpis.toVerifyCount} facture${kpis.toVerifyCount > 1 ? "s" : ""}`,
      note:
        kpis.toVerifyCount > 0
          ? `${formatAmount(kpis.toVerifyAmount)} à valider`
          : "Aucune référence SMS en attente",
      icon: ShieldAlert,
      color: kpis.toVerifyCount > 0 ? "text-amber-400" : "text-zinc-400",
      bg: kpis.toVerifyCount > 0 ? "bg-amber-500/20 animate-pulse" : "bg-white/5",
      badge: kpis.toVerifyCount > 0 ? "Action requise" : null,
    },
    {
      label: "Taux de succès",
      value: `${kpis.successRate} %`,
      note: `${kpis.totalTransactions} liens générés`,
      icon: Check,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
      progress: kpis.successRate,
    },
  ];

  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-7">
      {/* Toast de confirmation */}
      {toast && (
        <div
          role="status"
          className="fixed right-5 top-5 z-50 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-zinc-900 px-4 py-3 text-sm text-emerald-300 shadow-2xl animate-slide-up"
        >
          <Check className="h-4 w-4 text-emerald-400" />
          {toast}
        </div>
      )}

      {/* En-tête */}
      <header className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="mb-1 text-sm capitalize text-zinc-500">
            {new Intl.DateTimeFormat("fr-FR", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            }).format(new Date())}
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Kadmiel Business Pay
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Centre de gestion de vos paiements mobiles Wave, Orange, MTN et Moov.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="sr-only" htmlFor="dashboard-period">
            Période
          </label>
          <select
            id="dashboard-period"
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
            className="h-11 rounded-xl border border-white/10 bg-zinc-900 px-3.5 text-sm text-zinc-200 outline-none transition focus:border-emerald-500"
          >
            <option>Ce mois</option>
            <option>Année</option>
          </select>

          <Link
            href="/dashboard/new"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-4 text-sm font-bold text-slate-950 transition shadow-lg shadow-emerald-500/20"
          >
            <Plus className="h-4 w-4" />
            Nouveau lien
          </Link>
        </div>
      </header>

      {/* Erreurs de chargement ou d'action */}
      {loadError && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-sm text-red-300">{loadError}</p>
          <button
            type="button"
            onClick={() => loadTransactions()}
            className="shrink-0 rounded-lg border border-red-500/20 px-3 py-1.5 text-xs font-medium text-red-200 hover:bg-red-500/20"
          >
            Réessayer
          </button>
        </div>
      )}

      {actionError && (
        <div
          role="alert"
          className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-300"
        >
          {actionError}
        </div>
      )}

      {/* ═══ Indicateurs clés (KPIs) ═══ */}
      <section
        aria-label="Indicateurs clés"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {kpiCards.map(
          ({ label, value, note, icon: Icon, color, bg, progress, badge }) => (
            <article
              key={label}
              className="rounded-2xl border border-white/5 bg-zinc-900 p-5 relative overflow-hidden"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium text-zinc-400">{label}</p>
                <span className={`rounded-xl p-2.5 ${bg} ${color}`}>
                  <Icon className="h-4 w-4" />
                </span>
              </div>

              <div className="mt-4 flex items-baseline gap-2">
                <p className="text-2xl font-bold tracking-tight text-white">
                  {value}
                </p>
                {badge && (
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    {badge}
                  </span>
                )}
              </div>

              {progress !== undefined && (
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}
              <p className="mt-2 text-xs text-zinc-500">{note}</p>
            </article>
          )
        )}
      </section>

      {/* ═══ Graphiques et Répartitions ═══ */}
      <section aria-label="Analyses" className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-2xl border border-white/5 bg-zinc-900 p-5">
          <div className="mb-5">
            <h2 className="font-semibold text-white">Répartition des Services</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Chiffre d&apos;affaires net par type de prestation
            </p>
          </div>
          <div className="relative mx-auto h-64 max-w-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={serviceData}
                  dataKey="amount"
                  nameKey="name"
                  innerRadius={72}
                  outerRadius={100}
                  paddingAngle={3}
                  stroke="none"
                >
                  {serviceData.map((item) => (
                    <Cell key={item.name} fill={item.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => [formatAmount(value), name]}
                  contentStyle={{
                    backgroundColor: "#09090b",
                    border: "1px solid #27272a",
                    borderRadius: 12,
                    color: "#fff",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-white">
                {serviceData.length}
              </span>
              <span className="text-xs text-zinc-500">services</span>
            </div>
          </div>
          {serviceData.length ? (
            <div className="space-y-3 pt-2">
              {serviceData.map((item) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between gap-3 text-xs"
                >
                  <span className="flex min-w-0 items-center gap-2 text-zinc-400">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="truncate">{item.name}</span>
                  </span>
                  <span className="shrink-0 text-zinc-200 font-semibold">
                    {item.percentage} %
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-xs text-zinc-600">
              Aucune prestation encaissée sur la période
            </p>
          )}
        </article>

        <article className="rounded-2xl border border-white/5 bg-zinc-900 p-5">
          <div className="mb-5">
            <h2 className="font-semibold text-white">Évolution des Revenus</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Revenu net encaissé sur les 6 derniers mois
            </p>
          </div>
          <div className="relative h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={revenueChartData}
                margin={{ top: 8, right: 4, left: -18, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="profitFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  stroke="#27272a"
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#71717a", fontSize: 12 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#71717a", fontSize: 11 }}
                  tickFormatter={(value) =>
                    `${(value / 1000000).toFixed(value >= 1000000 ? 1 : 0)} M`
                  }
                />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="amount"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fill="url(#profitFill)"
                  activeDot={{
                    r: 5,
                    fill: "#10b981",
                    stroke: "#09090b",
                    strokeWidth: 2,
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
            {!revenueChartData.some((month) => month.amount > 0) && (
              <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-zinc-600">
                Aucune donnée de revenu sur les six derniers mois
              </p>
            )}
          </div>
        </article>
      </section>

      {/* ═══ TABLEAU PRINCIPAL DES TRANSACTIONS (#transactions) ═══ */}
      <section
        id="transactions"
        className="rounded-2xl border border-white/5 bg-zinc-900 overflow-hidden shadow-xl"
      >
        {/* Barre d'outils du tableau : Titre + Recherche + Filtres */}
        <div className="p-5 border-b border-white/5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="font-bold text-white text-base">
                Transactions & Factures
              </h2>
              <p className="mt-0.5 text-xs text-zinc-500">
                {filteredTransactions.length} transaction
                {filteredTransactions.length > 1 ? "s" : ""} trouvée
                {filteredTransactions.length > 1 ? "s" : ""}
              </p>
            </div>

            {/* Barre de Recherche Instantanée */}
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
              <input
                type="text"
                placeholder="Rechercher client, service, ID SMS..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 pl-9 pr-8 text-xs rounded-xl bg-zinc-950 border border-white/10 text-white placeholder:text-zinc-500 outline-none focus:border-emerald-500 transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Onglets de Filtres de Statut */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            <span className="text-[11px] text-zinc-500 flex items-center gap-1 mr-1 shrink-0">
              <Filter className="h-3 w-3" />
              Statut :
            </span>

            {[
              { id: "all", label: "Tous", count: periodTransactions.length },
              {
                id: "a_verifier",
                label: "À vérifier",
                count: periodTransactions.filter(txIsToVerify).length,
                highlight: true,
              },
              {
                id: "en_attente",
                label: "En attente",
                count: periodTransactions.filter(txIsPending).length,
              },
              {
                id: "paye",
                label: "Payés",
                count: periodTransactions.filter(txIsPaid).length,
              },
              {
                id: "echoue",
                label: "Échoués",
                count: periodTransactions.filter(
                  (tx) => tx.status === "echoue" || tx.statut === "echoue"
                ).length,
              },
            ].map(({ id, label, count, highlight }) => {
              const active = statusFilter === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setStatusFilter(id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition shrink-0 ${
                    active
                      ? "bg-emerald-500 text-slate-950 font-bold"
                      : highlight && count > 0
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30"
                      : "bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700/80"
                  }`}
                >
                  <span>{label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      active
                        ? "bg-black/20 text-slate-950"
                        : "bg-black/40 text-zinc-400"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tableau */}
        {filteredTransactions.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[840px] text-left text-sm">
              <thead className="border-b border-white/5 bg-white/[0.02] text-[11px] uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Client</th>
                  <th className="px-4 py-3 font-medium">Service</th>
                  <th className="px-4 py-3 font-medium">Montant Total</th>
                  <th className="px-4 py-3 font-medium">Statut & Référence</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredTransactions.map((tx) => {
                  const name = clientName(tx);
                  const phone = clientPhone(tx);
                  const initials =
                    name
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((part) => part[0])
                      .join("")
                      .toUpperCase() || "?";

                  const isPaid = txIsPaid(tx);
                  const isPending = txIsPending(tx);
                  const isToVerify = txIsToVerify(tx);
                  const service = txService(tx);
                  const total = txAmountTotal(tx);
                  const net = txAmountNet(tx);

                  return (
                    <tr
                      key={tx.id}
                      className={`transition-colors ${
                        isToVerify
                          ? "bg-amber-500/5 hover:bg-amber-500/10"
                          : "hover:bg-white/[0.02]"
                      }`}
                    >
                      {/* Client */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-800 text-[10px] font-bold text-zinc-300 border border-white/5">
                            {initials}
                          </span>
                          <div>
                            <p className="whitespace-nowrap text-xs font-semibold text-zinc-100">
                              {name}
                            </p>
                            <p className="mt-0.5 text-[10px] text-zinc-500 font-mono">
                              {phone || "Téléphone non renseigné"}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Service */}
                      <td className="px-4 py-3.5 text-xs text-zinc-300">
                        <span className="font-medium text-white">{service}</span>
                        <span className="block text-[10px] text-zinc-500">
                          Net : {formatAmount(net)}
                        </span>
                      </td>

                      {/* Montant Total */}
                      <td className="whitespace-nowrap px-4 py-3.5 text-xs font-bold text-white">
                        {formatAmount(total)}
                      </td>

                      {/* Statut & Référence */}
                      <td className="px-4 py-3.5">
                        <div className="space-y-1">
                          {isPaid ? (
                            <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                              Payé
                            </span>
                          ) : isToVerify ? (
                            <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                              À vérifier (Secours)
                            </span>
                          ) : isPending ? (
                            <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[10px] font-medium bg-zinc-800 text-amber-300/90 border border-amber-400/20">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                              En attente
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[10px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                              <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                              Échoué
                            </span>
                          )}

                          {/* ID SMS saisi par le client */}
                          {tx.manual_tx_id && (
                            <p className="text-[10px] font-mono text-amber-300 font-semibold flex items-center gap-1">
                              <span>SMS ID:</span>
                              <span className="bg-amber-950/60 border border-amber-800/80 px-1.5 py-0.2 rounded">
                                {tx.manual_tx_id}
                              </span>
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5">
                        <div className="flex justify-end items-center gap-1.5">
                          {/* WhatsApp */}
                          <button
                            type="button"
                            onClick={() => openWhatsApp(tx)}
                            title={isPaid ? "Remercier sur WhatsApp" : "Relancer sur WhatsApp"}
                            className="rounded-lg p-2 text-zinc-400 hover:bg-emerald-500/10 hover:text-emerald-400 transition"
                          >
                            <MessageCircle className="h-4 w-4" />
                          </button>

                          {/* Copier lien */}
                          <button
                            type="button"
                            onClick={() => copyPaymentLink(tx.id)}
                            title={copiedId === tx.id ? "Lien copié" : "Copier le lien"}
                            className="rounded-lg p-2 text-zinc-400 hover:bg-white/10 hover:text-white transition"
                          >
                            {copiedId === tx.id ? (
                              <Check className="h-4 w-4 text-emerald-400" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </button>

                          {/* Ouvrir la facture client */}
                          <a
                            href={`/pay/${tx.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Voir la page de paiement"
                            className="rounded-lg p-2 text-zinc-400 hover:bg-white/10 hover:text-white transition"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>

                          {/* Validation Manuelle (si non payé) */}
                          {!isPaid && (
                            <button
                              type="button"
                              onClick={() => updatePaymentStatus(tx, "paye")}
                              disabled={updatingId === tx.id}
                              title="Valider manuellement le paiement"
                              className="rounded-lg p-2 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-slate-950 transition font-bold disabled:opacity-50"
                            >
                              {updatingId === tx.id ? (
                                <LoaderCircle className="h-4 w-4 animate-spin" />
                              ) : (
                                <CheckCircle2 className="h-4 w-4" />
                              )}
                            </button>
                          )}

                          {/* Rejeter (si à vérifier) */}
                          {isToVerify && (
                            <button
                              type="button"
                              onClick={() => updatePaymentStatus(tx, "echoue")}
                              disabled={updatingId === tx.id}
                              title="Rejeter la référence de secours"
                              className="rounded-lg p-2 bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white transition font-bold disabled:opacity-50"
                            >
                              <XCircle className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-5 py-14 text-center">
            <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/5 text-zinc-500">
              <ReceiptText className="h-5 w-5" />
            </span>
            <p className="text-sm font-medium text-zinc-300">
              Aucune transaction trouvée
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {searchQuery
                ? `Aucun résultat pour "${searchQuery}". Essayez un autre terme.`
                : "Les paiements enregistrés s'afficheront ici."}
            </p>
          </div>
        )}
      </section>

      {/* ═══ Meilleurs clients (#clients) ═══ */}
      <section
        id="clients"
        className="rounded-2xl border border-white/5 bg-zinc-900 p-5"
      >
        <div className="mb-6">
          <h2 className="font-semibold text-white">Meilleurs Clients</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Par chiffre d&apos;affaires net encaissé
          </p>
        </div>
        {topClients.length ? (
          <div className="grid gap-6 md:grid-cols-3">
            {topClients.map((client, index) => (
              <div key={client.name}>
                <div className="mb-2.5 flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/5 bg-zinc-800 text-xs font-semibold text-zinc-300">
                    {client.initials || "?"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-200">
                      {client.name}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500 font-semibold">
                      {formatAmount(client.revenue)}
                    </p>
                  </div>
                  <span className="text-xs text-zinc-600 font-mono">
                    0{index + 1}
                  </span>
                </div>
                <div className="ml-12 h-1.5 overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full bg-emerald-500"
                    style={{
                      width: `${client.percentage}%`,
                      opacity: 1 - index * 0.2,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-8 text-center text-xs text-zinc-600">
            Aucun client avec un paiement encaissé pour cette période.
          </p>
        )}
      </section>

      {/* ═══ Réglages & Surveillance Système (#settings) ═══ */}
      <section
        id="settings"
        className="rounded-2xl border border-white/5 bg-zinc-900 p-6 space-y-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-emerald-400" />
              Réglages & Statut du Système
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              Surveillance en direct des intégrations de paiement et de la base de
              données.
            </p>
          </div>
          <button
            type="button"
            onClick={() => loadTransactions()}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-white/10 bg-white/5 text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/10 transition"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Actualiser les données
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 pt-2">
          {/* Card 1 : Supabase */}
          <div className="rounded-xl border border-white/5 bg-zinc-950 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-300 flex items-center gap-2">
                <Server className="h-3.5 w-3.5 text-emerald-400" />
                Base Supabase
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Connecté
              </span>
            </div>
            <p className="text-[11px] text-zinc-500">
              Table active : <code className="text-zinc-400">public.payments</code>{" "}
              ({transactions.length} enregistrements synchronisés)
            </p>
          </div>

          {/* Card 2 : Passerelle GeniusPay */}
          <div className="rounded-xl border border-white/5 bg-zinc-950 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-300 flex items-center gap-2">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                Passerelle GeniusPay
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Opérationnel
              </span>
            </div>
            <p className="text-[11px] text-zinc-500">
              Webhooks HMAC idempotents et transactions sécurisées activés.
            </p>
          </div>

          {/* Card 3 : Session Administrateur */}
          <div className="rounded-xl border border-white/5 bg-zinc-950 p-4 space-y-2 sm:col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-300 flex items-center gap-2">
                <Users className="h-3.5 w-3.5 text-emerald-400" />
                Session Administrateur
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                Active
              </span>
            </div>
            <p className="text-[11px] text-zinc-500">
              Accès complet aux modules Dashboard, Facturation et Clients.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}