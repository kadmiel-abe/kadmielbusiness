"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { useNotifications } from "@/context/NotificationContext";
import {
  Bell,
  Check,
  CheckCheck,
  Coins,
  ShieldAlert,
  Clock,
  PlusCircle,
  Volume2,
  VolumeX,
  Trash2,
  ExternalLink,
  Sparkles,
  Inbox,
  X,
  Radio,
} from "lucide-react";

function formatRelativeTime(dateStr) {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSec < 60) return "À l'instant";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `Il y a ${diffMin} min`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `Il y a ${diffHours} h`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return "Hier";
    if (diffDays < 7) return `Il y a ${diffDays} j`;

    return date.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function formatAmount(val) {
  return (
    new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(
      Number(val) || 0
    ) + " FCFA"
  );
}

export default function NotificationBell({ className = "" }) {
  const {
    notifications,
    unreadCount,
    isMuted,
    isRealtimeConnected,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
    toggleMute,
  } = useNotifications();

  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState("all"); // 'all' | 'unread' | 'encaissements'
  const containerRef = useRef(null);

  // Fermer au clic en dehors
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Filtrage des notifications
  const filteredNotifications = useMemo(() => {
    if (filter === "unread") {
      return notifications.filter((n) => !n.read);
    }
    if (filter === "encaissements") {
      return notifications.filter((n) => n.type === "encaissement");
    }
    return notifications;
  }, [notifications, filter]);

  const handleNotificationClick = (notif) => {
    markAsRead(notif.id);
    if (typeof window !== "undefined") {
      const el = document.getElementById("transactions");
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
      }
    }
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {/* ═══ BOUTON CLOCHE ═══ */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Centre de notifications"
        title="Notifications et alertes d'encaissement"
        className={`relative h-10 w-10 sm:h-11 sm:w-11 rounded-xl flex items-center justify-center transition-all duration-200 border ${
          isOpen
            ? "bg-emerald-500 text-black border-emerald-400 shadow-lg shadow-emerald-500/25"
            : unreadCount > 0
            ? "bg-zinc-900 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/10 hover:border-emerald-400 shadow-md shadow-emerald-500/10"
            : "bg-zinc-950 text-zinc-400 border-white/10 hover:text-white hover:bg-zinc-900 hover:border-emerald-500/30"
        } active:scale-95`}
      >
        <Bell className="h-4 w-4 sm:h-5 sm:w-5" />

        {/* Badge animé si non lues */}
        {unreadCount > 0 && (
          <>
            <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-black text-black shadow-md shadow-emerald-500/40 border border-zinc-950">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-emerald-400/40 animate-ping pointer-events-none" />
          </>
        )}
      </button>

      {/* ═══ PANNEAU FLOTTANT (POPOVER) ═══ */}
      {isOpen && (
        <div className="absolute right-0 mt-2.5 w-[360px] sm:w-[420px] max-w-[92vw] rounded-2xl bg-zinc-950/95 backdrop-blur-2xl border border-emerald-500/30 shadow-2xl shadow-black/80 z-50 overflow-hidden animate-slide-up">
          {/* Header du Popover */}
          <div className="p-4 border-b border-white/10 bg-black/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                <Bell className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white tracking-tight flex items-center gap-2">
                  <span>Notifications</span>
                  {unreadCount > 0 && (
                    <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded-full bg-emerald-500 text-black">
                      {unreadCount} new
                    </span>
                  )}
                </h3>
                <span className="text-[10px] text-zinc-400 flex items-center gap-1 mt-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Temps Réel Actif</span>
                </span>
              </div>
            </div>

            {/* Actions du header : Mute + Tout marquer lu */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={toggleMute}
                title={isMuted ? "Activer le son des alertes" : "Désactiver le son"}
                className={`p-1.5 rounded-lg text-xs transition ${
                  isMuted
                    ? "text-zinc-500 hover:text-zinc-300 bg-zinc-900 border border-zinc-800"
                    : "text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 border border-emerald-500/30"
                }`}
              >
                {isMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
              </button>

              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  title="Tout marquer comme lu"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-300 hover:text-emerald-400 px-2 py-1.5 rounded-lg hover:bg-zinc-900 transition"
                >
                  <CheckCheck className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Tout lire</span>
                </button>
              )}
            </div>
          </div>

          {/* Onglets Filtres */}
          <div className="px-3 py-2 border-b border-white/5 bg-zinc-950 flex items-center gap-1 text-xs">
            {[
              { id: "all", label: "Toutes", count: notifications.length },
              { id: "unread", label: "Non lues", count: unreadCount },
              {
                id: "encaissements",
                label: "Encaissements",
                count: notifications.filter((n) => n.type === "encaissement").length,
              },
            ].map(({ id, label, count }) => {
              const active = filter === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFilter(id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1.5 ${
                    active
                      ? "bg-emerald-500 text-black shadow-sm"
                      : "text-zinc-400 hover:text-white hover:bg-zinc-900"
                  }`}
                >
                  <span>{label}</span>
                  {count > 0 && (
                    <span
                      className={`text-[9px] px-1 rounded-full ${
                        active ? "bg-black/25 text-black font-extrabold" : "bg-zinc-800 text-zinc-300"
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Liste des Notifications */}
          <div className="max-h-[360px] overflow-y-auto divide-y divide-white/5 no-scrollbar">
            {filteredNotifications.length > 0 ? (
              filteredNotifications.map((notif) => {
                const isPaid = notif.type === "encaissement";
                const isVerify = notif.type === "a_verifier";

                return (
                  <div
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`p-3.5 transition-all cursor-pointer group flex items-start gap-3 relative ${
                      !notif.read
                        ? "bg-emerald-500/[0.04] hover:bg-emerald-500/[0.08]"
                        : "hover:bg-zinc-900/60"
                    }`}
                  >
                    {/* Pastille non lue */}
                    {!notif.read && (
                      <span className="absolute left-1.5 top-5 h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    )}

                    {/* Icône de type */}
                    <div
                      className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 border ${
                        isPaid
                          ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-sm shadow-emerald-500/20"
                          : isVerify
                          ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                          : "bg-zinc-900 text-zinc-400 border-white/10"
                      }`}
                    >
                      {isPaid ? (
                        <Coins className="h-4 w-4" />
                      ) : isVerify ? (
                        <ShieldAlert className="h-4 w-4" />
                      ) : (
                        <PlusCircle className="h-4 w-4" />
                      )}
                    </div>

                    {/* Contenu */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-white truncate">
                          {notif.title}
                        </span>
                        <span className="text-[10px] text-zinc-400 whitespace-nowrap shrink-0">
                          {formatRelativeTime(notif.createdAt)}
                        </span>
                      </div>

                      {notif.amount > 0 && (
                        <p className="text-xs font-black text-emerald-400 mt-0.5">
                          {isPaid ? "+" : ""}
                          {formatAmount(notif.amount)}
                        </p>
                      )}

                      <p className="text-[11px] text-zinc-400 line-clamp-2 mt-0.5 leading-relaxed">
                        {notif.message}
                      </p>

                      <div className="mt-1 flex items-center gap-2 text-[10px] text-zinc-400">
                        <span className="truncate font-medium text-zinc-300">
                          {notif.clientName}
                        </span>
                        <span>•</span>
                        <span className="truncate">{notif.serviceName}</span>
                      </div>
                    </div>

                    {/* Bouton supprimer au survol */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification(notif.id);
                      }}
                      title="Supprimer"
                      className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 transition"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                );
              })
            ) : (
              /* État vide */
              <div className="p-8 text-center space-y-2">
                <div className="h-12 w-12 rounded-2xl bg-zinc-900 border border-white/10 text-zinc-600 mx-auto flex items-center justify-center">
                  <Inbox className="h-6 w-6" />
                </div>
                <p className="text-xs font-bold text-zinc-300">
                  Aucune notification
                </p>
                <p className="text-[11px] text-zinc-500 max-w-xs mx-auto leading-relaxed">
                  Vos alertes d'encaissement et notifications de factures
                  apparaîtront ici instantanément sans rafraîchir.
                </p>
              </div>
            )}
          </div>

          {/* Pied de Popover : Vider l'historique */}
          {notifications.length > 0 && (
            <div className="p-2.5 border-t border-white/5 bg-black/40 flex items-center justify-between text-[11px]">
              <span className="text-zinc-500">
                {notifications.length} notification{notifications.length > 1 ? "s" : ""} au total
              </span>
              <button
                type="button"
                onClick={clearAll}
                className="text-zinc-400 hover:text-rose-400 transition flex items-center gap-1 font-medium px-2 py-1 rounded hover:bg-zinc-900"
              >
                <Trash2 className="h-3 w-3" />
                <span>Effacer tout</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
