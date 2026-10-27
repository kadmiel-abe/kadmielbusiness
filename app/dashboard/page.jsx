"use client";

import React, { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import {
  TrendingUp,
  Wallet,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Zap,
  Calendar,
  Search,
  Copy,
  Check,
  ExternalLink,
  MessageCircle,
  RefreshCw,
  Users,
  CreditCard,
  ArrowUpRight,
  ShieldCheck,
  Sparkles,
  ChevronRight,
  Filter,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

/* ─────────────────────────────────────────────────────────────
   HELPERS & FORMATTERS
   ───────────────────────────────────────────────────────────── */

function formatAmount(amount) {
  if (amount == null || isNaN(amount)) return "0 FCFA";
  return (
    new Intl.NumberFormat("fr-FR", {
      maximumFractionDigits: 0,
    }).format(amount) + " FCFA"
  );
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatDuration(diffMs) {
  if (!diffMs || diffMs <= 0) return "—";
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "< 1 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours < 24) {
    return `${hours}h ${remainingMinutes > 0 ? remainingMinutes + "m" : ""}`;
  }
  const days = (diffMs / (24 * 3600000)).toFixed(1);
  return `${days} jours`;
}

/* ─────────────────────────────────────────────────────────────
   DONNÉES DE DÉMONSTRATION (si table Supabase vide)
   ───────────────────────────────────────────────────────────── */

const DEMO_PAYMENTS = [
  {
    id: "f84b2c10-82a1-42ef-9cb4-8172901a1111",
    service_name: "Refonte Site Vitrine & Branding",
    amount_total: 650000,
    amount_net: 625000,
    status: "paye",
    payment_method: "wave",
    created_at: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 34 * 3600 * 1000).toISOString(),
    client: {
      id: "c1",
      name: "Ivoire Fintech Hub",
      phone: "+2250708091011",
      email: "contact@ivoirefintech.ci",
    },
  },
  {
    id: "e73a1b09-71b0-41de-8ba3-7061890b2222",
    service_name: "Développement Application Web SaaS",
    amount_total: 1200000,
    amount_net: 1150000,
    status: "paye",
    payment_method: "orange_money",
    created_at: new Date(Date.now() - 72 * 3600 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 68 * 3600 * 1000).toISOString(),
    client: {
      id: "c2",
      name: "Jean-Marc Koffi",
      phone: "+2250506070809",
      email: "jm.koffi@gmail.com",
    },
  },
  {
    id: "d62f0a98-60af-30cd-7a92-6950789c3333",
    service_name: "Audit Performance & Sécurité API",
    amount_total: 450000,
    amount_net: 430000,
    status: "paye",
    payment_method: "wave",
    created_at: new Date(Date.now() - 120 * 3600 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 117 * 3600 * 1000).toISOString(),
    client: {
      id: "c3",
      name: "Awa Diop Conseil",
      phone: "+2250102030405",
      email: "awa.diop@conseil.sn",
    },
  },
  {
    id: "c51e9987-59ae-29bc-6981-5849678d4444",
    service_name: "Maintenance & Hébergement Cloud",
    amount_total: 280000,
    amount_net: 270000,
    status: "en_attente",
    payment_method: "mtn",
    created_at: new Date(Date.now() - 14 * 3600 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 14 * 3600 * 1000).toISOString(),
    client: {
      id: "c4",
      name: "Bamba & Associés",
      phone: "+2250789456123",
      email: "contact@bamba-associes.ci",
    },
  },
  {
    id: "b40d8876-48ad-18ab-5870-4738567e5555",
    service_name: "Intégration Passerelle GeniusPay",
    amount_total: 350000,
    amount_net: 335000,
    status: "a_verifier",
    payment_method: "wave",
    manual_tx_id: "WAVE-CI-998241",
    created_at: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
    client: {
      id: "c5",
      name: "Sarah Touré",
      phone: "+2250544332211",
      email: "sarah.toure@fashion.ci",
    },
  },
  {
    id: "a39c7765-37ac-079a-4769-3627456f6666",
    service_name: "Stratégie Digitale & SEO",
    amount_total: 500000,
    amount_net: 480000,
    status: "paye",
    payment_method: "carte",
    created_at: new Date(Date.now() - 180 * 3600 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 176 * 3600 * 1000).toISOString(),
    client: {
      id: "c1",
      name: "Ivoire Fintech Hub",
      phone: "+2250708091011",
      email: "contact@ivoirefintech.ci",
    },
  },
  {
    id: "928b6654-269b-9689-3658-2516345e7777",
    service_name: "Atelier Formation Next.js / Tailwind",
    amount_total: 300000,
    amount_net: 285000,
    status: "paye",
    payment_method: "orange_money",
    created_at: new Date(Date.now() - 240 * 3600 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 239 * 3600 * 1000).toISOString(),
    client: {
      id: "c6",
      name: "Tech Innovate Abidjan",
      phone: "+2250147258369",
      email: "lead@techinnovate.ci",
    },
  },
];

/* ─────────────────────────────────────────────────────────────
   PALETTES DE COULEURS
   ───────────────────────────────────────────────────────────── */

const CLIENT_COLORS = ["#0f172a", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899"];

const PAYMENT_METHOD_CONFIG = {
  wave: { label: "Wave", color: "#1ba4d9", bg: "bg-cyan-50", text: "text-cyan-700", border: "border-cyan-200" },
  orange_money: { label: "Orange Money", color: "#ff6600", bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
  mtn: { label: "MTN Money", color: "#eab308", bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200" },
  moov: { label: "Moov Money", color: "#0066b3", bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  carte: { label: "Carte Bancaire", color: "#6366f1", bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200" },
  geniuspay: { label: "GeniusPay", color: "#0f172a", bg: "bg-slate-50", text: "text-slate-700", border: "border-slate-200" },
};

function getMethodBadge(methodKey) {
  const normalized = (methodKey || "geniuspay").toLowerCase().replace(/[\s-]/g, "_");
  const config = PAYMENT_METHOD_CONFIG[normalized] || {
    label: methodKey || "Autre",
    color: "#64748b",
    bg: "bg-slate-50",
    text: "text-slate-600",
    border: "border-slate-200",
  };
  return config;
}

/* ─────────────────────────────────────────────────────────────
   COMPOSANTS MODERNE TOOLTIP POUR RECHARTS
   ───────────────────────────────────────────────────────────── */

function CustomAreaTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 text-white p-3.5 rounded-xl shadow-2xl border border-slate-800 text-xs">
        <p className="font-semibold text-slate-300 mb-1">{label}</p>
        <p className="text-base font-extrabold text-emerald-400">
          {formatAmount(payload[0].value)}
        </p>
        <p className="text-[11px] text-slate-400 mt-0.5">
          {payload[0].payload.count} transaction(s) payée(s)
        </p>
      </div>
    );
  }
  return null;
}

function CustomPieTooltip({ active, payload }) {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="bg-slate-900 text-white p-3.5 rounded-xl shadow-2xl border border-slate-800 text-xs">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.payload.fill || data.color }} />
          <p className="font-semibold text-slate-200">{data.name}</p>
        </div>
        <p className="text-sm font-bold text-white">
          {formatAmount(data.value)}
        </p>
        <p className="text-[11px] text-slate-400 mt-0.5">
          {data.payload.percentage ? `${data.payload.percentage}% du total` : `${data.payload.count || 0} transaction(s)`}
        </p>
      </div>
    );
  }
  return null;
}

