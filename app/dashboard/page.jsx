"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import {
  ArrowDownRight,
  ArrowUpRight,
  Check,
  Clock3,
  Copy,
  ExternalLink,
  LoaderCircle,
  MessageCircle,
  Plus,
  Wallet,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const SERVICE_COLORS = ["#22c55e", "#16a34a", "#15803d", "#166534", "#14532d"];

const formatAmount = (amount) =>
  `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Number(amount) || 0)} FCFA`;

const getClient = (transaction) =>
  Array.isArray(transaction.client) ? transaction.client[0] : transaction.client;

const getTransactionDate = (transaction) => {
  const date = new Date(transaction.created_at);
  return Number.isNaN(date.getTime()) ? null : date;
};

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl border border-white/10 bg-zinc-950 px-3.5 py-3 shadow-xl">
      <p className="mb-1 text-xs text-zinc-400">{label}</p>
      <p className="text-sm font-semibold text-green-400">{formatAmount(payload[0].value)}</p>
    </div>
  );
}

function LoadingState() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-[55vh] flex-col items-center justify-center gap-4 text-zinc-400"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full border border-green-500/20 bg-green-500/10 text-green-400">
        <LoaderCircle className="h-6 w-6 animate-spin" />
      </span>
      <span className="text-sm">Chargement de vos données financières…</span>
    </div>
  );
}

