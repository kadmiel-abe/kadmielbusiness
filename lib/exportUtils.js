import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

/* ─────────────────────────────────────────────────────────────
   HELPERS DE FORMATAGE
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
  if (!dateStr) return { date: "-", time: "-" };
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return { date: "-", time: "-" };
    return {
      date: d.toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
      time: d.toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
  } catch {
    return { date: dateStr, time: "" };
  }
}

/* ─────────────────────────────────────────────────────────────
   1. EXPORT CSV DES TRANSACTIONS
   ───────────────────────────────────────────────────────────── */

/**
 * Exporte une liste de transactions au format CSV encodé UTF-8 avec BOM.
 * Compatible directement avec Microsoft Excel et Google Sheets.
 */
export function exportTransactionsToCSV(transactions, filenamePrefix = "kadmiel-business-transactions") {
  if (!transactions || transactions.length === 0) {
    alert("Aucune transaction à exporter pour la sélection actuelle.");
    return;
  }

  // En-têtes du CSV
  const headers = [
    "Date",
    "Heure",
    "ID Facture",
    "Nom du Client",
    "Téléphone WhatsApp",
    "Prestation / Service",
    "Montant Net Prestataire (FCFA)",
    "Frais Passerelle (FCFA)",
    "Total Client Réglé (FCFA)",
    "Prise en Charge des Frais",
    "Statut",
    "Type Usage",
    "Utilisations",
    "Date Expiration",
    "Moyen de Paiement",
    "Référence Transaction",
  ];

  // Construction des lignes
  const rows = transactions.map((tx) => {
    const client = tx.client || (Array.isArray(tx.clients) ? tx.clients[0] : tx.clients) || {};
    const name = client.name || client.nom || tx.client_name || "Client sans nom";
    const phone = client.phone || client.telephone || tx.client_phone || "";
    const service = tx.service_name || tx.service || "Prestation";
    const net = Number(tx.amount_net ?? tx.montant_net) || 0;
    const total = Number(tx.amount_total ?? tx.montant_total) || 0;
    const fees = Math.max(0, total - net);
    const feeBearerLabel = tx.fee_bearer === "freelance" ? "Freelance (Frais offerts)" : "Client";
    const { date, time } = formatDate(tx.created_at);

    const isPaid = tx.status === "paye" || tx.statut === "paye";
    const isExpired = tx.status === "expire" || tx.statut === "expire" || (!isPaid && tx.expires_at && new Date() > new Date(tx.expires_at));

    let statusLabel = "En attente";
    if (isPaid) statusLabel = "Payé";
    else if (isExpired) statusLabel = "Expiré";
    else if (tx.status === "a_verifier" || tx.statut === "a_verifier") statusLabel = "À vérifier (SMS)";
    else if (tx.status === "echoue" || tx.statut === "echoue") statusLabel = "Échoué";

    const isSingleUse = tx.is_single_use !== false;
    const usageType = isSingleUse ? "Usage unique" : "Usage multiple";
    const usageCounts = `${tx.times_used || 0} / ${tx.max_uses || (isSingleUse ? 1 : "-")}`;
    const expiryDate = tx.expires_at ? formatDate(tx.expires_at).date + " " + formatDate(tx.expires_at).time : "Illimité";

    const paymentMethod = tx.payment_method || (isPaid ? "Mobile Money / Wave" : "-");
    const reference = tx.manual_tx_id || tx.geniuspay_ref || tx.id;

    const escapeCSV = (str) => `"${String(str || "").replace(/"/g, '""')}"`;

    return [
      escapeCSV(date),
      escapeCSV(time),
      escapeCSV(tx.id),
      escapeCSV(name),
      escapeCSV(phone),
      escapeCSV(service),
      net,
      fees,
      total,
      escapeCSV(feeBearerLabel),
      escapeCSV(statusLabel),
      escapeCSV(usageType),
      escapeCSV(usageCounts),
      escapeCSV(expiryDate),
      escapeCSV(paymentMethod),
      escapeCSV(reference),
    ].join(";");
  });

  // Assemblage du fichier avec BOM UTF-8 (\uFEFF)
  const csvContent = "\uFEFF" + headers.join(";") + "\n" + rows.join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const nowStr = new Date().toISOString().slice(0, 10);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${filenamePrefix}-${nowStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/* ─────────────────────────────────────────────────────────────
   2. EXPORT CSV DU RÉPERTOIRE CLIENTS (CRM)
   ───────────────────────────────────────────────────────────── */

/**
 * Exporte la liste des clients et leurs statistiques CRM au format CSV (UTF-8 avec BOM).
 * Compatible Excel et Google Sheets.
 */
export function exportClientsToCSV(clients, periodLabel = "tous") {
  if (!clients || clients.length === 0) {
    alert("Aucun client à exporter pour la sélection actuelle.");
    return;
  }

  const headers = [
    "Nom du Client",
    "Téléphone WhatsApp",
    "Email",
    "Statut CRM",
    "Total Liens Générés",
    "Paiements Validés",
    "Paiements En Attente",
    "Paiements Expirés",
    "CA Total Encaissé (FCFA)",
    "Montant En Attente (FCFA)",
    "Panier Moyen (FCFA)",
    "Taux de Succès (%)",
    "Dernière Interaction",
    "Date d'Ajout",
    "Notes Internes",
    "ID Client",
  ];

  const escapeCSV = (str) => `"${String(str || "").replace(/"/g, '""')}"`;

  const rows = clients.map((c) => {
    const name = c.name || c.nom || "Client sans nom";
    const phone = c.phone || c.telephone || "";
    const email = c.email || "-";
    const status = (c.status || "actif").toUpperCase();
    const totalPayments = c.total_payments_count ?? c.totalPayments ?? 0;
    const paidCount = c.paid_payments_count ?? c.paidCount ?? 0;
    const pendingCount = c.pending_payments_count ?? c.pendingCount ?? 0;
    const expiredCount = c.expired_payments_count ?? c.expiredCount ?? 0;
    const totalPaid = Number(c.total_paid_amount ?? c.totalPaid ?? 0);
    const totalPending = Number(c.total_pending_amount ?? c.totalPending ?? 0);
    const avgBasket = Number(c.average_basket ?? c.averageBasket ?? 0);
    const successRate = `${c.success_rate ?? c.successRate ?? 0}%`;

    const lastInteraction = c.last_interaction_at
      ? formatDate(c.last_interaction_at).date + " " + formatDate(c.last_interaction_at).time
      : "-";
    const createdAt = c.created_at
      ? formatDate(c.created_at).date
      : "-";
    const notes = c.notes || "";

    return [
      escapeCSV(name),
      escapeCSV(phone),
      escapeCSV(email),
      escapeCSV(status),
      totalPayments,
      paidCount,
      pendingCount,
      expiredCount,
      totalPaid,
      totalPending,
      avgBasket,
      escapeCSV(successRate),
      escapeCSV(lastInteraction),
      escapeCSV(createdAt),
      escapeCSV(notes),
      escapeCSV(c.id),
    ].join(";");
  });

  const csvContent = "\uFEFF" + headers.join(";") + "\n" + rows.join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const nowStr = new Date().toISOString().slice(0, 10);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `kadmiel-clients-${periodLabel}-${nowStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/* ─────────────────────────────────────────────────────────────
   3. GÉNÉRATION DE REÇU PDF OFFICIEL
   ───────────────────────────────────────────────────────────── */

/**
 * Génère un reçu officiel PDF (A4) haute fidélité aux couleurs Kadmiel Business.
 * @param {Object} payment Données de la facture payée
 */
export async function generateReceiptPDF(payment) {
  if (!payment) return;

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const client = payment.client || (Array.isArray(payment.clients) ? payment.clients[0] : payment.clients) || {};
  const clientName = client.name || client.nom || payment.client_name || "Client";
  const clientPhone = client.phone || client.telephone || payment.client_phone || "";
  const serviceName = payment.service_name || payment.service || "Prestation de service";
  const amountNet = Number(payment.amount_net ?? payment.montant_net) || 0;
  const amountTotal = Number(payment.amount_total ?? payment.montant_total) || 0;
  const feeAmount = Math.max(0, amountTotal - amountNet);
  const paymentId = payment.id || "REC-" + Date.now();
  const shortId = paymentId.slice(0, 8).toUpperCase();
  const reference = payment.manual_tx_id || payment.geniuspay_ref || `KP-${shortId}`;
  const { date, time } = formatDate(payment.created_at || new Date().toISOString());

  // Palette de couleurs Kadmiel Business (Vert Pur officiel du logo #119134)
  const emeraldPrimary = [17, 145, 52]; // #119134 Vert pur logo
  const darkBg = [15, 23, 42];          // #0f172a
  const slateText = [71, 85, 105];       // #475569
  const slateLight = [241, 245, 249];    // #f1f5f9
  const textDark = [15, 23, 42];

  // ═══ BANDEAU SUPÉRIEUR (Header Sombre) ═══
  doc.setFillColor(...darkBg);
  doc.rect(0, 0, 210, 48, "F");

  // Accent vert émeraude
  doc.setFillColor(...emeraldPrimary);
  doc.rect(0, 47, 210, 2.5, "F");

  // Titre principal
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.text("KADMIEL BUSINESS", 15, 22);

  // Sous-titre
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225);
  doc.text("Solutions Web, Marketing Digital & Paiements Sécurisés", 15, 28);
  doc.text("Abidjan, Côte d'Ivoire · contact@kadmielbusiness.ci", 15, 33);

  // Badge REÇU OFFICIEL à droite
  doc.setFillColor(...emeraldPrimary);
  doc.roundedRect(138, 14, 57, 20, 3, 3, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text("REÇU DE PAIEMENT", 143, 22);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`N° ${shortId}`, 143, 29);

  // ═══ BADGE DE STATUT PAYÉ ═══
  doc.setFillColor(237, 253, 242); // fond vert pur très clair
  doc.setDrawColor(...emeraldPrimary);
  doc.setLineWidth(0.4);
  doc.roundedRect(15, 56, 180, 14, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(17, 145, 52);
  doc.text("FACTURE RÉGLÉE AVEC SUCCÈS", 22, 65);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Date du règlement : ${date} à ${time}`, 115, 65);

  // ═══ BLOCS D'INFORMATIONS : ÉMETTEUR & CLIENT ═══
  const infoY = 78;

  // Colonne Gauche : Émetteur
  doc.setFillColor(...slateLight);
  doc.roundedRect(15, infoY, 87, 36, 2, 2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...textDark);
  doc.text("ÉMIS PAR :", 20, infoY + 7);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Kadmiel ABE", 20, infoY + 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...slateText);
  doc.text("Freelance Développeur Web & Consultant", 20, infoY + 20);
  doc.text("Abidjan, Côte d'Ivoire", 20, infoY + 25);
  doc.text("WhatsApp : +225 07 06 97 85 70", 20, infoY + 30);

  // Colonne Droite : Client
  doc.setFillColor(...slateLight);
  doc.roundedRect(108, infoY, 87, 36, 2, 2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...textDark);
  doc.text("FACTURÉ À :", 113, infoY + 7);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(clientName, 113, infoY + 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...slateText);
  doc.text(`Téléphone : ${clientPhone || "Non renseigné"}`, 113, infoY + 20);
  doc.text(`Réf. Transaction : ${reference}`, 113, infoY + 25);
  doc.text(`ID Unique : ${paymentId.slice(0, 20)}...`, 113, infoY + 30);

  // ═══ TABLEAU DÉTAILLÉ DE LA PRESTATION ═══
  const isFeeBearerFreelance = payment.fee_bearer === "freelance";
  const tableBody = isFeeBearerFreelance
    ? [
        [serviceName, "Prestation de service", formatMoney(amountTotal)],
        [
          "Frais de transaction Mobile Money",
          "Offerts par le prestataire",
          "0 FCFA",
        ],
      ]
    : [
        [serviceName, "Prestation de service", formatMoney(amountNet)],
        [
          "Frais de traitement & passerelle Mobile Money",
          "Opérateur (1% + 100 F)",
          formatMoney(feeAmount),
        ],
      ];

  autoTable(doc, {
    startY: 122,
    margin: { left: 15, right: 15 },
    head: [["DÉSIGNATION DE LA PRESTATION", "TYPE", "MONTANT (FCFA)"]],
    body: tableBody,
    theme: "plain",
    headStyles: {
      fillColor: darkBg,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
      cellPadding: 4,
    },
    bodyStyles: {
      textColor: [15, 23, 42],
      fontSize: 9,
      cellPadding: 4.5,
    },
    columnStyles: {
      0: { cellWidth: 105 },
      1: { cellWidth: 45 },
      2: { cellWidth: 30, halign: "right", fontStyle: "bold" },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
  });

  const finalY = doc.lastAutoTable.finalY + 8;

  // ═══ ENCADRÉ DU TOTAL RÉGLÉ ═══
  doc.setFillColor(...darkBg);
  doc.roundedRect(108, finalY, 87, 26, 2, 2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225);
  doc.text("TOTAL PAYÉ PAR LE CLIENT", 114, finalY + 8);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...emeraldPrimary);
  doc.text(formatMoney(amountTotal), 114, finalY + 18);

  // Mention "Frais inclus" ou "Frais offerts"
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(isFeeBearerFreelance ? "Frais offerts" : "Tous frais inclus", 160, finalY + 8);

  // ═══ CADRE DE SÉCURITÉ & AUTHENTICITÉ ═══
  const footerY = 245;

  doc.setDrawColor(226, 232, 240);
  doc.line(15, footerY, 195, footerY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text("AUTHENTIFICATION DU RÈGLEMENT", 15, footerY + 8);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    "Ce reçu certifie que la prestation désignée ci-dessus a été intégralement réglée par le client via la passerelle sécurisée",
    15,
    footerY + 13
  );
  doc.text(
    "GeniusPay ou virement Mobile Money (Wave, Orange Money, MTN, Moov). Ce document fait foi de justificatif de paiement.",
    15,
    footerY + 17
  );

  doc.setFont("helvetica", "italic");
  doc.text(
    "Kadmiel Business Pay · Infrastructure de paiement pour freelances et entreprises · Fait à Abidjan.",
    15,
    footerY + 23
  );

  // Téléchargement automatique
  const cleanName = clientName.replace(/[^a-zA-Z0-9]/g, "_");
  doc.save(`Recu-Paiement-${cleanName}-${shortId}.pdf`);
}
