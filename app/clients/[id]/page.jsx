"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Crown,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  HelpCircle,
  LoaderCircle,
  Mail,
  MessageCircle,
  Phone,
  Plus,
  RefreshCw,
  Save,
  Search,
  Share2,
  ShieldAlert,
  Sparkles,
  Tag,
  Trash2,
  TrendingUp,
  User,
  Wallet,
  X,
  XCircle,
} from "lucide-react";
import { generateReceiptPDF } from "@/lib/exportUtils";

/* ─────────────────────────────────────────────────────────────
   HELPERS & FORMATAGE
   ───────────────────────────────────────────────────────────── */

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
    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return dateStr;
  }
}

function formatDateShort(dateStr) {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "-";
    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(d);
  } catch {
    return dateStr;
  }
}

const txAmountNet = (tx) => Number(tx.amount_net ?? tx.montant_net) || 0;
const txAmountTotal = (tx) => Number(tx.amount_total ?? tx.montant_total) || 0;
const txService = (tx) => tx.service_name || tx.service || "Prestation de service";

const txIsPaid = (tx) => tx.status === "paye" || tx.statut === "paye";
const txIsPending = (tx) => tx.status === "en_attente" || tx.statut === "en_attente";
const txIsToVerify = (tx) => tx.status === "a_verifier" || tx.statut === "a_verifier";
const txIsExpired = (tx) => {
  if (tx.status === "expire" || tx.statut === "expire") return true;
  if (!txIsPaid(tx) && tx.expires_at) {
    return new Date() > new Date(tx.expires_at);
  }
  return false;
};

