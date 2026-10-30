"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Users,
  Search,
  Filter,
  FileSpreadsheet,
  Plus,
  ArrowRight,
  Phone,
  Mail,
  Calendar,
  CreditCard,
  CheckCircle2,
  Clock,
  Sparkles,
  ExternalLink,
  MessageCircle,
  Crown,
  ChevronRight,
  X,
  TrendingUp,
  Receipt,
  AlertCircle,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { exportClientsToCSV } from "@/lib/exportUtils";

function formatMoney(amount) {
  if (amount == null || isNaN(amount)) return "0 FCFA";
  return (
    new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(
      Number(amount)
    ) + " FCFA"
  );
}

function formatDate(dateStr) {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export default function ClientsDirectoryPage() {
  const router = useRouter();

  // États des données
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Recherche & Filtres
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // 'all' | 'vip' | 'actif' | 'prospect' | 'inactif'
  const [periodPreset, setPeriodPreset] = useState("all"); // 'all' | 'month' | 'quarter' | 'year' | 'custom'
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  // Modale Nouveau Client
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [creatingClient, setCreatingClient] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [newClientData, setNewClientData] = useState({
    name: "",
    phone: "",
    email: "",
    status: "actif",
    notes: "",
  });

  // Chargement des clients
  const fetchClients = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/clients");
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Impossible de charger le répertoire clients.");
      }

      setClients(data.clients || []);
    } catch (err) {
      console.error("[Clients Directory] Erreur :", err);
      setError(err.message || "Erreur de connexion au serveur.");
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  // Lecture des paramètres de recherche passés par l'URL (ex: /clients?search=Nom)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const params = new URLSearchParams(window.location.search);
      const q = params.get("search");
      if (q) setSearchQuery(decodeURIComponent(q));
      const s = params.get("status");
      if (s) setStatusFilter(s.toLowerCase());
    } catch (e) {
      console.warn("Erreur lecture query param :", e);
    }
  }, []);

  // Filtrage combiné : Période + Statut + Recherche textuelle
  const filteredClients = useMemo(() => {
    const now = new Date();
    let start = null;
    let end = null;

    if (periodPreset === "month") {
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (periodPreset === "quarter") {
      const currentQuarter = Math.floor(now.getMonth() / 3);
      start = new Date(now.getFullYear(), currentQuarter * 3, 1, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), (currentQuarter + 1) * 3, 0, 23, 59, 59, 999);
    } else if (periodPreset === "year") {
      start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
    } else if (periodPreset === "custom") {
      if (customStartDate) {
        const [sy, sm, sd] = customStartDate.split("-").map(Number);
        start = new Date(sy, sm - 1, sd, 0, 0, 0, 0);
      }
      if (customEndDate) {
        const [ey, em, ed] = customEndDate.split("-").map(Number);
        end = new Date(ey, em - 1, ed, 23, 59, 59, 999);
      }
    }

    return clients.filter((c) => {
      // 1. Filtre par période d'activité (dernière interaction ou création)
      if (start || end) {
        const interactionDate = new Date(c.last_interaction_at || c.created_at);
        if (!isNaN(interactionDate.getTime())) {
          if (start && interactionDate < start) return false;
          if (end && interactionDate > end) return false;
        }
      }

      // 2. Filtre par statut CRM
      if (statusFilter !== "all") {
        if ((c.status || "actif").toLowerCase() !== statusFilter.toLowerCase()) {
          return false;
        }
      }

      // 3. Recherche instantanée (Nom, Téléphone, Email, Notes)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const name = (c.name || "").toLowerCase();
        const phone = (c.phone || "").toLowerCase();
        const email = (c.email || "").toLowerCase();
        const notes = (c.notes || "").toLowerCase();

        return (
          name.includes(q) ||
          phone.includes(q) ||
          email.includes(q) ||
          notes.includes(q)
        );
      }

      return true;
    });
  }, [clients, periodPreset, customStartDate, customEndDate, statusFilter, searchQuery]);

  // KPIs du Répertoire (calculés sur les clients filtrés)
  const directoryKpis = useMemo(() => {
    const totalClients = filteredClients.length;
    const totalRevenue = filteredClients.reduce(
      (sum, c) => sum + (Number(c.total_paid_amount) || 0),
      0
    );
    const totalPayments = filteredClients.reduce(
      (sum, c) => sum + (Number(c.paid_payments_count) || 0),
      0
    );
    const averageBasket = totalPayments > 0 ? Math.round(totalRevenue / totalPayments) : 0;
    const vipCount = filteredClients.filter(
      (c) => (c.status || "").toLowerCase() === "vip"
    ).length;

    return {
      totalClients,
      totalRevenue,
      totalPayments,
      averageBasket,
      vipCount,
    };
  }, [filteredClients]);

  // Export CSV sur la sélection active
  const handleExportCSV = () => {
    exportClientsToCSV(filteredClients, periodPreset);
  };

  // Envoi WhatsApp en 1 clic
  const handleOpenWhatsApp = (e, client) => {
    e.stopPropagation();
    const phone = client.phone.replace(/[^\d]/g, "");
    if (!phone) return;
    const message = `Bonjour ${client.name},\n\nJ'espère que vous allez bien ! Je reste à votre entière disposition pour vos projets et besoins actuels.\n\nCordialement,\nKadmiel Business`;
    window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  // Créer un lien pour ce client
  const handleCreatePaymentForClient = (e, client) => {
    e.stopPropagation();
    router.push(
      `/dashboard/new?client_name=${encodeURIComponent(client.name)}&client_phone=${encodeURIComponent(client.phone)}`
    );
  };

  // Soumission modale nouveau client
  const handleCreateClient = async (e) => {
    e.preventDefault();
    setCreateError(null);
    setCreatingClient(true);

    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newClientData),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Échec de la création du client.");
      }

      setIsModalOpen(false);
      setNewClientData({
        name: "",
        phone: "",
        email: "",
        status: "actif",
        notes: "",
      });

      // Rafraîchir les données
      await fetchClients(false);
    } catch (err) {
      console.error("Erreur création :", err);
      setCreateError(err.message || "Erreur lors de l'enregistrement.");
    } finally {
      setCreatingClient(false);
    }
  };

  return (
    <div className="space-y-7 animate-fade-in pb-12">
      {/* ═══ HEADER DE LA PAGE ═══ */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Module CRM Intégré
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2.5">
            <Users className="h-7 w-7 text-emerald-400" />
            <span>Répertoire Clients</span>
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-zinc-400">
            Gestion centralisée de votre portefeuille, statistiques de dépenses et historique client.
          </p>
        </div>

        {/* Boutons d'action Header : Exporter CSV + Nouveau Client */}
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          <button
            type="button"
            onClick={handleExportCSV}
            title="Exporter la liste actuelle des clients en fichier CSV (Excel)"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-black hover:bg-emerald-500/10 hover:border-emerald-400 px-4 text-xs font-bold text-emerald-400 transition-all active:scale-95 shadow-sm"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>Exporter CSV ({filteredClients.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-4 text-xs font-extrabold text-black transition-all shadow-lg shadow-emerald-500/25 border border-emerald-400 active:scale-95"
          >
            <Plus className="h-4 w-4" />
            <span>Nouveau client</span>
          </button>
        </div>
      </header>

      {/* ═══ CARTES KPIS CRM ═══ */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* KPI 1 : Total Clients */}
        <div className="rounded-2xl border border-emerald-500/20 bg-[#0a0a0a] p-4 sm:p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-2">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Clients Filtrés</span>
            <Users className="h-4 w-4 text-emerald-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            {directoryKpis.totalClients}
          </p>
          <p className="mt-1 text-[11px] text-zinc-500">
            {directoryKpis.vipCount} client{directoryKpis.vipCount > 1 ? "s" : ""} VIP
          </p>
        </div>

        {/* KPI 2 : Total CA Encaissé */}
        <div className="rounded-2xl border border-emerald-500/20 bg-[#0a0a0a] p-4 sm:p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-2">
            <span className="font-semibold uppercase tracking-wider text-[11px]">CA Encaissé</span>
            <TrendingUp className="h-4 w-4 text-emerald-400" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-emerald-400 tracking-tight truncate">
            {formatMoney(directoryKpis.totalRevenue)}
          </p>
          <p className="mt-1 text-[11px] text-zinc-500">
            {directoryKpis.totalPayments} règlement{directoryKpis.totalPayments > 1 ? "s" : ""} validé{directoryKpis.totalPayments > 1 ? "s" : ""}
          </p>
        </div>

        {/* KPI 3 : Panier Moyen */}
        <div className="rounded-2xl border border-emerald-500/20 bg-[#0a0a0a] p-4 sm:p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-2">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Panier Moyen</span>
            <CreditCard className="h-4 w-4 text-emerald-400" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-white tracking-tight truncate">
            {formatMoney(directoryKpis.averageBasket)}
          </p>
          <p className="mt-1 text-[11px] text-zinc-500">
            Moyenne par prestation
          </p>
        </div>

        {/* KPI 4 : Clients VIP */}
        <div className="rounded-2xl border border-emerald-500/20 bg-[#0a0a0a] p-4 sm:p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-2">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Segment VIP</span>
            <Crown className="h-4 w-4 text-amber-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-amber-400 tracking-tight">
            {directoryKpis.vipCount}
          </p>
          <p className="mt-1 text-[11px] text-zinc-500">
            Fidélité & volume élevé
          </p>
        </div>
      </section>

      {/* ═══ BARRE D'OUTILS : RECHERCHE + FILTRES PÉRIODE & STATUTS ═══ */}
      <section className="rounded-2xl border border-emerald-500/20 bg-[#0a0a0a] p-4 sm:p-5 space-y-4 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          {/* Recherche instantanée */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Rechercher par nom, téléphone, email, notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-11 pl-10 pr-9 text-xs sm:text-sm rounded-xl bg-black border border-emerald-500/30 text-white placeholder:text-zinc-500 outline-none focus:border-emerald-400 transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Filtre de Période Avancé - Élargi & Aéré */}
          <div className="flex flex-col gap-2 w-full lg:w-auto">
            <div className="inline-flex items-center gap-1.5 sm:gap-2.5 px-3 sm:px-6 py-2 sm:py-2.5 rounded-2xl bg-black border border-emerald-500/30 shadow-xl overflow-x-auto no-scrollbar w-full sm:w-fit max-w-full shrink-0">
              <span className="text-emerald-400 shrink-0 mr-1 flex items-center">
                <Calendar className="h-4 w-4" />
              </span>

              {[
                { id: "all", label: "Tous" },
                { id: "month", label: "Ce mois" },
                { id: "quarter", label: "Ce trimestre" },
                { id: "year", label: "Cette année" },
                { id: "custom", label: "Personnalisé" },
              ].map(({ id, label }) => {
                const active = periodPreset === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setPeriodPreset(id)}
                    className={`px-3 sm:px-4 py-1.5 sm:py-2 text-[11px] sm:text-xs font-bold rounded-xl transition-all duration-150 shrink-0 whitespace-nowrap ${
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

            {/* Champs Date Personnalisée */}
            {periodPreset === "custom" && (
              <div className="inline-flex items-center gap-3 px-6 py-2.5 rounded-2xl bg-black border border-emerald-500/30 animate-slide-up text-xs flex-wrap shadow-lg w-fit">
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
                    className="p-1 text-zinc-400 hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Filtres par Statut CRM */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs pt-1 border-t border-white/5">
          <span className="text-[11px] text-zinc-500 flex items-center gap-1 mr-1 shrink-0 font-semibold">
            <Filter className="h-3.5 w-3.5 text-emerald-400" />
            Statut :
          </span>

          {[
            { id: "all", label: "Tous", count: clients.length },
            {
              id: "vip",
              label: "VIP",
              count: clients.filter((c) => (c.status || "").toLowerCase() === "vip").length,
              color: "text-amber-300",
            },
            {
              id: "actif",
              label: "Actifs",
              count: clients.filter((c) => (c.status || "actif").toLowerCase() === "actif").length,
              color: "text-emerald-300",
            },
            {
              id: "prospect",
              label: "Prospects",
              count: clients.filter((c) => (c.status || "").toLowerCase() === "prospect").length,
              color: "text-sky-300",
            },
            {
              id: "inactif",
              label: "Inactifs",
              count: clients.filter((c) => (c.status || "").toLowerCase() === "inactif").length,
              color: "text-zinc-400",
            },
          ].map(({ id, label, count, color }) => {
            const active = statusFilter === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setStatusFilter(id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition shrink-0 border ${
                  active
                    ? "bg-emerald-500 text-black border-emerald-400 shadow-md shadow-emerald-500/20"
                    : "bg-black text-zinc-400 hover:text-white border-zinc-800 hover:border-zinc-700"
                }`}
              >
                <span>{label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    active ? "bg-black/25 text-black font-extrabold" : "bg-zinc-800 text-zinc-300"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ═══ TABLEAU & CARTES DU RÉPERTOIRE ═══ */}
      <section className="rounded-2xl border border-emerald-500/20 bg-[#0a0a0a] overflow-hidden shadow-2xl">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-zinc-400">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
            <p className="text-xs">Chargement du répertoire clients...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center space-y-3">
            <AlertCircle className="h-10 w-10 text-rose-400 mx-auto" />
            <p className="text-sm font-bold text-white">{error}</p>
            <button
              type="button"
              onClick={() => fetchClients()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-white transition"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Réessayer</span>
            </button>
          </div>
        ) : filteredClients.length > 0 ? (
          <>
            {/* Version Desktop : Tableau complet */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm min-w-[900px]">
                <thead className="border-b border-white/5 bg-white/[0.02] text-[11px] uppercase tracking-wider text-zinc-400 font-bold">
                  <tr>
                    <th className="px-5 py-3.5">Client & Contact</th>
                    <th className="px-4 py-3.5">Statut CRM</th>
                    <th className="px-4 py-3.5">CA Encaissé</th>
                    <th className="px-4 py-3.5">Factures (Payées / Total)</th>
                    <th className="px-4 py-3.5">Dernière Activité</th>
                    <th className="px-5 py-3.5 text-right">Actions Rapides</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredClients.map((client) => {
                    const initials =
                      (client.name || "C")
                        .split(/\s+/)
                        .slice(0, 2)
                        .map((p) => p[0])
                        .join("")
                        .toUpperCase() || "?";

                    const isVip = (client.status || "").toLowerCase() === "vip";
                    const isProspect = (client.status || "").toLowerCase() === "prospect";
                    const isInactif = (client.status || "").toLowerCase() === "inactif";

                    return (
                      <tr
                        key={client.id}
                        onClick={() => router.push(`/clients/${client.id}`)}
                        className="hover:bg-white/[0.02] transition-colors cursor-pointer group"
                      >
                        {/* Client & Contact */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <span
                              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-black border ${
                                isVip
                                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                                  : "bg-zinc-800 text-zinc-200 border-white/10"
                              }`}
                            >
                              {initials}
                            </span>
                            <div>
                              <p className="font-bold text-white group-hover:text-emerald-400 transition-colors flex items-center gap-1.5">
                                <span>{client.name}</span>
                                {isVip && <Crown className="h-3.5 w-3.5 text-amber-400" />}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5 text-[11px] text-zinc-400 font-mono">
                                <span>{client.phone || "Téléphone manquant"}</span>
                                {client.email && (
                                  <>
                                    <span>•</span>
                                    <span className="truncate max-w-[150px] font-sans">
                                      {client.email}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Statut CRM */}
                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
                              isVip
                                ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                                : isProspect
                                ? "bg-sky-500/15 text-sky-300 border-sky-500/30"
                                : isInactif
                                ? "bg-zinc-800 text-zinc-400 border-zinc-700"
                                : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                isVip
                                  ? "bg-amber-400"
                                  : isProspect
                                  ? "bg-sky-400"
                                  : isInactif
                                  ? "bg-zinc-500"
                                  : "bg-emerald-400"
                              }`}
                            />
                            {client.status || "Actif"}
                          </span>
                        </td>

                        {/* CA Encaissé */}
                        <td className="px-4 py-4">
                          <span className="font-extrabold text-emerald-400 text-sm">
                            {formatMoney(client.total_paid_amount)}
                          </span>
                          {client.total_pending_amount > 0 && (
                            <span className="block text-[10px] text-amber-400 font-medium mt-0.5">
                              +{formatMoney(client.total_pending_amount)} en attente
                            </span>
                          )}
                        </td>

                        {/* Factures : Validées / Total */}
                        <td className="px-4 py-4 text-xs text-zinc-300">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white">
                              {client.paid_payments_count} payée{client.paid_payments_count > 1 ? "s" : ""}
                            </span>
                            <span className="text-zinc-500 font-mono">
                              / {client.total_payments_count} lien{client.total_payments_count > 1 ? "s" : ""}
                            </span>
                          </div>
                          <span className="text-[10px] text-zinc-400 block mt-0.5">
                            Taux succès : {client.success_rate} %
                          </span>
                        </td>

                        {/* Dernière Activité */}
                        <td className="px-4 py-4 text-xs text-zinc-400">
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-zinc-500" />
                            <span>{formatDate(client.last_interaction_at)}</span>
                          </div>
                        </td>

                        {/* Actions Rapides */}
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* WhatsApp en 1 clic */}
                            <button
                              type="button"
                              onClick={(e) => handleOpenWhatsApp(e, client)}
                              title="Contacter sur WhatsApp"
                              className="p-2 rounded-lg text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition"
                            >
                              <MessageCircle className="h-4 w-4" />
                            </button>

                            {/* Nouveau lien pré-rempli */}
                            <button
                              type="button"
                              onClick={(e) => handleCreatePaymentForClient(e, client)}
                              title="Créer un lien de paiement pour ce client"
                              className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
                            >
                              <Plus className="h-4 w-4 text-emerald-400" />
                            </button>

                            {/* Voir fiche */}
                            <Link
                              href={`/clients/${client.id}`}
                              onClick={(e) => e.stopPropagation()}
                              title="Ouvrir la fiche client 360°"
                              className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-emerald-500/20 hover:text-emerald-300 transition"
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Version Mobile-first : Cartes tactiles ultra-lisibles */}
            <div className="md:hidden divide-y divide-white/5">
              {filteredClients.map((client) => {
                const initials =
                  (client.name || "C")
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((p) => p[0])
                    .join("")
                    .toUpperCase() || "?";
                const isVip = (client.status || "").toLowerCase() === "vip";

                return (
                  <div
                    key={client.id}
                    onClick={() => router.push(`/clients/${client.id}`)}
                    className="p-4 active:bg-zinc-900 transition-colors cursor-pointer space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xs font-black border ${
                            isVip
                              ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                              : "bg-zinc-800 text-zinc-200 border-white/10"
                          }`}
                        >
                          {initials}
                        </span>
                        <div>
                          <p className="font-bold text-white text-sm flex items-center gap-1.5">
                            <span>{client.name}</span>
                            {isVip && <Crown className="h-3.5 w-3.5 text-amber-400" />}
                          </p>
                          <p className="text-xs text-zinc-400 font-mono mt-0.5">
                            {client.phone}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                          isVip
                            ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                            : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                        }`}
                      >
                        {client.status || "Actif"}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 bg-black/50 p-2.5 rounded-xl border border-white/5 text-xs">
                      <div>
                        <span className="text-[10px] text-zinc-500 uppercase block font-semibold">
                          CA Encaissé
                        </span>
                        <span className="font-extrabold text-emerald-400">
                          {formatMoney(client.total_paid_amount)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-zinc-500 uppercase block font-semibold">
                          Factures
                        </span>
                        <span className="text-zinc-200 font-bold">
                          {client.paid_payments_count} / {client.total_payments_count}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-zinc-500 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Actif le {formatDate(client.last_interaction_at)}
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => handleOpenWhatsApp(e, client)}
                          className="h-8 px-2.5 rounded-lg bg-emerald-500/15 text-emerald-400 text-xs font-bold border border-emerald-500/30 flex items-center gap-1"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                          <span>WhatsApp</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => handleCreatePaymentForClient(e, client)}
                          className="h-8 px-2.5 rounded-lg bg-zinc-800 text-white text-xs font-bold border border-white/10 flex items-center gap-1"
                        >
                          <Plus className="h-3.5 w-3.5 text-emerald-400" />
                          <span>Facturer</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          /* État vide */
          <div className="py-16 text-center space-y-3 px-4">
            <div className="h-14 w-14 rounded-2xl bg-zinc-900 border border-white/10 text-zinc-500 mx-auto flex items-center justify-center">
              <Users className="h-7 w-7" />
            </div>
            <h3 className="text-base font-bold text-white">Aucun client trouvé</h3>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
              {searchQuery || statusFilter !== "all" || periodPreset !== "all"
                ? "Aucun client ne correspond à vos critères de recherche ou de période."
                : "Vos clients apparaîtront automatiquement dès qu'un lien de paiement leur sera généré."}
            </p>
            {(searchQuery || statusFilter !== "all" || periodPreset !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                  setPeriodPreset("all");
                }}
                className="mt-2 text-xs font-bold text-emerald-400 hover:underline"
              >
                Réinitialiser les filtres
              </button>
            )}
          </div>
        )}
      </section>

      {/* ═══ MODALE : NOUVEAU CLIENT MANUEL ═══ */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-md bg-zinc-950 border border-emerald-500/30 rounded-3xl p-6 sm:p-7 shadow-2xl shadow-emerald-500/10 space-y-5 animate-slide-up">
            {/* Header de la modale */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Ajouter un Client</h3>
                  <p className="text-[11px] text-zinc-400">Enregistrer un contact dans le répertoire CRM</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {createError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateClient} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">
                  Nom du client ou de l'entreprise *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex : Koffi Tech ou Jean Kouassi"
                  value={newClientData.name}
                  onChange={(e) => setNewClientData({ ...newClientData, name: e.target.value })}
                  className="w-full h-11 px-3.5 text-xs rounded-xl bg-black border border-white/10 text-white outline-none focus:border-emerald-400 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">
                  Numéro WhatsApp (Côte d'Ivoire) *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="Ex : +2250708091011 ou 0708091011"
                  value={newClientData.phone}
                  onChange={(e) => setNewClientData({ ...newClientData, phone: e.target.value })}
                  className="w-full h-11 px-3.5 text-xs rounded-xl bg-black border border-white/10 text-white outline-none focus:border-emerald-400 font-mono font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">
                  Adresse Email (optionnelle)
                </label>
                <input
                  type="email"
                  placeholder="client@entreprise.ci"
                  value={newClientData.email}
                  onChange={(e) => setNewClientData({ ...newClientData, email: e.target.value })}
                  className="w-full h-11 px-3.5 text-xs rounded-xl bg-black border border-white/10 text-white outline-none focus:border-emerald-400 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">
                  Segment / Statut CRM
                </label>
                <select
                  value={newClientData.status}
                  onChange={(e) => setNewClientData({ ...newClientData, status: e.target.value })}
                  className="w-full h-11 px-3.5 text-xs rounded-xl bg-black border border-white/10 text-white outline-none focus:border-emerald-400 font-bold"
                >
                  <option value="actif">Actif (Client régulier)</option>
                  <option value="vip">VIP (Client prioritaire & gros volume)</option>
                  <option value="prospect">Prospect (Nouveau contact)</option>
                  <option value="inactif">Inactif (Sans projet en cours)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">
                  Notes internes libres (optionnelles)
                </label>
                <textarea
                  rows="2"
                  placeholder="Ex : Préfère régler par Wave, accord tarifaire de 10% sur les devis..."
                  value={newClientData.notes}
                  onChange={(e) => setNewClientData({ ...newClientData, notes: e.target.value })}
                  className="w-full p-3 text-xs rounded-xl bg-black border border-white/10 text-white outline-none focus:border-emerald-400 font-medium resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="h-11 px-4 rounded-xl text-xs font-bold text-zinc-400 hover:text-white bg-zinc-900 transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={creatingClient}
                  className="h-11 px-5 rounded-xl text-xs font-extrabold text-black bg-emerald-500 hover:bg-emerald-400 transition-all shadow-md shadow-emerald-500/20 flex items-center gap-2 disabled:opacity-50"
                >
                  {creatingClient ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-black" />
                      <span>Enregistrement...</span>
                    </>
                  ) : (
                    <span>Créer le contact</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
