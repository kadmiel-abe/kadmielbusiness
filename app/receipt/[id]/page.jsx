"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  LoaderCircle,
  Mail,
  MessageCircle,
  Phone,
  Printer,
  QrCode,
  Send,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  User,
  Wallet,
} from "lucide-react";
import { generateReceiptPDF } from "@/lib/exportUtils";

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
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return dateStr;
  }
}

export default function DigitalReceiptPage() {
  const params = useParams();
  const paymentId = params?.id;

  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // État de l'envoi par email
  const [emailInput, setEmailInput] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState(false);

  // Feedback toast & copie
  const [copied, setCopied] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const showToast = (msg) => {
    setToastMessage(msg);
    window.setTimeout(() => setToastMessage(""), 2500);
  };

  useEffect(() => {
    if (!paymentId) return;

    const fetchReceiptData = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/payments/${paymentId}`, {
          cache: "no-store",
        });
        const data = await res.json();

        if (!res.ok || !data.success || !data.payment) {
          throw new Error(data.error || "Reçu de paiement introuvable.");
        }

        const p = data.payment;
        setPayment(p);

        const client = p.client || (Array.isArray(p.clients) ? p.clients[0] : p.clients) || {};
        if (client.email) {
          setEmailInput(client.email);
        }
      } catch (err) {
        console.error("[DigitalReceipt] Erreur :", err);
        setError(err.message || "Impossible de charger ce reçu.");
      } finally {
        setLoading(false);
      }
    };

    fetchReceiptData();
  }, [paymentId]);

  // Envoi automatique par Email
  const handleSendEmail = async (e) => {
    if (e) e.preventDefault();
    if (!emailInput.trim()) {
      showToast("Veuillez saisir une adresse email.");
      return;
    }

    setSendingEmail(true);
    try {
      const res = await fetch("/api/receipt/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId,
          email: emailInput.trim(),
          channel: "email",
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Échec de l'envoi de l'email.");
      }

      setEmailSuccess(true);
      showToast("Reçu envoyé par email avec succès !");
      window.setTimeout(() => setEmailSuccess(false), 3000);
    } catch (err) {
      console.error("Erreur envoi email reçu :", err);
      showToast(err.message || "Erreur lors de l'envoi de l'email.");
    } finally {
      setSendingEmail(false);
    }
  };

  // Partage / Envoi WhatsApp
  const handleOpenWhatsApp = () => {
    if (!payment) return;
    const client = payment.client || (Array.isArray(payment.clients) ? payment.clients[0] : payment.clients) || {};
    const rawPhone = client.phone || client.telephone || payment.client_phone || "";
    const cleanPhone = rawPhone.replace(/[^\d]/g, "");

    const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://kadmielbusiness.vercel.app";
    const receiptUrl = `${baseUrl}/receipt/${payment.id}`;
    const clientName = client.name || client.nom || payment.client_name || "Client";
    const service = payment.service_name || payment.service || "Prestation";
    const totalAmount = formatMoney(payment.amount_total ?? payment.montant_total ?? payment.amount_net);

    const message = `*REÇU OFFICIEL DE PAIEMENT — KADMIEL BUSINESS PAY* 🧾✨

Bonjour *${clientName}*,
Votre règlement a été validé et encaissé avec succès.

📌 *Détails de la transaction :*
• *Prestation :* ${service}
• *Montant réglé :* ${totalAmount}
• *Mode de règlement :* ${(payment.payment_method || "Mobile Money").toUpperCase()}
• *Date & heure :* ${formatDate(payment.paid_at || payment.updated_at || payment.created_at)}
• *Réf. transaction :* ${payment.geniuspay_ref || payment.manual_tx_id || payment.id.slice(0, 12)}

🔗 *Consultez et téléchargez votre reçu certifié ici :*
👉 ${receiptUrl}

Merci pour votre confiance !
— _Kadmiel Business Pay_`;

    window.open(
      `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  // Copier le lien du reçu
  const handleCopyLink = () => {
    if (typeof window === "undefined") return;
    const url = window.location.href;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url);
      setCopied(true);
      showToast("Lien du reçu copié !");
      window.setTimeout(() => setCopied(false), 2000);
    }
  };

  // Télécharger le PDF officiel
  const handleDownloadPDF = async () => {
    if (!payment) return;
    try {
      showToast("Génération du reçu PDF...");
      await generateReceiptPDF(payment);
      showToast("Reçu PDF téléchargé avec succès !");
    } catch (err) {
      console.error("Erreur PDF :", err);
      showToast("Erreur lors de la génération du PDF.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-4">
        <span className="flex h-12 w-12 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
          <LoaderCircle className="h-6 w-6 animate-spin" />
        </span>
        <p className="mt-4 text-xs font-semibold text-zinc-400">
          Chargement du reçu officiel certifié...
        </p>
      </div>
    );
  }

  if (error || !payment) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#0a0a0a] border border-red-500/30 rounded-3xl p-6 text-center space-y-4 shadow-2xl">
          <div className="h-12 w-12 rounded-2xl bg-red-500/10 text-red-400 mx-auto flex items-center justify-center border border-red-500/20">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h1 className="text-lg font-bold text-white">Reçu introuvable</h1>
          <p className="text-xs text-zinc-400">
            {error || "Ce reçu n'existe pas ou la transaction n'a pas encore été finalisée."}
          </p>
          <div className="pt-2">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-900 border border-white/10 text-xs font-bold text-zinc-300 hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Retour à l'accueil</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const client = payment.client || (Array.isArray(payment.clients) ? payment.clients[0] : payment.clients) || {};
  const clientName = client.name || client.nom || payment.client_name || "Client";
  const clientPhone = client.phone || client.telephone || payment.client_phone || "";
  const clientEmail = client.email || payment.receipt_email || "";
  const service = payment.service_name || payment.service || "Prestation de service";
  const amountTotal = formatMoney(payment.amount_total ?? payment.montant_total ?? payment.amount_net);
  const amountNet = formatMoney(payment.amount_net ?? payment.montant_net);
  const paidAt = formatDate(payment.paid_at || payment.updated_at || payment.created_at);
  const ref = payment.geniuspay_ref || payment.manual_tx_id || payment.id;
  const method = (payment.payment_method || "Mobile Money").toUpperCase();
  const feeBearerText = payment.fee_bearer === "freelance" ? "Frais de transaction offerts par le prestataire" : "Frais de transaction inclus";

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100 py-8 px-4 sm:px-6 relative overflow-hidden flex flex-col justify-between">
      {/* Toast flottant */}
      {toastMessage && (
        <div
          role="status"
          className="fixed right-5 top-5 z-50 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-zinc-900 px-4 py-3 text-xs font-bold text-emerald-300 shadow-2xl animate-slide-up"
        >
          <Check className="h-4 w-4 text-emerald-400" />
          {toastMessage}
        </div>
      )}

      {/* Glow décoratif */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-96 w-96 rounded-full bg-emerald-500/10 blur-[100px]" />

      <main className="max-w-2xl mx-auto w-full space-y-6 relative z-10">
        {/* Barre d'outils supérieure */}
        <div className="flex items-center justify-between gap-3 text-xs print:hidden">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-zinc-400 hover:text-white transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Kadmiel Business Pay</span>
          </Link>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyLink}
              title="Copier le lien direct du reçu"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 border border-white/10 text-zinc-300 hover:text-white transition"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Lien copié</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copier lien</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              title="Imprimer ce reçu"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 border border-white/10 text-zinc-300 hover:text-white transition"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Imprimer</span>
            </button>
          </div>
        </div>

        {/* ═══ CARTE DU REÇU OFFICIEL (A4 / DESIGN CERTIFIÉ) ═══ */}
        <div
          id="receipt-card"
          className="rounded-3xl border border-emerald-500/30 bg-[#0a0a0a] shadow-2xl p-6 sm:p-9 space-y-6 relative overflow-hidden"
        >
          {/* Sceau officiel en haut */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-white/10">
            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-black uppercase tracking-wider mb-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Paiement Certifié & Encaissé
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Kadmiel Business Pay
              </h1>
              <p className="text-xs text-zinc-400">
                Quittance de règlement libératoire officielle
              </p>
            </div>

            <div className="sm:text-right">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-semibold">
                Réf. Transaction
              </span>
              <span className="text-xs font-mono font-bold text-white bg-zinc-900 px-2.5 py-1 rounded-lg border border-white/10 inline-block mt-0.5">
                {ref.slice(0, 18)}
              </span>
              <p className="text-[11px] text-zinc-400 mt-1">{paidAt}</p>
            </div>
          </div>

          {/* Montant Mis en Avant */}
          <div className="rounded-2xl bg-black border border-emerald-500/30 p-5 text-center space-y-1 shadow-inner">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              Montant Total Encaissé
            </span>
            <div className="text-3xl sm:text-4xl font-black text-emerald-400 tracking-tight">
              {amountTotal}
            </div>
            <p className="text-[11px] text-emerald-400/80 font-medium pt-0.5">
              {feeBearerText}
            </p>
          </div>

          {/* Grille de Détails : Client & Prestation */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* Colonne Client */}
            <div className="rounded-2xl bg-zinc-950 border border-white/5 p-4 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1">
                <User className="h-3 w-3 text-emerald-400" />
                Client / Payeur
              </span>
              <p className="font-extrabold text-white text-sm">{clientName}</p>
              {clientPhone && (
                <p className="font-mono text-zinc-400 flex items-center gap-1.5 text-[11px]">
                  <Phone className="h-3 w-3 text-zinc-500" />
                  {clientPhone}
                </p>
              )}
              {clientEmail && (
                <p className="text-zinc-400 flex items-center gap-1.5 text-[11px] truncate">
                  <Mail className="h-3 w-3 text-zinc-500" />
                  {clientEmail}
                </p>
              )}
            </div>

            {/* Colonne Règlement & Prestation */}
            <div className="rounded-2xl bg-zinc-950 border border-white/5 p-4 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1">
                <Wallet className="h-3 w-3 text-emerald-400" />
                Détails du Paiement
              </span>
              <p className="font-bold text-white text-sm truncate">{service}</p>
              <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-0.5">
                <span>Mode :</span>
                <span className="font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  {method}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-zinc-400">
                <span>Statut :</span>
                <span className="font-bold text-white">Soldé & Conforme</span>
              </div>
            </div>
          </div>

          {/* Tableau Comptable des Montants */}
          <div className="rounded-2xl bg-black border border-white/5 overflow-hidden">
            <div className="divide-y divide-white/5 text-xs">
              <div className="flex items-center justify-between p-3.5">
                <span className="text-zinc-400">Prestation (Net) :</span>
                <span className="font-bold text-white">{amountNet}</span>
              </div>
              <div className="flex items-center justify-between p-3.5">
                <span className="text-zinc-400">Frais de passerelle sécurisée :</span>
                <span className="font-medium text-zinc-300">
                  {payment.fee_bearer === "freelance" ? "Inclus (Offerts)" : "Inclus dans le total"}
                </span>
              </div>
              <div className="flex items-center justify-between p-3.5 bg-emerald-500/5 font-extrabold text-sm">
                <span className="text-white">Total réglé :</span>
                <span className="text-emerald-400">{amountTotal}</span>
              </div>
            </div>
          </div>

          {/* Certificat & Tampon Électronique */}
          <div className="p-4 rounded-2xl bg-zinc-950 border border-emerald-500/20 flex items-start gap-3 text-[11px] text-zinc-400">
            <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong className="text-white font-semibold">
                Certificat numérique d'acquittement :
              </strong>{" "}
              Ce reçu dématérialisé a valeur de quittance libératoire intégrale. Il atteste de la validation irrévocable du règlement par le prestataire.
            </div>
          </div>
        </div>

        {/* ═══ MODULE D'ENVOI AUTOMATIQUE SANS TÉLÉCHARGER MANUELLEMENT (PRINT:HIDDEN) ═══ */}
        <section className="rounded-3xl border border-emerald-500/25 bg-[#0a0a0a] p-6 space-y-5 shadow-2xl print:hidden">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Send className="h-4 w-4 text-emerald-400" />
              Partage & Réception Automatique du Reçu
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Envoyez ou recevez instantanément ce reçu certifié sans manipulation de fichier PDF.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Bouton WhatsApp 1 Clic */}
            <button
              type="button"
              onClick={handleOpenWhatsApp}
              className="h-12 w-full flex items-center justify-center gap-2 rounded-2xl bg-[#25D366] hover:bg-[#20ba59] text-black font-extrabold text-xs transition active:scale-95 shadow-lg shadow-[#25D366]/20"
            >
              <MessageCircle className="h-4 w-4 fill-black" />
              <span>Envoyer sur WhatsApp (1 Clic)</span>
            </button>

            {/* Bouton Télécharger PDF (toujours accessible) */}
            <button
              type="button"
              onClick={handleDownloadPDF}
              className="h-12 w-full flex items-center justify-center gap-2 rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-emerald-500/30 text-emerald-300 font-extrabold text-xs transition active:scale-95"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
              <span>Télécharger le PDF Officiel</span>
            </button>
          </div>

          {/* Formulaire d'envoi automatique par Email */}
          <div className="pt-2 border-t border-white/5 space-y-2">
            <label className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
              <span>Recevoir une copie certifiée par Email</span>
              <span className="text-[10px] text-emerald-400 font-medium">Automatique</span>
            </label>
            <form onSubmit={handleSendEmail} className="flex items-center gap-2">
              <div className="relative flex-1">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                <input
                  type="email"
                  required
                  placeholder="nom@exemple.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="w-full h-11 pl-10 pr-3 rounded-xl bg-black border border-emerald-500/25 text-white placeholder:text-zinc-600 text-xs focus:border-emerald-400 outline-none transition"
                />
              </div>

              <button
                type="submit"
                disabled={sendingEmail}
                className="h-11 px-5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs transition active:scale-95 shrink-0 flex items-center gap-1.5 disabled:opacity-50"
              >
                {sendingEmail ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : emailSuccess ? (
                  <>
                    <Check className="h-4 w-4" />
                    <span>Envoyé !</span>
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    <span>Envoyer</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </section>
      </main>

      <footer className="text-center py-6 text-xs text-zinc-600 print:hidden">
        Kadmiel Business Pay · Plateforme sécurisée de facturation mobile
      </footer>
    </div>
  );
}
