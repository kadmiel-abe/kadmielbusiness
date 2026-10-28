"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import {
  Check,
  Clock3,
  Copy,
  ExternalLink,
  LoaderCircle,
  MessageCircle,
  Plus,
  ReceiptText,
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
const clientOf = (tx) => (Array.isArray(tx.client) ? tx.client[0] : tx.client);
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
  const supabase = useMemo(() => createClientComponentClient(), []);
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
      // CORRECTION : Appel de la bonne table 'paiements' et jointure sur 'clients' avec les bonnes colonnes
      const { data, error } = await supabase
        .from("paiements")
        .select("*, client:clients(nom, telephone)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setTransactions(data ?? []);
    } catch (error) {
      console.error("Erreur lors du chargement des transactions :", error);
      setLoadError("Impossible de charger les données Supabase. Vérifiez la connexion et les autorisations.");
      setTransactions([]);
    } finally {
      if (showLoader) setIsLoading(false);
    }
  }, [supabase]);

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
    // CORRECTION : Utilisation de 'statut', 'montant_net', 'montant_total'
    const paid = periodTransactions.filter((tx) => tx.statut === "paye");
    const pending = periodTransactions.filter((tx) => tx.statut === "en_attente");
    setKpis({
      revenue: paid.reduce((sum, tx) => sum + (Number(tx.montant_net) || 0), 0),
      pending: pending.reduce((sum, tx) => sum + (Number(tx.montant_total) || 0), 0),
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
      if (tx.statut !== "paye") return;
      const date = dateOf(tx);
      const month = months.find((item) => item.year === date?.getFullYear() && item.month === date?.getMonth());
      if (month) month.amount += Number(tx.montant_net) || 0;
    });
    return months;
  }, [transactions]);

  const serviceData = useMemo(() => {
    const totals = new Map();
    periodTransactions.filter((tx) => tx.statut === "paye").forEach((tx) => {
      // CORRECTION : tx.service au lieu de tx.service_name
      const name = tx.service?.trim() || "Prestation non renseignée";
      totals.set(name, (totals.get(name) || 0) + (Number(tx.montant_net) || 0));
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
    periodTransactions.filter((tx) => tx.statut === "paye").forEach((tx) => {
      // CORRECTION : client.nom au lieu de client.name
      const name = clientOf(tx)?.nom || "Client sans nom";
      totals.set(name, (totals.get(name) || 0) + (Number(tx.montant_net) || 0));
    });
    const clients = Array.from(totals, ([name, revenue]) => ({ name, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 3);
    const max = clients[0]?.revenue || 0;
    return clients.map((client) => ({
      ...client,
      initials: client.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase(),
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
    const client = clientOf(tx);
    // CORRECTION : client.telephone et client.nom
    if (!client?.telephone) {
      setActionError("Aucun numéro de téléphone n’est enregistré pour ce client.");
      return;
    }
    setActionError("");
    const link = `${window.location.origin}/pay/${tx.id}`;
    const message = `Bonjour ${client.nom || ""}, voici votre lien de paiement sécurisé pour la prestation "${tx.service || "votre prestation"}" : ${link}`;
    const phone = client.telephone.replace(/[^\d]/g, "");
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  };

  const markAsPaid = async (tx) => {
    setActionError("");
    setUpdatingId(tx.id);
    try {
      // CORRECTION : Mise à jour de 'statut'
      const { error } = await supabase
        .from("paiements")
        .update({ statut: "paye" })
        .eq("id", tx.id);
      if (error) throw error;
      setTransactions((current) => current.map((item) =>
        item.id === tx.id
          ? { ...item, statut: "paye" }
          : item
      ));
      await loadTransactions(false);
    } catch (error) {
      console.error("Erreur lors de la validation manuelle du paiement :", error);
      setActionError("Impossible de valider le paiement. Vérifiez vos autorisations Supabase.");
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
          {/* CORRECTION : Lien vers /dashboard/nouveau */}
          <Link href="/dashboard/nouveau" className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-lime-400 px-4 text-sm font-semibold text-black transition hover:bg-lime-500">
            <Plus className="h-4 w-4" />Nouveau lien
          </Link>
        </div>
      </header>

      {loadError