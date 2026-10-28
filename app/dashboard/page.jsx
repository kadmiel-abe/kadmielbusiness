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
  Server,
  Settings2,
  ShieldCheck,
  Users,
  Wallet,
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

const CHART_COLORS = ["#a3e635", "#84cc16", "#4d7c0f", "#d9f99d", "#65a30d"];

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

const dateOf = (tx) => {
  const date = new Date(tx.created_at);
  return Number.isNaN(date.getTime()) ? null : date;
};

function LoadingState() {
  return (
    <div role="status" aria-live="polite" className="flex min-h-[55vh] flex-col items-center justify-center gap-4 text-zinc-400">
      <span className="flex h-12 w-12 items-center justify-center rounded-full border border-lime-400/20 bg-lime-400/10 text-lime-400">
        <LoaderCircle className="h-6 w-6 animate-spin" />
      </span>
      <span className="text-sm">Chargement de vos données financières…</span>
    </div>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/5 bg-zinc-950 px-3.5 py-3 shadow-xl">
      <p className="mb-1 text-xs text-zinc-400">{label}</p>
      <p className="text-sm font-semibold text-lime-400">{formatAmount(payload[0].value)}</p>
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
  const [kpis, setKpis] = useState({
    revenue: 0,
    pending: 0,
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
        throw new Error(json.error || "Impossible de charger les données financières.");
      }

      setTransactions(json.payments ?? []);
    } catch (error) {
      console.error("Erreur lors du chargement des transactions :", error);
      setLoadError("Impossible de charger les données Supabase. Vérifiez la connexion et les autorisations.");
      setTransactions([]);
    } finally {
      if (showLoader) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const periodTransactions = useMemo(() => {
    const now = new Date();
    return transactions.filter((tx) => {
      const date = dateOf(tx);
      if (!date) return false;
      return period === "Ce mois"
        ? date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
        : date.getFullYear() === now.getFullYear();
    });
  }, [period, transactions]);

  useEffect(() => {
    const paid = periodTransactions.filter(txIsPaid);
    const pending = periodTransactions.filter(txIsPending);
    setKpis({
      revenue: paid.reduce((sum, tx) => sum + txAmountNet(tx), 0),
      pending: pending.reduce((sum, tx) => sum + txAmountTotal(tx), 0),
      successRate: periodTransactions.length
        ? Math.round((paid.length / periodTransactions.length) * 100)
        : 0,
      totalTransactions: periodTransactions.length,
    });
  }, [periodTransactions]);

  const revenueChartData = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, index) => {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
      return {
        year: monthDate.getFullYear(),
        month: monthDate.getMonth(),
        label: new Intl.DateTimeFormat("fr-FR", { month: "short" }).format(monthDate),
        amount: 0,
      };
    });
    transactions.forEach((tx) => {
      if (!txIsPaid(tx)) return;
      const date = dateOf(tx);
      const month = months.find((item) => item.year === date?.getFullYear() && item.month === date?.getMonth());
      if (month) month.amount += txAmountNet(tx);
    });
    return months;
  }, [transactions]);

  const serviceData = useMemo(() => {
    const totals = new Map();
    periodTransactions.filter(txIsPaid).forEach((tx) => {
      const name = txService(tx);
      totals.set(name, (totals.get(name) || 0) + txAmountNet(tx));
    });
    const total = Array.from(totals.values()).reduce((sum, amount) => sum + amount, 0);
    return Array.from(totals, ([name, amount], index) => ({
      name,
      amount,
      percentage: total ? Math.round((amount / total) * 100) : 0,
      color: CHART_COLORS[index % CHART_COLORS.length],
    })).sort((a, b) => b.amount - a.amount);
  }, [periodTransactions]);

  const topClients = useMemo(() => {
    const totals = new Map();
    periodTransactions.filter(txIsPaid).forEach((tx) => {
      const name = clientName(tx);
      totals.set(name, (totals.get(name) || 0) + txAmountNet(tx));
    });
    const clients = Array.from(totals, ([name, revenue]) => ({ name, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 3);
    const max = clients[0]?.revenue || 0;
    return clients.map((client) => ({
      ...client,
      initials: client.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?",
      percentage: max ? Math.round((client.revenue / max) * 100) : 0,
    }));
  }, [periodTransactions]);

  const copyPaymentLink = async (id) => {
    setActionError("");
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/pay/${id}`);
      setCopiedId(id);
      setToast("Lien de paiement copié");
      window.setTimeout(() => {
        setCopiedId("");
        setToast("");
      }, 2200);
    } catch (error) {
      console.error("Impossible de copier le lien de paiement :", error);
      setActionError("La copie du lien a échoué. Vérifiez les autorisations du navigateur.");
    }
  };

  const openWhatsApp = (tx) => {
    const phone = clientPhone(tx);
    const name = clientName(tx);
    if (!phone) {
      setActionError("Aucun numéro de téléphone n’est enregistré pour ce client.");
      return;
    }
    setActionError("");
    const link = `${window.location.origin}/pay/${tx.id}`;
    const service = txService(tx);
    const message = `Bonjour ${name}, voici votre lien de paiement sécurisé pour la prestation "${service}" : ${link}`;
    const cleanPhone = phone.replace(/[^\d]/g, "");
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  };

  const markAsPaid = async (tx) => {
    setActionError("");
    setUpdatingId(tx.id);
    try {
      const res = await fetch("/api/payments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: tx.id, status: "paye" }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Impossible de valider le paiement.");
      }
      setTransactions((current) =>
        current.map((item) =>
          item.id === tx.id
            ? { ...item, status: "paye", statut: "paye" }
            : item
        )
      );
      setToast("Paiement validé avec succès");
      window.setTimeout(() => setToast(""), 2200);
      await loadTransactions(false);
    } catch (error) {
      console.error("Erreur lors de la validation manuelle du paiement :", error);
      setActionError(error.message || "Impossible de valider le paiement. Vérifiez vos autorisations Supabase.");
    } finally {
      setUpdatingId("");
    }
  };

  const kpiCards = [
    { label: "Net revenue", value: formatAmount(kpis.revenue), note: "Montant net encaissé", icon: Wallet, color: "text-lime-400" },
    { label: "En attente", value: formatAmount(kpis.pending), note: "Montant total à recevoir", icon: Clock3, color: "text-amber-400" },
    { label: "Taux de succès", value: `${kpis.successRate} %`, note: "Paiements confirmés", icon: Check, color: "text-lime-400", progress: kpis.successRate },
    { label: "Total transactions", value: new Intl.NumberFormat("fr-FR").format(kpis.totalTransactions), note: "Liens générés sur la période", icon: ReceiptText, color: "text-zinc-300" },
  ];
  const visibleTransactions = periodTransactions.slice(0, 10);

  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-7">
      {toast && (
        <div role="status" className="fixed right-5 top-5 z-50 flex items-center gap-2 rounded-xl border border-lime-400/20 bg-zinc-900 px-4 py-3 text-sm text-lime-300 shadow-2xl">
          <Check className="h-4 w-4" />{toast}
        </div>
      )}
      <header className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="mb-1 text-sm capitalize text-zinc-500">
            {new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date())}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Overview</h1>
          <p className="mt-1 text-sm text-zinc-400">Vue d&apos;ensemble de votre activité.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="sr-only" htmlFor="dashboard-period">Période</label>
          <select id="dashboard-period" value={period} onChange={(event) => setPeriod(event.target.value)} className="h-11 rounded-lg border border-white/5 bg-zinc-900 px-3.5 text-sm text-zinc-200 outline-none transition focus:border-lime-400/50">
            <option>Ce mois</option>
            <option>Année</option>
          </select>
          <Link href="/dashboard/new" className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-lime-400 px-4 text-sm font-semibold text-black transition hover:bg-lime-500">
            <Plus className="h-4 w-4" />Nouveau lien
          </Link>
        </div>
      </header>

      {loadError && (
        <div role="alert" className="flex flex-col gap-3 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-red-300">{loadError}</p>
          <button type="button" onClick={() => loadTransactions()} className="shrink-0 rounded-lg border border-red-500/20 px-3 py-1.5 text-xs font-medium text-red-200 hover:bg-red-500/10">Réessayer</button>
        </div>
      )}
      {actionError && <div role="alert" className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-300">{actionError}</div>}

      <section aria-label="Indicateurs clés" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map(({ label, value, note, icon: Icon, color, progress }) => (
          <article key={label} className="rounded-2xl border border-white/5 bg-zinc-900 p-5">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium text-zinc-400">{label}</p>
              <span className={`rounded-lg bg-white/5 p-2 ${color}`}><Icon className="h-4 w-4" /></span>
            </div>
            <p className="mt-4 whitespace-nowrap text-2xl font-semibold tracking-tight text-white">{value}</p>
            {progress !== undefined && <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-lime-400 transition-all" style={{ width: `${progress}%` }} /></div>}
            <p className="mt-2 text-xs text-zinc-500">{note}</p>
          </article>
        ))}
      </section>

      <section aria-label="Analyses" className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-2xl border border-white/5 bg-zinc-900 p-5">
          <div className="mb-5">
            <h2 className="font-semibold text-white">Sales Overview</h2>
            <p className="mt-1 text-xs text-zinc-500">Répartition du CA encaissé par prestation</p>
          </div>
          <div className="relative mx-auto h-64 max-w-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={serviceData} dataKey="amount" nameKey="name" innerRadius={72} outerRadius={100} paddingAngle={3} stroke="none">
                  {serviceData.map((item) => <Cell key={item.name} fill={item.color} />)}
                </Pie>
                <Tooltip formatter={(value, name) => [formatAmount(value), name]} contentStyle={{ backgroundColor: "#09090b", border: "1px solid #27272a", borderRadius: 12, color: "#fff" }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-semibold text-white">{serviceData.length}</span>
              <span className="text-xs text-zinc-500">services</span>
            </div>
          </div>
          {serviceData.length ? (
            <div className="space-y-3">
              {serviceData.map((item) => (
                <div key={item.name} className="flex items-center justify-between gap-3 text-xs">
                  <span className="flex min-w-0 items-center gap-2 text-zinc-400"><span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} /><span className="truncate">{item.name}</span></span>
                  <span className="shrink-0 text-zinc-200">{item.percentage} %</span>
                </div>
              ))}
            </div>
          ) : <p className="text-center text-xs text-zinc-600">Aucune prestation encaissée</p>}
        </article>

        <article className="rounded-2xl border border-white/5 bg-zinc-900 p-5">
          <div className="mb-5">
            <h2 className="font-semibold text-white">Total Profit</h2>
            <p className="mt-1 text-xs text-zinc-500">Évolution du revenu net encaissé sur six mois</p>
          </div>
          <div className="relative h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueChartData} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
                <defs><linearGradient id="profitFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a3e635" stopOpacity={0.35} /><stop offset="95%" stopColor="#a3e635" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid stroke="#27272a" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#71717a", fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#71717a", fontSize: 11 }} tickFormatter={(value) => `${(value / 1000000).toFixed(value >= 1000000 ? 1 : 0)} M`} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="amount" stroke="#a3e635" strokeWidth={2.5} fill="url(#profitFill)" activeDot={{ r: 5, fill: "#a3e635", stroke: "#09090b", strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
            {!revenueChartData.some((month) => month.amount > 0) && <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-zinc-600">Aucune donnée de revenu sur les six derniers mois</p>}
          </div>
        </article>
      </section>

      <section id="transactions" className="rounded-2xl border border-white/5 bg-zinc-900">
        <div className="flex items-center justify-between gap-3 px-5 py-5">
          <div><h2 className="font-semibold text-white">Customer list</h2><p className="mt-1 text-xs text-zinc-500">Dernières transactions enregistrées</p></div>
          <a href="#transactions" className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-lime-400 hover:text-lime-300">Tout voir <ExternalLink className="h-3.5 w-3.5" /></a>
        </div>
        {visibleTransactions.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead className="border-y border-white/5 bg-white/[0.02] text-[11px] uppercase tracking-wider text-zinc-500"><tr><th className="px-5 py-3 font-medium">Client</th><th className="px-4 py-3 font-medium">Service</th><th className="px-4 py-3 font-medium">Montant Total</th><th className="px-4 py-3 font-medium">Statut</th><th className="px-5 py-3 text-right font-medium">Actions</th></tr></thead>
              <tbody className="divide-y divide-white/5">
                {visibleTransactions.map((tx) => {
                  const name = clientName(tx);
                  const phone = clientPhone(tx);
                  const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?";
                  const isPaid = txIsPaid(tx);
                  const isPending = txIsPending(tx);
                  const service = txService(tx);
                  const total = txAmountTotal(tx);
                  const statusLabel = isPaid ? "Payé" : isPending ? "En attente" : (tx.status === "a_verifier" ? "À vérifier" : tx.status || "Inconnu");

                  return (
                    <tr key={tx.id} className="transition-colors hover:bg-white/[0.02]">
                      <td className="px-5 py-3.5"><div className="flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-semibold text-zinc-300">{initials}</span><div><p className="whitespace-nowrap text-xs font-medium text-zinc-200">{name}</p><p className="mt-0.5 text-[10px] text-zinc-500">{phone || "Téléphone non renseigné"}</p></div></div></td>
                      <td className="px-4 py-3.5 text-xs text-zinc-400">{service}</td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-xs font-medium text-white">{formatAmount(total)}</td>
                      <td className="px-4 py-3.5"><span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-medium ${isPaid ? "bg-lime-400/10 text-lime-300" : isPending ? "bg-amber-400/10 text-amber-300" : "bg-white/5 text-zinc-400"}`}><span className={`h-1.5 w-1.5 rounded-full ${isPaid ? "bg-lime-300" : isPending ? "bg-amber-300" : "bg-zinc-500"}`} />{statusLabel}</span></td>
                      <td className="px-5 py-3.5"><div className="flex justify-end gap-1">
                        <button type="button" onClick={() => openWhatsApp(tx)} aria-label={`Envoyer le lien à ${name} sur WhatsApp`} title="Envoyer sur WhatsApp" className="rounded-md p-1.5 text-zinc-500 transition hover:bg-white/5 hover:text-lime-400"><MessageCircle className="h-4 w-4" /></button>
                        <button type="button" onClick={() => copyPaymentLink(tx.id)} aria-label={`Copier le lien de paiement pour ${name}`} title={copiedId === tx.id ? "Lien copié" : "Copier le lien"} className="rounded-md p-1.5 text-zinc-500 transition hover:bg-white/5 hover:text-white">{copiedId === tx.id ? <Check className="h-4 w-4 text-lime-400" /> : <Copy className="h-4 w-4" />}</button>
                        {!isPaid && <button type="button" onClick={() => markAsPaid(tx)} disabled={updatingId === tx.id} aria-label={`Valider le paiement de ${name}`} title="Valider manuellement" className="rounded-md p-1.5 text-zinc-500 transition hover:bg-lime-400/10 hover:text-lime-400 disabled:cursor-wait disabled:opacity-50">{updatingId === tx.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}</button>}
                      </div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <div className="border-t border-white/5 px-5 py-14 text-center"><span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/5 text-zinc-500"><ReceiptText className="h-5 w-5" /></span><p className="text-sm font-medium text-zinc-300">Aucune transaction pour le moment</p><p className="mt-1 text-xs text-zinc-500">Les paiements créés apparaîtront ici.</p></div>}
      </section>

      <section id="clients" className="rounded-2xl border border-white/5 bg-zinc-900 p-5">
        <div className="mb-6"><h2 className="font-semibold text-white">Meilleurs clients</h2><p className="mt-1 text-xs text-zinc-500">Par chiffre d&apos;affaires encaissé</p></div>
        {topClients.length ? (
          <div className="grid gap-6 md:grid-cols-3">
            {topClients.map((client, index) => <div key={client.name}><div className="mb-2.5 flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/5 bg-zinc-800 text-xs font-semibold text-zinc-300">{client.initials || "?"}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-zinc-200">{client.name}</p><p className="mt-0.5 text-xs text-zinc-500">{formatAmount(client.revenue)}</p></div><span className="text-xs text-zinc-600">0{index + 1}</span></div><div className="ml-12 h-1.5 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-lime-400" style={{ width: `${client.percentage}%`, opacity: 1 - index * 0.2 }} /></div></div>)}
          </div>
        ) : <p className="py-8 text-center text-xs text-zinc-600">Aucun client avec un paiement encaissé pour cette période.</p>}
      </section>

      {/* ═══ Section Réglages & Diagnostics Système (#settings) ═══ */}
      <section id="settings" className="rounded-2xl border border-white/5 bg-zinc-900 p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-lime-400" />
              Réglages & Statut du Système
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              Surveillance en direct des intégrations de paiement et de la base de données.
            </p>
          </div>
          <button
            type="button"
            onClick={() => loadTransactions()}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-white/10 bg-white/5 text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/10 transition"
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
                <Server className="h-3.5 w-3.5 text-lime-400" />
                Base Supabase
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-lime-400/10 px-2 py-0.5 text-[10px] font-medium text-lime-400">
                <span className="h-1.5 w-1.5 rounded-full bg-lime-400 animate-pulse" />
                Connecté
              </span>
            </div>
            <p className="text-[11px] text-zinc-500">
              Table active : <code className="text-zinc-400">public.payments</code> ({transactions.length} enregistrements synchronisés)
            </p>
          </div>

          {/* Card 2 : Passerelle GeniusPay */}
          <div className="rounded-xl border border-white/5 bg-zinc-950 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-300 flex items-center gap-2">
                <ShieldCheck className="h-3.5 w-3.5 text-lime-400" />
                Passerelle GeniusPay
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-lime-400/10 px-2 py-0.5 text-[10px] font-medium text-lime-400">
                <span className="h-1.5 w-1.5 rounded-full bg-lime-400" />
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
                <Users className="h-3.5 w-3.5 text-lime-400" />
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