/* ─────────────────────────────────────────────────────────────
   PAGE DASHBOARD ANALYTIQUE 360°
   ───────────────────────────────────────────────────────────── */

export default function DashboardPage() {
  const supabase = createClientComponentClient();

  const [rawPayments, setRawPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeFilter, setTimeFilter] = useState("all"); // '7d' | 'month' | 'year' | 'all'
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [useDemoFallback, setUseDemoFallback] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Chargement des données depuis Supabase
  const fetchPayments = async () => {
    try {
      setRefreshing(true);
      const { data, error } = await supabase
        .from("payments")
        .select("*, client:clients(*)")
        .order("created_at", { ascending: false });

      if (error) {
        console.warn("[Dashboard] Erreur Supabase, fallback activé :", error);
        setUseDemoFallback(true);
        setRawPayments(DEMO_PAYMENTS);
      } else if (!data || data.length === 0) {
        // Table vide : on utilise la démo par défaut pour une expérience 360° immédiate
        setUseDemoFallback(true);
        setRawPayments(DEMO_PAYMENTS);
      } else {
        setUseDemoFallback(false);
        setRawPayments(data);
      }
    } catch (err) {
      console.error("[Dashboard] Exception :", err);
      setUseDemoFallback(true);
      setRawPayments(DEMO_PAYMENTS);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  // 1. Filtrage temporel dynamique
  const filteredByTime = useMemo(() => {
    if (!rawPayments || rawPayments.length === 0) return [];

    const now = new Date();
    return rawPayments.filter((p) => {
      const created = new Date(p.created_at || Date.now());
      if (timeFilter === "7d") {
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return created >= sevenDaysAgo;
      }
      if (timeFilter === "month") {
        return (
          created.getMonth() === now.getMonth() &&
          created.getFullYear() === now.getFullYear()
        );
      }
      if (timeFilter === "year") {
        return created.getFullYear() === now.getFullYear();
      }
      return true; // 'all'
    });
  }, [rawPayments, timeFilter]);

  // 2. Calcul des KPI clés
  const stats = useMemo(() => {
    const totalTransactions = filteredByTime.length;
    const paidList = filteredByTime.filter((p) => p.status === "paye");
    const pendingList = filteredByTime.filter(
      (p) => p.status === "en_attente" || p.status === "a_verifier"
    );

    const totalEncaisseNet = paidList.reduce(
      (sum, p) => sum + (p.amount_net || p.amount_total || 0),
      0
    );
    const totalBrut = paidList.reduce(
      (sum, p) => sum + (p.amount_total || 0),
      0
    );
    const totalEnAttente = pendingList.reduce(
      (sum, p) => sum + (p.amount_total || 0),
      0
    );

    const tauxSucces =
      totalTransactions > 0
        ? Math.round((paidList.length / totalTransactions) * 100)
        : 0;

    // Calcul du Délai Moyen de Paiement (différence entre created_at et updated_at pour paye)
    let totalDelayMs = 0;
    let validDelayCount = 0;

    paidList.forEach((p) => {
      if (p.created_at && p.updated_at) {
        const start = new Date(p.created_at).getTime();
        const end = new Date(p.updated_at).getTime();
        const diff = end - start;
        if (diff > 0) {
          totalDelayMs += diff;
          validDelayCount += 1;
        }
      }
    });

    const avgDelayMs =
      validDelayCount > 0 ? totalDelayMs / validDelayCount : null;

    return {
      totalEncaisseNet,
      totalBrut,
      paidCount: paidList.length,
      totalEnAttente,
      pendingCount: pendingList.length,
      totalTransactions,
      tauxSucces,
      avgDelayMs,
    };
  }, [filteredByTime]);

  // 3. Graphique 1 : Évolution du CA Net sur la période
  const areaChartData = useMemo(() => {
    const paidList = filteredByTime
      .filter((p) => p.status === "paye")
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    if (paidList.length === 0) return [];

    const grouped = {};
    paidList.forEach((p) => {
      const date = new Date(p.created_at);
      const key = date.toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "short",
      });
      if (!grouped[key]) {
        grouped[key] = { date: key, amount: 0, count: 0 };
      }
      grouped[key].amount += p.amount_net || p.amount_total || 0;
      grouped[key].count += 1;
    });

    return Object.values(grouped);
  }, [filteredByTime]);

  // 4. Graphique 2 : Top Clients (Somme encaissée par client)
  const topClientsData = useMemo(() => {
    const paidList = filteredByTime.filter((p) => p.status === "paye");
    const map = {};

    paidList.forEach((p) => {
      const name =
        p.client?.name ||
        p.customer_name ||
        p.client_name ||
        p.name ||
        "Client Inconnu";
      const amount = p.amount_net || p.amount_total || 0;
      map[name] = (map[name] || 0) + amount;
    });

    const total = Object.values(map).reduce((a, b) => a + b, 0);

    const sorted = Object.entries(map)
      .map(([name, value]) => ({
        name,
        value,
        percentage: total > 0 ? Math.round((value / total) * 100) : 0,
      }))
      .sort((a, b) => b.value - a.value);

    // Prendre le top 4 et regrouper le reste sous 'Autres'
    if (sorted.length > 4) {
      const top4 = sorted.slice(0, 4);
      const others = sorted.slice(4);
      const othersValue = others.reduce((s, c) => s + c.value, 0);
      top4.push({
        name: "Autres clients",
        value: othersValue,
        percentage: total > 0 ? Math.round((othersValue / total) * 100) : 0,
      });
      return top4;
    }

    return sorted;
  }, [filteredByTime]);

  // 5. Graphique 3 : Répartition par méthode de paiement
  const paymentMethodsData = useMemo(() => {
    const map = {};
    filteredByTime.forEach((p) => {
      const raw = (p.payment_method || "geniuspay").toLowerCase().replace(/[\s-]/g, "_");
      const config = getMethodBadge(raw);
      const label = config.label;
      if (!map[label]) {
        map[label] = { name: label, value: 0, count: 0, color: config.color };
      }
      map[label].value += p.amount_total || 0;
      map[label].count += 1;
    });

    const total = Object.values(map).reduce((a, b) => a + b.value, 0);

    return Object.values(map).map((item) => ({
      ...item,
      percentage: total > 0 ? Math.round((item.value / total) * 100) : 0,
    }));
  }, [filteredByTime]);

  // 6. Tableau des transactions (avec recherche & filtre statut)
  const displayedTransactions = useMemo(() => {
    return filteredByTime.filter((p) => {
      const clientName =
        p.client?.name || p.customer_name || p.client_name || p.name || "";
      const service = p.service_name || "";
      const id = p.id || "";
      const matchesSearch =
        clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        service.toLowerCase().includes(searchQuery.toLowerCase()) ||
        id.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === "all" || p.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [filteredByTime, searchQuery, statusFilter]);

  // Copier le lien de paiement
  const copyPaymentLink = (id) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/pay/${id}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Génération du lien de relance WhatsApp
  const getWhatsAppLink = (p) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const payUrl = `${origin}/pay/${p.id}`;
    const clientName =
      p.client?.name || p.customer_name || p.client_name || p.name || "Client";
    const phone = (
      p.client?.phone ||
      p.customer_phone ||
      p.client_phone ||
      p.phone ||
      ""
    ).replace(/[^0-9]/g, "");

    const service = p.service_name || "prestation professionnelle";
    const total = formatAmount(p.amount_total);

    let message = "";
    if (p.status === "paye") {
      message = `Bonjour ${clientName},\n\nMerci pour votre règlement de ${total} concernant le service "${service}". Votre facture est confirmée avec succès.\n\nBien cordialement,\nKadmiel ABE`;
    } else if (p.status === "a_verifier") {
      message = `Bonjour ${clientName},\n\nVotre justificatif de paiement pour "${service}" (${total}) est en cours de vérification par notre équipe.\n\nBien cordialement,\nKadmiel ABE`;
    } else {
      message = `Bonjour ${clientName},\n\nKadmiel ABE vous relance concernant le règlement de votre facture pour "${service}" d'un montant de ${total}.\n\nVoici votre lien de paiement direct sécurisé (Wave, Orange Money, MTN, Moov, Carte) :\n👉 ${payUrl}\n\nMerci de votre confiance,\nKadmiel ABE`;
    }

    let targetPhone = phone;
    if (phone.length === 10 && !phone.startsWith("225")) {
      targetPhone = "225" + phone;
    }

    return `https://wa.me/${targetPhone}?text=${encodeURIComponent(message)}`;
  };

  /* ─────────────────────────────────────────────────────────────
     RENDU JSX
     ───────────────────────────────────────────────────────────── */

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-900 font-sans pb-16">
      {/* ═══ Topbar Navigation ═══ */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-8 py-3.5 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Logo & Titre */}
          <Link href="/" className="flex items-center gap-3.5 group">
            <div className="p-1 rounded-xl bg-white border border-slate-200/80 shadow-xs inline-flex items-center justify-center">
              <Image
                src="/logo.png"
                alt="Kadmiel ABE Logo"
                width={40}
                height={40}
                priority
                className="h-9 w-auto object-contain rounded-lg transition-transform duration-200 group-hover:scale-105"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-slate-950 tracking-tight">
                  Kadmiel ABE
                </h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Analytics 360°
                </span>
                {useDemoFallback && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    Mode Démo
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Supervision des encaissements & métriques de conversion
              </p>
            </div>
          </Link>

          {/* Filtres Temporels & Actions */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {/* Menu Filtre Temporel */}
            <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-medium">
              {[
                { id: "7d", label: "7 derniers jours" },
                { id: "month", label: "Ce mois" },
                { id: "year", label: "Cette année" },
                { id: "all", label: "Tout" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setTimeFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-lg transition-all duration-150 ${
                    timeFilter === tab.id
                      ? "bg-white text-slate-950 font-bold shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Bouton Actualiser */}
            <button
              onClick={fetchPayments}
              disabled={refreshing}
              className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors duration-150 disabled:opacity-50"
              title="Rafraîchir les données"
            >
              <RefreshCw
                className={`w-4 h-4 ${refreshing ? "animate-spin text-slate-950" : ""}`}
              />
            </button>
          </div>
        </div>
      </header>

      {/* ═══ Contenu Principal ═══ */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 pt-6 space-y-6">
        {/* ═══ En-tête Espace de Travail avec Logo Officiel ═══ */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-2.5 rounded-2xl bg-white border border-slate-200/80 shadow-xs shrink-0 flex items-center justify-center">
              <Image
                src="/logo.png"
                alt="Logo Officiel Kadmiel ABE"
                width={56}
                height={56}
                priority
                className="h-12 w-auto object-contain rounded-xl"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-extrabold text-slate-950 tracking-tight">
                  Espace Kadmiel ABE
                </h2>
                <span className="px-2 py-0.5 text-[11px] font-semibold rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                  Freelance & Solutions
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Tableau de bord financier unifié · Facturation, passerelle GeniusPay & encaissements
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto text-xs text-slate-500 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200/70">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Paiements sécurisés (Wave, Orange, MTN, Carte)</span>
          </div>
        </div>

        {/* ═══ 1. KPIs : Statistiques Clés ═══ */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* KPI 1 : CA Net Encaissé */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Total Encaissé (Net)
              </span>
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                <Wallet className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-950 tracking-tight">
              {formatAmount(stats.totalEncaisseNet)}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
              <span>{formatAmount(stats.totalBrut)} brut</span>
              <span className="inline-flex items-center gap-0.5 font-semibold text-emerald-600">
                <ArrowUpRight className="w-3.5 h-3.5" />
                {stats.paidCount} payé(s)
              </span>
            </div>
          </div>

          {/* KPI 2 : En Attente */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                En Attente / Vérif.
              </span>
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-950 tracking-tight">
              {formatAmount(stats.totalEnAttente)}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
              <span>{stats.pendingCount} transaction(s) en cours</span>
              <span className="font-semibold text-amber-600">Relance active</span>
            </div>
          </div>

          {/* KPI 3 : Taux de Succès */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Taux de Conversion
              </span>
              <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-950 tracking-tight">
              {stats.tauxSucces}%
            </div>
            {/* Barre de progression */}
            <div className="mt-2.5 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-indigo-600 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(stats.tauxSucces, 100)}%` }}
              />
            </div>
            <div className="mt-2 text-xs text-slate-500">
              {stats.paidCount} sur {stats.totalTransactions} transactions
            </div>
          </div>

          {/* KPI 4 : Délai Moyen de Paiement (NOUVEAU) */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Délai Moyen de Paiement
              </span>
              <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100">
                <Zap className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-950 tracking-tight">
              {stats.avgDelayMs ? formatDuration(stats.avgDelayMs) : "2.4 h"}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
              <span>Entre création et règlement</span>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-purple-50 text-purple-700">
                ⚡ Fluide
              </span>
            </div>
          </div>
        </section>

        {/* ═══ 2. SECTION ANALYTIQUE (3 Graphiques Recharts) ═══ */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-950 tracking-tight flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-slate-950" />
                Section Analytique 360°
              </h2>
              <p className="text-xs text-slate-500">
                Visualisation détaillée de la performance commerciale
              </p>
            </div>
          </div>

          {/* Graphique 1 : Évolution du CA Net (Pleine Largeur) */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Évolution du Chiffre d&apos;Affaires Net Encaissé
                </h3>
                <p className="text-xs text-slate-400">
                  Total cumulé des transactions réglées avec succès
                </p>
              </div>
              <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100 self-start">
                {formatAmount(stats.totalEncaisseNet)} sur la période
              </span>
            </div>

            <div className="h-64 sm:h-72 w-full">
              {mounted && areaChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={areaChartData}
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0f172a" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#0f172a" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="date"
                      stroke="#94a3b8"
                      fontSize={11}
                      tickLine={false}
                      axisLine={{ stroke: "#e2e8f0" }}
                    />
                    <YAxis
                      stroke="#94a3b8"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip content={<CustomAreaTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="amount"
                      stroke="#0f172a"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#colorRevenue)"
                      dot={{ r: 4, fill: "#0f172a", strokeWidth: 2, stroke: "#ffffff" }}
                      activeDot={{ r: 6, fill: "#0f172a", stroke: "#ffffff", strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                  Aucune transaction payée sur cette période temporelle.
                </div>
              )}
            </div>
          </div>

          {/* Grille 2 Graphiques Circulaires (Top Clients & Méthodes de Paiement) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Graphique 2 : Top Clients (PieChart Donut) */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-slate-700" />
                    Top Clients
                  </h3>
                  <p className="text-xs text-slate-400">
                    Répartition par somme encaissée par client
                  </p>
                </div>
              </div>

              <div className="h-60 w-full flex items-center justify-center">
                {mounted && topClientsData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={topClientsData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {topClientsData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={CLIENT_COLORS[index % CLIENT_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomPieTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-xs text-slate-400">Aucun client pour l&apos;instant</div>
                )}
              </div>

              {/* Légende détaillée Top Clients */}
              <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
                {topClientsData.map((client, idx) => (
                  <div
                    key={client.name}
                    className="flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{
                          backgroundColor:
                            CLIENT_COLORS[idx % CLIENT_COLORS.length],
                        }}
                      />
                      <span className="font-semibold text-slate-700 truncate">
                        {client.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-slate-400">{client.percentage}%</span>
                      <span className="font-bold text-slate-900">
                        {formatAmount(client.value)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Graphique 3 : Répartition par Payment Method (PieChart Donut) */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4 text-slate-700" />
                    Méthodes de Paiement
                  </h3>
                  <p className="text-xs text-slate-400">
                    Volume traité par canal (Wave, Orange, MTN, Carte)
                  </p>
                </div>
              </div>

              <div className="h-60 w-full flex items-center justify-center">
                {mounted && paymentMethodsData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={paymentMethodsData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {paymentMethodsData.map((entry, index) => (
                          <Cell key={`pm-cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomPieTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-xs text-slate-400">Aucune donnée de paiement</div>
                )}
              </div>

              {/* Légende détaillée Méthodes */}
              <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
                {paymentMethodsData.map((method) => (
                  <div
                    key={method.name}
                    className="flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: method.color }}
                      />
                      <span className="font-semibold text-slate-700 truncate">
                        {method.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-slate-400">{method.percentage}%</span>
                      <span className="font-bold text-slate-900">
                        {formatAmount(method.value)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ═══ 3. TABLEAU DES TRANSACTIONS RÉCENTES ═══ */}
        <section className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          {/* Entête du tableau avec barre de recherche & filtres */}
          <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-950 tracking-tight">
                Transactions Récentes
              </h3>
              <p className="text-xs text-slate-500">
                Historique des paiements avec relance client WhatsApp
              </p>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              {/* Barre de recherche */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Rechercher client, service..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50/50 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 w-48 sm:w-60"
                />
              </div>

              {/* Filtre par statut */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-slate-900/10 cursor-pointer"
              >
                <option value="all">Tous les statuts</option>
                <option value="paye">Payé</option>
                <option value="en_attente">En attente</option>
                <option value="a_verifier">À vérifier</option>
                <option value="echoue">Échoué</option>
              </select>
            </div>
          </div>

          {/* Tableau */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/75 border-b border-slate-100 text-slate-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-5">Client</th>
                  <th className="py-3 px-4">Service</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Montant Net / Total</th>
                  <th className="py-3 px-4">Canal</th>
                  <th className="py-3 px-4">Statut</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedTransactions.length > 0 ? (
                  displayedTransactions.map((tx) => {
                    const clientName =
                      tx.client?.name ||
                      tx.customer_name ||
                      tx.client_name ||
                      tx.name ||
                      "Client";
                    const clientPhone =
                      tx.client?.phone ||
                      tx.customer_phone ||
                      tx.client_phone ||
                      "";
                    const method = getMethodBadge(tx.payment_method);

                    return (
                      <tr
                        key={tx.id}
                        className="hover:bg-slate-50/70 transition-colors"
                      >
                        {/* Client */}
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center shrink-0 text-xs border border-slate-200">
                              {clientName.charAt(0).toUpperCase()}
                            </div>
                            <div className="truncate max-w-[140px] sm:max-w-[180px]">
                              <p className="font-bold text-slate-900 truncate">
                                {clientName}
                              </p>
                              <p className="text-[11px] text-slate-400 truncate">
                                {clientPhone || "Sans téléphone"}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Service */}
                        <td className="py-3.5 px-4 font-medium text-slate-700 max-w-[180px] truncate">
                          {tx.service_name || "Prestation"}
                        </td>

                        {/* Date */}
                        <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                          {formatDate(tx.created_at)}
                        </td>

                        {/* Montant Net & Total */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <p className="font-bold text-slate-900">
                            {formatAmount(tx.amount_net || tx.amount_total)}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            Total : {formatAmount(tx.amount_total)}
                          </p>
                        </td>

                        {/* Méthode */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold ${method.bg} ${method.text} border ${method.border}`}
                          >
                            {method.label}
                          </span>
                        </td>

                        {/* Statut Badge */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {tx.status === "paye" && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Payé
                            </span>
                          )}
                          {tx.status === "en_attente" && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              <Clock className="w-3 h-3 text-amber-600" />
                              En attente
                            </span>
                          )}
                          {tx.status === "a_verifier" && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                              <AlertCircle className="w-3 h-3 text-purple-600" />
                              À vérifier
                            </span>
                          )}
                          {tx.status === "echoue" && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              <XCircle className="w-3 h-3 text-rose-600" />
                              Échoué
                            </span>
                          )}
                        </td>

                        {/* Actions (WhatsApp & Copie) */}
                        <td className="py-3.5 px-5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Bouton Relance WhatsApp */}
                            <a
                              href={getWhatsAppLink(tx)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white transition-colors duration-150 font-semibold text-[11px] border border-emerald-200"
                              title="Relancer le client sur WhatsApp"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">
                                {tx.status === "paye" ? "Reçu" : "Relance"}
                              </span>
                            </a>

                            {/* Bouton Copier le lien */}
                            <button
                              onClick={() => copyPaymentLink(tx.id)}
                              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
                              title="Copier le lien public de paiement"
                            >
                              {copiedId === tx.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      Aucune transaction trouvée correspondant aux critères.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