/* ─────────────────────────────────────────────────────────────
   PAGE FICHE CLIENT CRM DÉTAILLÉE (/clients/[id])
   ───────────────────────────────────────────────────────────── */

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params?.id;

  // États des données client et transactions
  const [client, setClient] = useState(null);
  const [stats, setStats] = useState(null);
  const [payments, setPayments] = useState([]);

  // États du formulaire modifiable
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    status: "actif",
    notes: "",
  });

  // États de chargement et d'action
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Filtre et recherche dans l'historique des paiements du client
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTx, setSearchTx] = useState("");

  // Feedback utilisateur (toast & copie)
  const [toastMessage, setToastMessage] = useState("");
  const [copiedId, setCopiedId] = useState("");

  const showToast = (msg) => {
    setToastMessage(msg);
    window.setTimeout(() => setToastMessage(""), 2500);
  };

  // Chargement des données complètes du client depuis l'API CRM
  const loadClientDetails = useCallback(async () => {
    if (!clientId) return;
    setIsLoading(true);
    setLoadError("");

    try {
      const res = await fetch(`/api/clients/${clientId}`, { cache: "no-store" });
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || "Impossible de charger la fiche de ce client.");
      }

      setClient(json.client);
      setStats(json.stats);
      setPayments(json.payments || []);

      setFormData({
        name: json.client.name || "",
        phone: json.client.phone || "",
        email: json.client.email || "",
        status: json.client.status || "actif",
        notes: json.client.notes || "",
      });
    } catch (err) {
      console.error("[ClientDetail] Erreur chargement :", err);
      setLoadError(err.message || "Erreur de connexion lors du chargement.");
    } finally {
      setIsLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    loadClientDetails();
  }, [loadClientDetails]);

  // Sauvegarde des modifications du formulaire client
  const handleSaveChanges = async (e) => {
    if (e) e.preventDefault();
    if (!clientId) return;

    if (!formData.name.trim()) {
      showToast("Veuillez renseigner un nom pour le client.");
      return;
    }
    if (!formData.phone.trim()) {
      showToast("Veuillez renseigner un numéro de téléphone.");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Impossible d'enregistrer les modifications.");
      }

      setClient(json.client);
      setSaveSuccess(true);
      showToast("Fiche client mise à jour avec succès !");
      window.setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      console.error("[ClientDetail] Erreur enregistrement :", err);
      showToast(err.message || "Erreur lors de la sauvegarde.");
    } finally {
      setIsSaving(false);
    }
  };

  // Suppression du client
  const handleDeleteClient = async () => {
    if (!clientId) return;
    setIsDeleting(true);

    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: "DELETE",
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || "Impossible de supprimer ce client.");
      }

      showToast("Client supprimé avec succès.");
      router.push("/clients");
    } catch (err) {
      console.error("[ClientDetail] Erreur suppression :", err);
      showToast(err.message || "Erreur lors de la suppression.");
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  // Relance WhatsApp globale adaptée à la situation financière du client
  const handleGlobalWhatsAppReminder = () => {
    if (!client) return;
    const phone = (formData.phone || client.phone || "").replace(/[^\d]/g, "");
    if (!phone) {
      showToast("Aucun numéro de téléphone valide enregistré pour ce client.");
      return;
    }

    const pendingList = payments.filter((p) => txIsPending(p) && !txIsExpired(p));
    const baseUrl =
      typeof window !== "undefined"
        ? window.location.origin
        : "https://kadmielbusiness.vercel.app";

    let msg = "";
    if (pendingList.length > 0) {
      const totalPending = pendingList.reduce(
        (acc, cur) => acc + txAmountTotal(cur),
        0
      );
      const latestPending = pendingList[0];
      const link = `${baseUrl}/pay/${latestPending.id}`;

      msg = `Bonjour ${formData.name || client.name},\n\nJ'espère que vous vous portez bien.\nJe me permets de vous relancer concernant votre facture en attente de règlement sur Kadmiel Business Pay :\n\n📌 Prestation : ${txService(
        latestPending
      )}\n💰 Montant : ${formatMoney(
        totalPending
      )}\n👉 Lien de paiement direct : ${link}\n\nVous pouvez régler facilement et en toute sécurité par Wave, Orange Money, MTN ou Moov.\nRestant à votre disposition si besoin !\nBien à vous.`;
    } else {
      msg = `Bonjour ${formData.name || client.name},\n\nJ'espère que vous passez une excellente journée !\nMerci encore pour votre confiance continue avec nous sur Kadmiel Business Pay.\nN'hésitez pas à me contacter si vous avez un nouveau projet ou besoin d'une prestation.\nBien cordialement !`;
    }

    window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  // Relance WhatsApp sur un lien spécifique
  const handleSpecificWhatsAppReminder = (e, tx) => {
    e.stopPropagation();
    const phone = (formData.phone || client?.phone || tx.client_phone || "").replace(
      /[^\d]/g,
      ""
    );
    if (!phone) {
      showToast("Aucun numéro disponible pour cette relance.");
      return;
    }

    const baseUrl =
      typeof window !== "undefined"
        ? window.location.origin
        : "https://kadmielbusiness.vercel.app";
    const link = `${baseUrl}/pay/${tx.id}`;
    const name = formData.name || client?.name || tx.client_name || "Client";
    const service = txService(tx);
    const amount = formatMoney(txAmountTotal(tx));
    const isPaid = txIsPaid(tx);

    let msg = "";
    if (isPaid) {
      msg = `Bonjour ${name},\n\nVotre règlement de ${amount} pour la prestation "${service}" est bien confirmé.\nMerci pour votre confiance !`;
    } else {
      const feeNote =
        tx.fee_bearer === "freelance"
          ? "\n🎁 Les frais de transaction sont offerts par le prestataire."
          : "";
      msg = `Bonjour ${name},\n\nVoici votre lien de paiement sécurisé pour "${service}" :\n👉 ${link}\n\nMontant total à régler : ${amount}${feeNote}\nPaiement disponible par Wave, Orange Money, MTN et Moov.\nMerci !`;
    }

    window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  // Copier le lien de paiement public
  const handleCopyPaymentLink = (e, tx) => {
    e.stopPropagation();
    const baseUrl =
      typeof window !== "undefined"
        ? window.location.origin
        : "https://kadmielbusiness.vercel.app";
    const link = `${baseUrl}/pay/${tx.id}`;

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(link);
      setCopiedId(tx.id);
      showToast("Lien de paiement copié !");
      window.setTimeout(() => setCopiedId(""), 2000);
    }
  };

  // Téléchargement du reçu PDF
  const handleDownloadReceipt = async (e, tx) => {
    e.stopPropagation();
    try {
      showToast("Génération du reçu officiel...");
      await generateReceiptPDF(tx);
      showToast("Reçu téléchargé !");
    } catch (err) {
      console.error("Erreur génération reçu :", err);
      showToast("Erreur lors de la génération du reçu PDF.");
    }
  };

  // Filtrage des transactions pour l'historique
  const filteredPayments = useMemo(() => {
    let result = payments;

    // Filtre statut
    if (statusFilter === "paye") {
      result = result.filter(txIsPaid);
    } else if (statusFilter === "en_attente") {
      result = result.filter((p) => txIsPending(p) && !txIsExpired(p));
    } else if (statusFilter === "expire") {
      result = result.filter(txIsExpired);
    } else if (statusFilter === "a_verifier") {
      result = result.filter(txIsToVerify);
    }

    // Recherche textuelle
    if (searchTx.trim()) {
      const q = searchTx.toLowerCase().trim();
      result = result.filter((p) => {
        const service = txService(p).toLowerCase();
        const id = (p.id || "").toLowerCase();
        return service.includes(q) || id.includes(q);
      });
    }

    return result;
  }, [payments, statusFilter, searchTx]);

  // Initiales client
  const clientInitials = useMemo(() => {
    if (!formData.name && !client?.name) return "CL";
    return (formData.name || client.name)
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();
  }, [formData.name, client]);

  // Détection des modifications non enregistrées
  const isDirty = useMemo(() => {
    if (!client) return false;
    return (
      formData.name !== (client.name || "") ||
      formData.phone !== (client.phone || "") ||
      formData.email !== (client.email || "") ||
      formData.status !== (client.status || "actif") ||
      formData.notes !== (client.notes || "")
    );
  }, [formData, client]);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-zinc-400">
        <span className="flex h-12 w-12 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
          <LoaderCircle className="h-6 w-6 animate-spin" />
        </span>
        <p className="text-sm">Chargement de la fiche client 360°...</p>
      </div>
    );
  }

  if (loadError || !client) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/10 text-red-400">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h1 className="text-xl font-bold text-white">Client introuvable</h1>
        <p className="text-sm text-zinc-400">
          {loadError || "La fiche client demandée n'existe pas ou a été supprimée."}
        </p>
        <div className="pt-2">
          <Link
            href="/clients"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 text-black font-bold text-xs hover:bg-emerald-400 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Retourner au répertoire clients</span>
          </Link>
        </div>
      </div>
    );
  }

  const isVip = formData.status === "vip";
  const isProspect = formData.status === "prospect";
  const isInactive = formData.status === "inactif";

  return (
    <div className="space-y-7 pb-12">
      {/* Toast de notification flottant */}
      {toastMessage && (
        <div
          role="status"
          className="fixed right-5 top-5 z-50 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-zinc-900 px-4 py-3 text-sm text-emerald-300 shadow-2xl animate-slide-up"
        >
          <Check className="h-4 w-4 text-emerald-400" />
          {toastMessage}
        </div>
      )}

      {/* Navigation fil d'ariane & Bouton retour */}
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/clients"
          className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-white transition group"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-900 border border-white/10 group-hover:border-emerald-500/40 group-hover:text-emerald-400 transition">
            <ArrowLeft className="h-4 w-4" />
          </span>
          <span>Retour au répertoire des clients</span>
        </Link>

        <button
          type="button"
          onClick={loadClientDetails}
          title="Actualiser les statistiques"
          className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 border border-transparent hover:border-white/10 transition"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* ═══ EN-TÊTE DE LA FICHE CLIENT CRM ═══ */}
      <header className="rounded-2xl border border-emerald-500/20 bg-[#0a0a0a] p-6 shadow-xl relative overflow-hidden">
        {/* Glow décoratif d'arrière-plan */}
        <div
          className={`pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full blur-3xl opacity-20 ${
            isVip ? "bg-amber-500" : "bg-emerald-500"
          }`}
        />

        <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          {/* Avatar + Coordonnées clés */}
          <div className="flex items-start sm:items-center gap-4">
            <div
              className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-xl font-black border shadow-lg ${
                isVip
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-amber-500/10"
                  : isProspect
                  ? "bg-sky-500/20 text-sky-300 border-sky-500/40 shadow-sky-500/10"
                  : isInactive
                  ? "bg-zinc-800 text-zinc-400 border-zinc-700"
                  : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-emerald-500/10"
              }`}
            >
              {clientInitials}
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                  {formData.name || client.name}
                </h1>

                {/* Badge Statut Client */}
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border shadow-sm ${
                    isVip
                      ? "bg-amber-500/15 text-amber-300 border-amber-500/40"
                      : isProspect
                      ? "bg-sky-500/15 text-sky-300 border-sky-500/40"
                      : isInactive
                      ? "bg-zinc-800 text-zinc-400 border-zinc-700"
                      : "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
                  }`}
                >
                  {isVip && <Crown className="h-3.5 w-3.5 text-amber-400" />}
                  {isProspect && <User className="h-3.5 w-3.5 text-sky-400" />}
                  {!isVip && !isProspect && !isInactive && (
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  )}
                  {formData.status || "Actif"}
                </span>
              </div>

              {/* Coordonnées rapides */}
              <div className="flex items-center gap-4 text-xs text-zinc-400 flex-wrap pt-0.5">
                <a
                  href={`tel:${formData.phone || client.phone}`}
                  className="flex items-center gap-1.5 hover:text-emerald-400 transition font-mono"
                  title="Appeler directement"
                >
                  <Phone className="h-3.5 w-3.5 text-zinc-500" />
                  <span>{formData.phone || client.phone}</span>
                </a>

                {(formData.email || client.email) && (
                  <a
                    href={`mailto:${formData.email || client.email}`}
                    className="flex items-center gap-1.5 hover:text-emerald-400 transition"
                    title="Envoyer un email"
                  >
                    <Mail className="h-3.5 w-3.5 text-zinc-500" />
                    <span>{formData.email || client.email}</span>
                  </a>
                )}

                <span className="flex items-center gap-1.5 text-zinc-500">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Client depuis {formatDateShort(client.created_at)}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Actions Rapides d'En-tête */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Bouton Relance WhatsApp Direct */}
            <button
              type="button"
              onClick={handleGlobalWhatsAppReminder}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#25D366] hover:bg-[#20ba59] px-4 text-xs font-extrabold text-black transition-all active:scale-95 shadow-md shadow-[#25D366]/20"
              title="Ouvrir WhatsApp avec un message pré-rempli sur mesure"
            >
              <MessageCircle className="h-4 w-4 fill-black" />
              <span>Relancer sur WhatsApp</span>
            </button>

            {/* Bouton Nouveau Lien Pré-rempli */}
            <Link
              href={`/dashboard/new?client_name=${encodeURIComponent(
                formData.name || client.name
              )}&client_phone=${encodeURIComponent(formData.phone || client.phone)}`}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-4 text-xs font-extrabold text-black transition-all active:scale-95 shadow-md shadow-emerald-500/20"
              title="Créer un lien de paiement avec le nom et numéro de ce client"
            >
              <Plus className="h-4 w-4 stroke-[3]" />
              <span>Nouveau Lien pour ce client</span>
            </Link>

            {/* Bouton Supprimer Client */}
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              className="p-2.5 rounded-xl border border-red-500/20 text-red-400 hover:bg-red-500/10 hover:border-red-500/40 transition"
              title="Supprimer ce client du répertoire"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ═══ KPIS CLÉS DU CLIENT ═══ */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Encaissé (CA Cumulé) */}
        <div className="rounded-2xl border border-emerald-500/25 bg-[#0a0a0a] p-4 sm:p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-zinc-400">Total Encaissé</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Wallet className="h-4 w-4" />
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-black text-white">
            {formatMoney(stats?.total_paid_amount || 0)}
          </p>
          <div className="mt-2 text-[11px] text-zinc-500">
            {stats?.total_pending_amount > 0 ? (
              <span className="text-amber-400 font-medium">
                +{formatMoney(stats.total_pending_amount)} en attente
              </span>
            ) : (
              <span>Aucun impayé en attente</span>
            )}
          </div>
        </div>

        {/* Panier Moyen */}
        <div className="rounded-2xl border border-emerald-500/25 bg-[#0a0a0a] p-4 sm:p-5 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-zinc-400">Panier Moyen</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-900 text-zinc-300 border border-white/10">
              <TrendingUp className="h-4 w-4 text-emerald-400" />
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-black text-white">
            {formatMoney(stats?.average_basket || 0)}
          </p>
          <p className="mt-2 text-[11px] text-zinc-500">
            Par transaction validée
          </p>
        </div>

        {/* Taux de Succès */}
        <div className="rounded-2xl border border-emerald-500/25 bg-[#0a0a0a] p-4 sm:p-5 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-zinc-400">Taux de Succès</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="h-4 w-4" />
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-black text-emerald-400">
            {stats?.success_rate ?? 0} %
          </p>
          <div className="mt-2.5 h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden border border-white/5">
            <div
              className="h-full bg-emerald-500 transition-all duration-500 rounded-full"
              style={{ width: `${Math.min(stats?.success_rate || 0, 100)}%` }}
            />
          </div>
        </div>

        {/* Liens Générés */}
        <div className="rounded-2xl border border-emerald-500/25 bg-[#0a0a0a] p-4 sm:p-5 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-zinc-400">Liens Générés</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-900 text-zinc-300 border border-white/10">
              <FileText className="h-4 w-4 text-emerald-400" />
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-black text-white">
            {stats?.total_payments_count || 0} lien
            {(stats?.total_payments_count || 0) > 1 ? "s" : ""}
          </p>
          <div className="mt-2 text-[11px] text-zinc-400 flex items-center gap-1.5">
            <span className="text-emerald-400 font-semibold">
              {stats?.paid_count || 0} payé{(stats?.paid_count || 0) > 1 ? "s" : ""}
            </span>
            <span>•</span>
            <span className="text-amber-400 font-semibold">
              {stats?.pending_count || 0} attente
            </span>
            {stats?.expired_count > 0 && (
              <>
                <span>•</span>
                <span className="text-zinc-500">{stats.expired_count} expiré</span>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ═══ CONTENU PRINCIPAL EN 2 COLONNES (CRM & HISTORIQUE) ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-7">
        {/* COLONNE GAUCHE : FICHE MODIFIABLE DU CLIENT (5 colonnes) */}
        <div className="lg:col-span-5 space-y-6">
          <section className="rounded-2xl border border-emerald-500/20 bg-[#0a0a0a] p-5 sm:p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-emerald-500/10">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <User className="h-4 w-4 text-emerald-400" />
                  Informations de Contact
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Coordonnées et statut CRM modifiables
                </p>
              </div>

              {isDirty && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-400/10 border border-amber-400/30 px-2 py-0.5 rounded-full animate-pulse">
                  Modifié
                </span>
              )}
            </div>

            <form onSubmit={handleSaveChanges} className="space-y-4">
              {/* Champ Nom */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                  <span>Nom complet ou Société</span>
                  <span className="text-emerald-400">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="Ex: Jean Kouassi"
                    className="w-full h-10 pl-10 pr-3 rounded-xl bg-black border border-emerald-500/25 text-white placeholder:text-zinc-600 text-xs focus:border-emerald-400 outline-none transition"
                  />
                </div>
              </div>

              {/* Champ Téléphone WhatsApp */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                  <span>Numéro WhatsApp / Téléphone</span>
                  <span className="text-emerald-400">*</span>
                </label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    placeholder="Ex: +225 07 00 00 00 00"
                    className="w-full h-10 pl-10 pr-10 rounded-xl bg-black border border-emerald-500/25 text-white placeholder:text-zinc-600 text-xs font-mono focus:border-emerald-400 outline-none transition"
                  />
                  <a
                    href={`tel:${formData.phone}`}
                    title="Appeler"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-emerald-400"
                  >
                    <Phone className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>

              {/* Champ Email */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">
                  Adresse Email (optionnelle)
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    placeholder="Ex: jean.kouassi@entreprise.ci"
                    className="w-full h-10 pl-10 pr-3 rounded-xl bg-black border border-emerald-500/25 text-white placeholder:text-zinc-600 text-xs focus:border-emerald-400 outline-none transition"
                  />
                </div>
              </div>

              {/* Champ Statut Client CRM */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
                  <span>Statut Client</span>
                  <span className="text-[10px] text-zinc-500">
                    Segment marketing
                  </span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    {
                      id: "vip",
                      label: "Client VIP ⭐",
                      desc: "Très fort volume",
                      color: "border-amber-500/40 text-amber-300 bg-amber-500/10",
                    },
                    {
                      id: "actif",
                      label: "Client Actif 🟢",
                      desc: "Règle régulièrement",
                      color: "border-emerald-500/40 text-emerald-300 bg-emerald-500/10",
                    },
                    {
                      id: "prospect",
                      label: "Prospect 🔵",
                      desc: "Lien créé, non payé",
                      color: "border-sky-500/40 text-sky-300 bg-sky-500/10",
                    },
                    {
                      id: "inactif",
                      label: "Inactif ⚪",
                      desc: "Sans interaction",
                      color: "border-zinc-700 text-zinc-400 bg-zinc-900",
                    },
                  ].map((s) => {
                    const selected = formData.status === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() =>
                          setFormData({ ...formData, status: s.id })
                        }
                        className={`p-2.5 rounded-xl border text-left transition ${
                          selected
                            ? `${s.color} ring-1 ring-emerald-500/50`
                            : "border-white/10 bg-black text-zinc-400 hover:text-white hover:bg-zinc-900"
                        }`}
                      >
                        <p className="text-xs font-bold">{s.label}</p>
                        <p className="text-[10px] text-zinc-500">{s.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Champ Notes Internes Libres */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
                  <span>Notes Internes Libres</span>
                  <span className="text-[10px] text-zinc-500">
                    Privé (invisible pour le client)
                  </span>
                </label>
                <textarea
                  rows={4}
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  placeholder="Ex : Préfère payer par Wave. Règle le 5 de chaque mois. Demander confirmation avant d'envoyer la facture..."
                  className="w-full p-3 rounded-xl bg-black border border-emerald-500/25 text-white placeholder:text-zinc-600 text-xs focus:border-emerald-400 outline-none transition resize-none leading-relaxed"
                />
              </div>

              {/* Bouton d'enregistrement */}
              <button
                type="submit"
                disabled={isSaving || !isDirty}
                className={`w-full h-11 flex items-center justify-center gap-2 rounded-xl text-xs font-bold transition-all ${
                  isDirty
                    ? "bg-emerald-500 text-black hover:bg-emerald-400 active:scale-95 shadow-lg shadow-emerald-500/20"
                    : "bg-zinc-800 text-zinc-500 cursor-not-allowed border border-white/5"
                }`}
              >
                {isSaving ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    <span>Enregistrement en cours...</span>
                  </>
                ) : saveSuccess ? (
                  <>
                    <Check className="h-4 w-4" />
                    <span>Modifications enregistrées !</span>
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    <span>Enregistrer les modifications</span>
                  </>
                )}
              </button>
            </form>
          </section>

          {/* Chronologie relationnelle & Insights */}
          <section className="rounded-2xl border border-emerald-500/15 bg-[#0a0a0a] p-5 shadow-lg space-y-3 text-xs">
            <h3 className="font-bold text-white flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-emerald-400" />
              Historique Relationnel
            </h3>
            <div className="space-y-2.5 text-zinc-400">
              <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                <span className="text-zinc-500">Date d'inscription :</span>
                <span className="font-medium text-white">
                  {formatDate(client.created_at)}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                <span className="text-zinc-500">Dernière interaction :</span>
                <span className="font-medium text-emerald-400">
                  {formatDate(stats?.last_interaction_at)}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-zinc-500">Dernière mise à jour :</span>
                <span className="font-medium text-white">
                  {formatDate(client.updated_at || client.created_at)}
                </span>
              </div>
            </div>
          </section>
        </div>

        {/* COLONNE DROITE : HISTORIQUE COMPLET DES LIENS DE PAIEMENT (7 colonnes) */}
        <div className="lg:col-span-7 space-y-4">
          <section className="rounded-2xl border border-emerald-500/20 bg-[#0a0a0a] overflow-hidden shadow-xl">
            {/* En-tête de la liste des transactions */}
            <div className="p-5 border-b border-emerald-500/15 space-y-4 bg-black/40">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h2 className="font-bold text-white text-base flex items-center gap-2">
                    <FileText className="h-4 w-4 text-emerald-400" />
                    Historique des Factures & Liens
                  </h2>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {filteredPayments.length} transaction
                    {filteredPayments.length > 1 ? "s" : ""} trouvée
                    {filteredPayments.length > 1 ? "s" : ""}
                  </p>
                </div>

                {/* Recherche dans les liens */}
                <div className="relative w-full sm:w-56">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
                  <input
                    type="text"
                    value={searchTx}
                    onChange={(e) => setSearchTx(e.target.value)}
                    placeholder="Rechercher par prestation..."
                    className="w-full h-8 pl-8 pr-7 text-xs rounded-xl bg-black border border-emerald-500/30 text-white placeholder:text-zinc-500 outline-none focus:border-emerald-400"
                  />
                  {searchTx && (
                    <button
                      type="button"
                      onClick={() => setSearchTx("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Onglets de filtrage par statut */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
                {[
                  { id: "all", label: "Toutes", count: payments.length },
                  {
                    id: "paye",
                    label: "Payées",
                    count: payments.filter(txIsPaid).length,
                  },
                  {
                    id: "en_attente",
                    label: "En attente",
                    count: payments.filter((p) => txIsPending(p) && !txIsExpired(p))
                      .length,
                  },
                  {
                    id: "expire",
                    label: "Expirées",
                    count: payments.filter(txIsExpired).length,
                  },
                ].map((tab) => {
                  const active = statusFilter === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setStatusFilter(tab.id)}
                      className={`px-3 py-1.5 rounded-xl font-bold transition shrink-0 ${
                        active
                          ? "bg-emerald-500 text-black shadow-md shadow-emerald-500/20"
                          : "text-zinc-400 hover:text-white hover:bg-zinc-900 border border-transparent"
                      }`}
                    >
                      {tab.label} ({tab.count})
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Liste des transactions */}
            {filteredPayments.length > 0 ? (
              <div className="divide-y divide-white/5">
                {filteredPayments.map((tx) => {
                  const isPaid = txIsPaid(tx);
                  const isPending = txIsPending(tx) && !txIsExpired(tx);
                  const isExpired = txIsExpired(tx);
                  const isToVerify = txIsToVerify(tx);
                  const service = txService(tx);
                  const isCopied = copiedId === tx.id;

                  return (
                    <div
                      key={tx.id}
                      className="p-4 sm:p-5 hover:bg-zinc-900/60 transition-colors space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        {/* Infos principales : Service & Date */}
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-bold text-white text-sm">
                              {service}
                            </h4>

                            {/* Badge Statut */}
                            {isPaid && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                <CheckCircle2 className="h-3 w-3" />
                                Payé
                              </span>
                            )}
                            {isPending && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                <Clock className="h-3 w-3" />
                                En attente
                              </span>
                            )}
                            {isExpired && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-zinc-800 text-zinc-400 border border-zinc-700">
                                <XCircle className="h-3 w-3" />
                                Expiré
                              </span>
                            )}
                            {isToVerify && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/15 text-sky-400 border border-sky-500/30">
                                <ShieldAlert className="h-3 w-3" />
                                À vérifier
                              </span>
                            )}

                            {/* Badge Prise en charge des frais */}
                            {tx.fee_bearer === "freelance" ? (
                              <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                                Frais offerts
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded-md border border-white/5">
                                Frais client
                              </span>
                            )}

                            {/* Badge Usage Multiple */}
                            {!tx.is_single_use && tx.max_uses > 1 && (
                              <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded-md border border-white/5">
                                Multi-usage ({tx.times_used || 0}/{tx.max_uses})
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-xs text-zinc-400">
                            <span>Créé le {formatDate(tx.created_at)}</span>
                            {tx.paid_at && (
                              <>
                                <span>•</span>
                                <span className="text-emerald-400">
                                  Encaissé le {formatDate(tx.paid_at)}
                                </span>
                              </>
                            )}
                            {tx.expires_at && !isPaid && (
                              <>
                                <span>•</span>
                                <span
                                  className={
                                    isExpired ? "text-red-400" : "text-amber-400"
                                  }
                                >
                                  {isExpired ? "Expiré le " : "Expire le "}
                                  {formatDateShort(tx.expires_at)}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Montant */}
                        <div className="sm:text-right">
                          <p className="text-base font-extrabold text-white">
                            {formatMoney(txAmountTotal(tx))}
                          </p>
                          <p className="text-[11px] text-emerald-400 font-medium">
                            Net perçu : {formatMoney(txAmountNet(tx))}
                          </p>
                        </div>
                      </div>

                      {/* Barre d'actions rapides par lien de paiement */}
                      <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs">
                        <span className="text-[11px] font-mono text-zinc-500 truncate max-w-[140px] sm:max-w-[200px]">
                          ID: {tx.id.slice(0, 12)}...
                        </span>

                        <div className="flex items-center gap-1.5">
                          {/* Copier lien */}
                          <button
                            type="button"
                            onClick={(e) => handleCopyPaymentLink(e, tx)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-white/10 bg-black text-zinc-300 hover:text-white hover:bg-zinc-800 transition text-[11px]"
                            title="Copier le lien public"
                          >
                            {isCopied ? (
                              <>
                                <Check className="h-3 w-3 text-emerald-400" />
                                <span className="text-emerald-400">Copié</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3" />
                                <span>Copier</span>
                              </>
                            )}
                          </button>

                          {/* Relance WhatsApp pour cette facture */}
                          <button
                            type="button"
                            onClick={(e) => handleSpecificWhatsAppReminder(e, tx)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 transition text-[11px]"
                            title="Relancer sur WhatsApp pour cette facture"
                          >
                            <MessageCircle className="h-3 w-3" />
                            <span>WhatsApp</span>
                          </button>

                          {/* Télécharger Reçu Officiel PDF si payé */}
                          {isPaid && (
                            <button
                              type="button"
                              onClick={(e) => handleDownloadReceipt(e, tx)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500 hover:text-black transition text-[11px] font-bold"
                              title="Télécharger le reçu officiel au format PDF"
                            >
                              <FileSpreadsheet className="h-3 w-3" />
                              <span>Reçu PDF</span>
                            </button>
                          )}

                          {/* Ouvrir la page de paiement public */}
                          <Link
                            href={`/pay/${tx.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
                            title="Ouvrir la page de paiement publique"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-12 px-4 text-center space-y-3">
                <FileText className="h-8 w-8 text-zinc-600 mx-auto" />
                <p className="text-sm font-semibold text-zinc-400">
                  Aucun lien de paiement trouvé
                </p>
                <p className="text-xs text-zinc-600 max-w-sm mx-auto">
                  {searchTx
                    ? `Aucune transaction ne correspond à "${searchTx}".`
                    : "Aucune transaction n'a été trouvée pour ce statut."}
                </p>
                <div className="pt-2">
                  <Link
                    href={`/dashboard/new?client_name=${encodeURIComponent(
                      formData.name || client.name
                    )}&client_phone=${encodeURIComponent(
                      formData.phone || client.phone
                    )}`}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 text-black text-xs font-bold hover:bg-emerald-400 transition"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Créer le premier lien de ce client</span>
                  </Link>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* ═══ MODALE DE CONFIRMATION DE SUPPRESSION ═══ */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-red-500/30 bg-zinc-950 p-6 shadow-2xl space-y-5">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 text-red-400 border border-red-500/20">
                <ShieldAlert className="h-5 w-5" />
              </span>
              <div>
                <h3 className="font-bold text-white text-base">
                  Supprimer ce client ?
                </h3>
                <p className="text-xs text-zinc-400">
                  Action irréversible sur la fiche client
                </p>
              </div>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              Êtes-vous sûr de vouloir supprimer définitivement la fiche de{" "}
              <strong className="text-white">{formData.name || client.name}</strong> ?
              Ses transactions passées resteront enregistrées dans votre historique comptable.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-300 hover:bg-zinc-900 border border-white/10 transition"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteClient}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                    <span>Suppression...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Confirmer la suppression</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