export default function DashboardPage() {
  const supabase = useMemo(() => createClientComponentClient(), []);
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState("Ce mois");
  const [copiedId, setCopiedId] = useState("");
  const [updatingId, setUpdatingId] = useState("");
  const [actionError, setActionError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [kpis, setKpis] = useState({
    revenue: 0,
    pending: 0,
    successRate: 0,
    averageDelay: 0,
  });

  const loadTransactions = useCallback(async () => {
    setIsLoading(true);
    setLoadError("");

    try {
      const { data, error } = await supabase
        .from("payments")
        .select("*, client:clients(name, phone)")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setTransactions(data ?? []);
    } catch (error) {
      console.error("Erreur lors du chargement des transactions :", error);
      setLoadError("Impossible de charger les transactions. Vérifiez la connexion à Supabase et vos autorisations.");
      setTransactions([]);
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const periodTransactions = useMemo(() => {
    const now = new Date();
    return transactions.filter((transaction) => {
      const createdAt = getTransactionDate(transaction);
      if (!createdAt) return false;
      if (period === "Ce mois") {
        return (
          createdAt.getMonth() === now.getMonth() &&
          createdAt.getFullYear() === now.getFullYear()
        );
      }
      return createdAt.getFullYear() === now.getFullYear();
    });
  }, [period, transactions]);

  useEffect(() => {
    const paidTransactions = periodTransactions.filter(
      (transaction) => transaction.status === "paye"
    );
    const pendingTransactions = periodTransactions.filter(
      (transaction) => transaction.status === "en_attente"
    );
    const revenue = paidTransactions.reduce(
      (total, transaction) => total + (Number(transaction.amount_net) || 0),
      0
    );
    const pending = pendingTransactions.reduce(
      (total, transaction) => total + (Number(transaction.amount_total) || 0),
      0
    );
    const successRate = periodTransactions.length
      ? Math.round((paidTransactions.length / periodTransactions.length) * 100)
      : 0;
    const delays = paidTransactions
      .map((transaction) => {
        const createdAt = new Date(transaction.created_at).getTime();
        const updatedAt = new Date(transaction.updated_at).getTime();
        if (!Number.isFinite(createdAt) || !Number.isFinite(updatedAt) || updatedAt < createdAt) {
          return null;
        }
        return (updatedAt - createdAt) / (24 * 60 * 60 * 1000);
      })
      .filter((delay) => delay !== null);
    const averageDelay = delays.length
      ? delays.reduce((total, delay) => total + delay, 0) / delays.length
      : 0;

    setKpis({ revenue, pending, successRate, averageDelay });
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

    transactions.forEach((transaction) => {
      if (transaction.status !== "paye") return;
      const createdAt = getTransactionDate(transaction);
      if (!createdAt) return;
      const month = months.find(
        (item) => item.year === createdAt.getFullYear() && item.month === createdAt.getMonth()
      );
      if (month) month.amount += Number(transaction.amount_net) || 0;
    });

    return months;
  }, [transactions]);

  const serviceChartData = useMemo(() => {
    const totals = new Map();
    periodTransactions
      .filter((transaction) => transaction.status === "paye")
      .forEach((transaction) => {
        const name = transaction.service_name?.trim() || "Prestation non renseignée";
        totals.set(name, (totals.get(name) || 0) + (Number(transaction.amount_net) || 0));
      });

    const totalRevenue = Array.from(totals.values()).reduce((sum, amount) => sum + amount, 0);
    return Array.from(totals, ([name, amount], index) => ({
      name,
      amount,
      percentage: totalRevenue ? Math.round((amount / totalRevenue) * 100) : 0,
      color: SERVICE_COLORS[index % SERVICE_COLORS.length],
    })).sort((a, b) => b.amount - a.amount);
  }, [periodTransactions]);

  const topClients = useMemo(() => {
    const totals = new Map();
    periodTransactions
      .filter((transaction) => transaction.status === "paye")
      .forEach((transaction) => {
        const client = getClient(transaction);
        const key = client?.name || "Client sans nom";
        const current = totals.get(key) || { name: key, revenue: 0 };
        current.revenue += Number(transaction.amount_net) || 0;
        totals.set(key, current);
      });

    const sortedClients = Array.from(totals.values()).sort(
      (a, b) => b.revenue - a.revenue
    );
    const maxRevenue = sortedClients[0]?.revenue || 0;

    return sortedClients.slice(0, 3).map((client) => ({
      ...client,
      initials: client.name
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase(),
      percentage: maxRevenue ? Math.round((client.revenue / maxRevenue) * 100) : 0,
    }));
  }, [periodTransactions]);

  const copyPaymentLink = async (id) => {
    setActionError("");
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/pay/${id}`);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(""), 1800);
    } catch (error) {
      console.error("Impossible de copier le lien de paiement :", error);
      setActionError("La copie du lien a échoué. Vérifiez les autorisations du navigateur.");
    }
  };

  const openWhatsApp = (transaction) => {
    const client = getClient(transaction);
    if (!client?.phone) {
      setActionError("Aucun numéro de téléphone n’est enregistré pour ce client.");
      return;
    }

    setActionError("");
    const text = `Bonjour ${client.name || ""}, voici le lien pour votre règlement : ${window.location.origin}/pay/${transaction.id}`;
    const url = `https://wa.me/${encodeURIComponent(client.phone.replace(/[^\d]/g, ""))}?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const markAsPaid = async (transaction) => {
    setActionError("");
    setUpdatingId(transaction.id);

    try {
      const { error } = await supabase
        .from("payments")
        .update({ status: "paye" })
        .eq("id", transaction.id);

      if (error) throw error;
      await loadTransactions();
    } catch (error) {
      console.error("Erreur lors de la validation manuelle du paiement :", error);
      setActionError("Impossible de valider le paiement. Vérifiez vos autorisations Supabase.");
    } finally {
      setUpdatingId("");
    }
  };

  const kpiCards = [
    {
      label: "CA net encaissé",
      value: formatAmount(kpis.revenue),
      note: "Montant net des paiements confirmés",
      icon: Wallet,
      color: "text-green-400",
    },
    {
      label: "En attente",
      value: formatAmount(kpis.pending),
      note: "Montant total des paiements en attente",
      icon: Clock3,
      color: "text-amber-400",
    },
    {
      label: "Taux de succès",
      value: `${kpis.successRate} %`,
      note: `${periodTransactions.filter((transaction) => transaction.status === "paye").length} paiement(s) confirmé(s)`,
      icon: Check,
      color: "text-green-400",
      progress: kpis.successRate,
    },
    {
      label: "Délai moyen",
      value: `${kpis.averageDelay.toFixed(1).replace(".", ",")} jours`,
      note: "Entre création et confirmation du paiement",
      icon: Clock3,
      color: "text-zinc-400",
    },
  ];

  const visibleTransactions = transactions.slice(0, 10);

  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="mb-1 text-sm text-zinc-500">
            {new Intl.DateTimeFormat("fr-FR", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            }).format(new Date())}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Vue d&apos;ensemble
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Suivez la performance de votre activité en un coup d&apos;œil.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="sr-only" htmlFor="dashboard-period">Période</label>
          <select
            id="dashboard-period"
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
            className="h-11 rounded-lg border border-white/10 bg-zinc-950 px-3.5 text-sm text-zinc-200 outline-none transition focus:border-green-500/60"
          >
            <option>Ce mois</option>
            <option>Année</option>
          </select>
          <Link
            href="/dashboard/new"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-green-600 px-4 text-sm font-semibold text-white shadow-lg shadow-green-950/30 transition hover:bg-green-500"
          >
            <Plus className="h-4 w-4" />
            Nouveau lien de paiement
          </Link>
        </div>
      </header>

      {loadError && (
        <div role="alert" className="flex flex-col gap-3 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-red-300">{loadError}</p>
          <button
            type="button"
            onClick={loadTransactions}
            className="shrink-0 rounded-lg border border-red-500/20 px-3 py-1.5 text-xs font-medium text-red-200 transition hover:bg-red-500/10"
          >
            Réessayer
          </button>
        </div>
      )}

      <section aria-label="Indicateurs clés" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map(({ label, value, note, icon: Icon, color, progress }) => (
          <article key={label} className="rounded-xl border border-white/5 bg-black/50 p-5">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium text-zinc-400">{label}</p>
              <span className={`rounded-lg bg-white/5 p-2 ${color}`}>
                <Icon className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-4 whitespace-nowrap text-2xl font-semibold tracking-tight text-white">
              {value}
            </p>
            {progress !== undefined && (
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${progress}%` }} />
              </div>
            )}
            <p className="mt-2 text-xs text-zinc-500">{note}</p>
          </article>
        ))}
      </section>

      <section aria-label="Analyses" className="grid gap-4 xl:grid-cols-3">
        <article className="rounded-xl border border-white/5 bg-black/50 p-5 xl:col-span-2">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-white">Revenus encaissés</h2>
              <p className="mt-1 text-xs text-zinc-500">Six derniers mois — paiements confirmés</p>
            </div>
            <span className="flex items-center gap-2 text-xs text-zinc-400">
              <span className="h-2 w-2 rounded-sm bg-green-500" />
              Revenus nets
            </span>
          </div>
          <div className="relative h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueChartData} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="#27272a" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#71717a", fontSize: 12 }} />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#71717a", fontSize: 11 }}
                  tickFormatter={(value) => `${(value / 1000000).toFixed(value >= 1000000 ? 1 : 0)} M`}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "#ffffff08" }} />
                <Bar dataKey="amount" fill="#22c55e" radius={[5, 5, 0, 0]} maxBarSize={38} />
              </BarChart>
            </ResponsiveContainer>
            {!revenueChartData.some((month) => month.amount > 0) && (
              <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-zinc-600">
                Aucune donnée de revenu sur les six derniers mois
              </p>
            )}
          </div>
        </article>

        <article className="rounded-xl border border-white/5 bg-black/50 p-5">
          <div>
            <h2 className="font-semibold text-white">Répartition par prestation</h2>
            <p className="mt-1 text-xs text-zinc-500">Part des revenus confirmés</p>
          </div>
          <div className="relative mx-auto h-52 max-w-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={serviceChartData}
                  dataKey="amount"
                  nameKey="name"
                  innerRadius={58}
                  outerRadius={82}
                  paddingAngle={4}
                  stroke="none"
                >
                  {serviceChartData.map((service) => (
                    <Cell key={service.name} fill={service.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => [formatAmount(value), name]}
                  contentStyle={{ backgroundColor: "#09090b", border: "1px solid #27272a", borderRadius: 12, color: "#fff" }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-semibold text-white">{serviceChartData.length}</span>
              <span className="text-xs text-zinc-500">prestation(s)</span>
            </div>
          </div>
          {serviceChartData.length ? (
            <div className="mt-1 max-h-28 space-y-3 overflow-y-auto">
              {serviceChartData.map((service) => (
                <div key={service.name} className="flex items-center justify-between gap-3 text-xs">
                  <span className="flex min-w-0 items-center gap-2 text-zinc-400">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: service.color }} />
                    <span className="truncate">{service.name}</span>
                  </span>
                  <span className="shrink-0 font-medium text-zinc-200">{service.percentage} %</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-2 text-center text-xs text-zinc-600">Aucune prestation encaissée</p>
          )}
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <article id="transactions" className="min-w-0 rounded-xl border border-white/5 bg-black/50 xl:col-span-2">
          <div className="flex items-center justify-between gap-3 px-5 py-5">
            <div>
              <h2 className="font-semibold text-white">Dernières transactions</h2>
              <p className="mt-1 text-xs text-zinc-500">Les 10 paiements les plus récents</p>
            </div>
            <Link href="/dashboard#transactions" className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-green-400 hover:text-green-300">
              Tout voir <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
          {actionError && (
            <p role="alert" className="mx-5 mb-3 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
              {actionError}
            </p>
          )}
          {visibleTransactions.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-y border-white/5 bg-white/[0.02] text-[11px] uppercase tracking-wider text-zinc-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">Client</th>
                    <th className="px-4 py-3 font-medium">Prestation</th>
                    <th className="px-4 py-3 font-medium">Montant net</th>
                    <th className="px-4 py-3 font-medium">Statut</th>
                    <th className="px-5 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {visibleTransactions.map((transaction) => {
                    const client = getClient(transaction);
                    const isPaid = transaction.status === "paye";
                    const clientName = client?.name || "Client sans nom";
                    const initials = clientName
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((part) => part[0])
                      .join("")
                      .toUpperCase();

                    return (
                      <tr key={transaction.id} className="transition-colors hover:bg-white/[0.02]">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-semibold text-zinc-300">
                              {initials}
                            </span>
                            <div>
                              <p className="whitespace-nowrap text-xs font-medium text-zinc-200">{clientName}</p>
                              <p className="mt-0.5 text-[10px] text-zinc-600">{transaction.id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-xs text-zinc-400">{transaction.service_name || "—"}</td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-xs font-medium text-white">
                          {formatAmount(transaction.amount_net)}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-medium ${
                            isPaid ? "bg-green-500/10 text-green-400" : transaction.status === "en_attente" ? "bg-amber-500/10 text-amber-300" : "bg-white/5 text-zinc-400"
                          }`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${isPaid ? "bg-green-400" : transaction.status === "en_attente" ? "bg-amber-300" : "bg-zinc-500"}`} />
                            {isPaid ? "Payé" : transaction.status === "en_attente" ? "En attente" : transaction.status || "Inconnu"}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => openWhatsApp(transaction)}
                              aria-label={`Envoyer le lien à ${clientName} sur WhatsApp`}
                              title="Envoyer sur WhatsApp"
                              className="rounded-md p-1.5 text-zinc-500 transition hover:bg-white/5 hover:text-green-400"
                            >
                              <MessageCircle className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => copyPaymentLink(transaction.id)}
                              aria-label={`Copier le lien de paiement pour ${clientName}`}
                              title={copiedId === transaction.id ? "Lien copié" : "Copier le lien de paiement"}
                              className="rounded-md p-1.5 text-zinc-500 transition hover:bg-white/5 hover:text-white"
                            >
                              {copiedId === transaction.id ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                            </button>
                            {!isPaid && (
                              <button
                                type="button"
                                onClick={() => markAsPaid(transaction)}
                                disabled={updatingId === transaction.id}
                                aria-label={`Valider manuellement le paiement de ${clientName}`}
                                title="Confirmer manuellement"
                                className="rounded-md p-1.5 text-zinc-500 transition hover:bg-green-500/10 hover:text-green-400 disabled:cursor-wait disabled:opacity-50"
                              >
                                {updatingId === transaction.id
                                  ? <LoaderCircle className="h-4 w-4 animate-spin" />
                                  : <Check className="h-4 w-4" />}
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
            <div className="border-t border-white/5 px-5 py-14 text-center">
              <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/5 text-zinc-500">
                <Wallet className="h-5 w-5" />
              </span>
              <p className="text-sm font-medium text-zinc-300">Aucune transaction pour le moment</p>
              <p className="mt-1 text-xs text-zinc-500">Les paiements créés apparaîtront ici.</p>
            </div>
          )}
        </article>

        <article id="clients" className="rounded-xl border border-white/5 bg-black/50 p-5">
          <div className="mb-6">
            <h2 className="font-semibold text-white">Meilleurs clients</h2>
            <p className="mt-1 text-xs text-zinc-500">Par chiffre d&apos;affaires encaissé</p>
          </div>
          {topClients.length ? (
            <>
              <div className="space-y-6">
                {topClients.map((client, index) => (
                  <div key={client.name}>
                    <div className="mb-2.5 flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/5 bg-zinc-800 text-xs font-semibold text-zinc-300">
                        {client.initials || "?"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-zinc-200">{client.name}</p>
                        <p className="mt-0.5 text-xs text-zinc-500">{formatAmount(client.revenue)}</p>
                      </div>
                      <span className="text-xs text-zinc-600">0{index + 1}</span>
                    </div>
                    <div className="ml-12 h-1.5 overflow-hidden rounded-full bg-white/5">
                      <div className="h-full rounded-full bg-green-500" style={{ width: `${client.percentage}%`, opacity: 1 - index * 0.2 }} />
                    </div>
                  </div>
                ))}
              </div>
              <Link href="/dashboard#clients" className="mt-7 flex items-center justify-center rounded-lg border border-white/10 py-2.5 text-xs font-medium text-zinc-300 transition hover:border-white/20 hover:bg-white/[0.03]">
                Voir tous les clients
              </Link>
            </>
          ) : (
            <p className="py-8 text-center text-xs text-zinc-600">Aucun client avec un paiement encaissé.</p>
          )}
        </article>
      </section>
    </div>
  );
}
