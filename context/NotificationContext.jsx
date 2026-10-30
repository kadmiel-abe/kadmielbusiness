"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { notificationSound } from "@/lib/notificationSound";

const NotificationContext = createContext(null);

const STORAGE_KEY = "kadmiel_notifications_v1";
const MAX_NOTIFICATIONS = 50;

export function NotificationProvider({ children }) {
  const [supabase] = useState(() => createClientComponentClient());
  const [notifications, setNotifications] = useState([]);
  const [activeAlert, setActiveAlert] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);

  // Référence pour garder en mémoire l'état précédent des paiements (détection de transition de statut)
  const knownPaymentsRef = useRef(new Map());
  const initialLoadDoneRef = useRef(false);

  // 1. Initialiser le son & les notifications depuis le localStorage
  useEffect(() => {
    setIsMuted(notificationSound.isMuted());
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setNotifications(parsed);
        }
      }
    } catch (e) {
      console.warn("[NotificationContext] Erreur lecture localStorage :", e);
    }
  }, []);

  // Sauvegarder dans le localStorage à chaque mise à jour
  const saveNotifications = useCallback((updater) => {
    setNotifications((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      const trimmed = next.slice(0, MAX_NOTIFICATIONS);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
      } catch {}
      return trimmed;
    });
  }, []);

  // 2. Ajouter une notification
  const addNotification = useCallback(
    ({ type, title, message, amount, clientName, serviceName, paymentId, playSound = true }) => {
      const newNotif = {
        id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type, // 'encaissement' | 'a_verifier' | 'nouveau_lien' | 'expire' | 'info'
        title,
        message,
        amount: Number(amount) || 0,
        clientName: clientName || "Client",
        serviceName: serviceName || "Prestation",
        paymentId,
        read: false,
        createdAt: new Date().toISOString(),
      };

      saveNotifications((prev) => [newNotif, ...prev]);

      // Déclencher le son selon le type
      if (playSound) {
        if (type === "encaissement") {
          notificationSound.playCashChime();
        } else if (type === "a_verifier") {
          notificationSound.playAlertTone();
        }
      }

      // Déclencher l'alerte pop-up flottante pour les événements majeurs
      if (type === "encaissement" || type === "a_verifier") {
        setActiveAlert(newNotif);
      }

      // Notifier les écouteurs de la page pour recharger les données instantanément
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("kadmiel:payment-event", {
            detail: { type, paymentId, notif: newNotif },
          })
        );
      }

      return newNotif;
    },
    [saveNotifications]
  );

  // 3. Marquer comme lu
  const markAsRead = useCallback(
    (id) => {
      saveNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
    },
    [saveNotifications]
  );

  // 4. Tout marquer comme lu
  const markAllAsRead = useCallback(() => {
    saveNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, [saveNotifications]);

  // 5. Supprimer une notification
  const deleteNotification = useCallback(
    (id) => {
      saveNotifications((prev) => prev.filter((n) => n.id !== id));
    },
    [saveNotifications]
  );

  // 6. Vider toutes les notifications
  const clearAll = useCallback(() => {
    saveNotifications([]);
  }, [saveNotifications]);

  // 7. Mute / Unmute
  const toggleMute = useCallback(() => {
    const next = notificationSound.toggleMuted();
    setIsMuted(next);
    return next;
  }, []);

  // 8. Fermer l'alerte popup active
  const dismissAlert = useCallback(() => {
    setActiveAlert(null);
  }, []);

  // ═══ ÉCOUTE SUPABASE REALTIME & POLLING INTELLIGENT ═══
  useEffect(() => {
    let channel = null;

    // A. Écoute Supabase Realtime (WebSockets)
    try {
      channel = supabase
        .channel("realtime-dashboard-payments")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "payments",
          },
          (payload) => {
            const { eventType, new: newRecord, old: oldRecord } = payload;
            if (!newRecord) return;

            const client =
              newRecord.client ||
              (Array.isArray(newRecord.clients) ? newRecord.clients[0] : newRecord.clients) ||
              {};
            const clientName = client.name || client.nom || newRecord.client_name || "Client";
            const serviceName = newRecord.service_name || "Prestation";
            const amountTotal = Number(newRecord.amount_total || newRecord.amount_net) || 0;

            if (eventType === "UPDATE") {
              // Cas 1 : Le paiement passe à PAYÉ
              if (newRecord.status === "paye" && oldRecord?.status !== "paye") {
                addNotification({
                  type: "encaissement",
                  title: "🎉 Encaissement Réussi !",
                  message: `Paiement de ${new Intl.NumberFormat("fr-FR").format(
                    amountTotal
                  )} FCFA validé pour ${clientName}`,
                  amount: amountTotal,
                  clientName,
                  serviceName,
                  paymentId: newRecord.id,
                });
              }

              // Cas 2 : Le paiement passe à À VÉRIFIER (Mode de secours SMS)
              else if (
                newRecord.status === "a_verifier" &&
                oldRecord?.status !== "a_verifier"
              ) {
                addNotification({
                  type: "a_verifier",
                  title: "⚠️ Transfert SMS à valider",
                  message: `Référence ${newRecord.manual_tx_id || "Mobile Money"} soumise par ${clientName}`,
                  amount: amountTotal,
                  clientName,
                  serviceName,
                  paymentId: newRecord.id,
                });
              }
            } else if (eventType === "INSERT") {
              // Nouveau lien généré
              addNotification({
                type: "nouveau_lien",
                title: "Nouveau lien généré",
                message: `Lien de ${new Intl.NumberFormat("fr-FR").format(
                  amountTotal
                )} FCFA créé pour ${clientName}`,
                amount: amountTotal,
                clientName,
                serviceName,
                paymentId: newRecord.id,
                playSound: false,
              });
            }
          }
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            setIsRealtimeConnected(true);
          } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
            setIsRealtimeConnected(false);
          }
        });
    } catch (err) {
      console.warn("[NotificationContext] Erreur souscription Supabase Realtime :", err);
    }

    // B. Polling intelligent de secours (toutes les 8 secondes)
    const pollPayments = async () => {
      try {
        const res = await fetch("/api/payments");
        if (!res.ok) return;
        const data = await res.json();
        if (!data.success || !Array.isArray(data.payments)) return;

        const payments = data.payments;

        // Premier passage : mémoriser l'état sans spammer les notifications
        if (!initialLoadDoneRef.current) {
          payments.forEach((p) => {
            knownPaymentsRef.current.set(p.id, p.status);
          });
          initialLoadDoneRef.current = true;
          return;
        }

        // Passages suivants : détecter les transitions de statut
        payments.forEach((p) => {
          const prevStatus = knownPaymentsRef.current.get(p.id);
          const currentStatus = p.status;

          if (prevStatus && prevStatus !== currentStatus) {
            const client =
              p.client ||
              (Array.isArray(p.clients) ? p.clients[0] : p.clients) ||
              {};
            const clientName = client.name || client.nom || p.client_name || "Client";
            const serviceName = p.service_name || "Prestation";
            const amountTotal = Number(p.amount_total || p.amount_net) || 0;

            if (currentStatus === "paye" && prevStatus !== "paye") {
              addNotification({
                type: "encaissement",
                title: "🎉 Encaissement Réussi !",
                message: `Paiement de ${new Intl.NumberFormat("fr-FR").format(
                  amountTotal
                )} FCFA validé pour ${clientName}`,
                amount: amountTotal,
                clientName,
                serviceName,
                paymentId: p.id,
              });
            } else if (currentStatus === "a_verifier" && prevStatus !== "a_verifier") {
              addNotification({
                type: "a_verifier",
                title: "⚠️ Transfert SMS à valider",
                message: `Référence ${p.manual_tx_id || "Mobile Money"} soumise par ${clientName}`,
                amount: amountTotal,
                clientName,
                serviceName,
                paymentId: p.id,
              });
            }
          }

          // Mettre à jour l'empreinte connue
          knownPaymentsRef.current.set(p.id, currentStatus);
        });
      } catch (pollErr) {
        // Silencieux
      }
    };

    // Lancer le polling immédiat et toutes les 8 secondes
    pollPayments();
    const interval = setInterval(pollPayments, 8000);

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
      clearInterval(interval);
    };
  }, [supabase, addNotification]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const value = {
    notifications,
    unreadCount,
    activeAlert,
    isMuted,
    isRealtimeConnected,
    addNotification,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
    toggleMute,
    dismissAlert,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications doit être utilisé au sein d'un NotificationProvider.");
  }
  return context;
}
