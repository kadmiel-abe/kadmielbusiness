"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import {
  ArrowLeftRight,
  LayoutDashboard,
  LogOut,
  Settings2,
  Users,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
  PlusCircle,
  ShieldCheck,
} from "lucide-react";
import { NotificationProvider } from "@/context/NotificationContext";
import NotificationBell from "@/components/NotificationBell";
import PaymentAlertToast from "@/components/PaymentAlertToast";

const navigation = [
  { label: "Vue d'ensemble", href: "/dashboard", icon: LayoutDashboard },
  { label: "Nouveau lien", href: "/dashboard/new", icon: PlusCircle },
  { label: "Transactions", href: "/dashboard#transactions", icon: ArrowLeftRight },
  { label: "Répertoire Clients", href: "/clients", icon: Users },
  { label: "Réglages", href: "/dashboard#settings", icon: Settings2 },
];

export default function DashboardLayoutShell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [supabase] = useState(() => createClientComponentClient());

  // États du Layout
  const [signingOut, setSigningOut] = useState(false);
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  // Fermer le drawer mobile lors du changement de route
  useEffect(() => {
    setIsMobileDrawerOpen(false);
  }, [pathname]);

  // Empêcher le scroll du body quand le drawer mobile est ouvert
  useEffect(() => {
    if (isMobileDrawerOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isMobileDrawerOpen]);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      router.push("/");
      router.refresh();
    } catch (error) {
      console.error("Erreur lors de la déconnexion :", error);
      setSigningOut(false);
    }
  };

  const isNavItemActive = (href) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    if (href === "/clients") return pathname.startsWith("/clients");
    if (href === "/dashboard/new") return pathname === "/dashboard/new" || pathname === "/dashboard/nouveau";
    return pathname === href;
  };

  return (
    <NotificationProvider>
      <div className="min-h-screen bg-black text-white font-sans selection:bg-emerald-500 selection:text-black">
        {/* ═════════════════════════════════════════════════════════
            1. SIDEBAR DESKTOP — THEME VERT PUR & NOIR PROFOND
           ═════════════════════════════════════════════════════════ */}
        <aside
          className={`fixed inset-y-0 left-0 z-30 hidden md:flex flex-col border-r border-emerald-500/20 bg-black backdrop-blur-2xl transition-all duration-300 ease-in-out ${
            isDesktopCollapsed ? "w-20" : "w-64"
          }`}
        >
          {/* Header de la Sidebar : Logo officiel + Nom + Bouton réduction */}
          <div className="p-4 flex items-center justify-between border-b border-emerald-500/15 h-20 bg-black">
            <Link
              href="/dashboard"
              className={`flex items-center gap-3 transition-opacity ${
                isDesktopCollapsed ? "justify-center w-full" : ""
              }`}
              title="Kadmiel Business Pay"
            >
              {/* Logo officiel (Vert et Noir) */}
              <div className="relative h-11 w-11 shrink-0 rounded-xl overflow-hidden bg-black border border-emerald-500/40 shadow-lg shadow-emerald-500/10 group">
                <Image
                  src="/logo.png"
                  alt="Logo Kadmiel"
                  width={44}
                  height={44}
                  priority
                  className="object-cover transition-transform duration-300 group-hover:scale-110"
                />
              </div>

              {!isDesktopCollapsed && (
                <div className="min-w-0 flex-1">
                  <span className="block text-sm font-black tracking-tight text-white truncate">
                    Kadmiel
                  </span>
                  <span className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Business Pay
                  </span>
                </div>
              )}
            </Link>

            {/* Bouton de réduction de la sidebar */}
            {!isDesktopCollapsed && (
              <button
                type="button"
                onClick={() => setIsDesktopCollapsed(true)}
                aria-label="Réduire la barre latérale"
                title="Réduire la barre latérale"
                className="h-8 w-8 rounded-lg bg-zinc-900 border border-emerald-500/20 text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/40 flex items-center justify-center transition-all duration-200 active:scale-95"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Bouton de réouverture si la sidebar est réduite */}
          {isDesktopCollapsed && (
            <div className="px-3 pt-3">
              <button
                type="button"
                onClick={() => setIsDesktopCollapsed(false)}
                aria-label="Agrandir la barre latérale"
                title="Agrandir la barre latérale"
                className="w-full h-8 rounded-lg bg-zinc-900 border border-emerald-500/20 text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/40 flex items-center justify-center transition-all duration-200"
              >
                <PanelLeftOpen className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Navigation */}
          <nav
            aria-label="Navigation latérale"
            className="flex-1 px-3 py-5 space-y-1.5 overflow-y-auto no-scrollbar"
          >
            {navigation.map(({ label, href, icon: Icon }) => {
              const isActive = isNavItemActive(href);

              return (
                <Link
                  key={label}
                  href={href}
                  title={isDesktopCollapsed ? label : undefined}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 group ${
                    isDesktopCollapsed ? "justify-center px-0" : ""
                  } ${
                    isActive
                      ? "bg-emerald-500 text-black font-extrabold shadow-lg shadow-emerald-500/20 border border-emerald-400"
                      : "text-zinc-400 hover:text-white hover:bg-zinc-900/80 border border-transparent hover:border-emerald-500/20"
                  }`}
                >
                  <Icon
                    className={`h-[18px] w-[18px] shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                      isActive ? "text-black" : "text-zinc-400 group-hover:text-emerald-400"
                    }`}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                  {!isDesktopCollapsed && <span className="truncate">{label}</span>}
                </Link>
              );
            })}
          </nav>

          {/* Pied de sidebar : Statut & Déconnexion */}
          <div className="p-3 border-t border-emerald-500/15 space-y-2 bg-black">
            {!isDesktopCollapsed && (
              <div className="px-3 py-2 rounded-xl bg-zinc-950 border border-emerald-500/20 flex items-center justify-between">
                <span className="text-[11px] font-semibold text-zinc-400 flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                  Live GeniusPay
                </span>
                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400 animate-pulse" />
              </div>
            )}

            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              title={isDesktopCollapsed ? "Se déconnecter" : undefined}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all duration-200 border border-transparent hover:border-rose-500/20 disabled:cursor-wait disabled:opacity-50 ${
                isDesktopCollapsed ? "justify-center px-0" : ""
              }`}
            >
              <LogOut className="h-[18px] w-[18px] shrink-0" />
              {!isDesktopCollapsed && (
                <span>{signingOut ? "Déconnexion..." : "Se déconnecter"}</span>
              )}
            </button>
          </div>
        </aside>

        {/* ═════════════════════════════════════════════════════════
            2. HEADER MOBILE (AVEC HAMBURGER ET LOGO)
           ═════════════════════════════════════════════════════════ */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-emerald-500/20 bg-black/90 backdrop-blur-xl px-4 md:hidden">
          {/* Bouton Hamburger */}
          <button
            type="button"
            onClick={() => setIsMobileDrawerOpen(true)}
            aria-label="Ouvrir le menu"
            className="h-10 w-10 rounded-xl bg-zinc-950 border border-emerald-500/20 text-zinc-300 hover:text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/40 flex items-center justify-center transition-all active:scale-95"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Logo de marque central */}
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg overflow-hidden bg-black border border-emerald-500/40 shadow-sm">
              <Image
                src="/logo.png"
                alt="Logo Kadmiel"
                width={36}
                height={36}
                priority
                className="object-cover"
              />
            </div>
            <span className="text-sm font-black tracking-tight text-white">
              Kadmiel <span className="text-emerald-400 font-bold">Pay</span>
            </span>
          </Link>

          {/* Actions header mobile : Cloche notifications + Déconnexion */}
          <div className="flex items-center gap-2">
            <NotificationBell />
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              aria-label="Se déconnecter"
              title="Se déconnecter"
              className="h-10 w-10 rounded-xl bg-zinc-950 border border-white/10 text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/30 flex items-center justify-center transition-all active:scale-95 disabled:opacity-50"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* ═════════════════════════════════════════════════════════
            3. DRAWER SLIDE-OVER MOBILE
           ═════════════════════════════════════════════════════════ */}
        {isMobileDrawerOpen && (
          <div className="fixed inset-0 z-50 md:hidden animate-fade-in">
            {/* Overlay sombre */}
            <div
              className="fixed inset-0 bg-black/85 backdrop-blur-md transition-opacity"
              onClick={() => setIsMobileDrawerOpen(false)}
              aria-hidden="true"
            />

            {/* Panneau latéral du Drawer */}
            <div className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-black border-r border-emerald-500/30 shadow-2xl p-5 flex flex-col justify-between animate-slide-up">
              <div>
                {/* Header du Drawer avec Logo & Fermeture */}
                <div className="flex items-center justify-between pb-5 border-b border-emerald-500/20">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl overflow-hidden bg-black border border-emerald-500/40 shadow-md shadow-emerald-500/15">
                      <Image
                        src="/logo.png"
                        alt="Logo Kadmiel"
                        width={40}
                        height={40}
                        priority
                        className="object-cover"
                      />
                    </div>
                    <div>
                      <h2 className="text-sm font-black text-white tracking-tight">
                        Kadmiel
                      </h2>
                      <p className="text-[11px] text-emerald-400 font-bold">
                        Business Pay
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsMobileDrawerOpen(false)}
                    aria-label="Fermer le menu"
                    title="Fermer le menu"
                    className="h-9 w-9 rounded-xl bg-zinc-900 border border-emerald-500/30 text-zinc-400 hover:text-white hover:bg-emerald-500 hover:text-black flex items-center justify-center transition-all duration-200 active:scale-90"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Navigation Mobile */}
                <nav aria-label="Navigation mobile" className="mt-6 space-y-2">
                  {navigation.map(({ label, href, icon: Icon }) => {
                    const isActive = isNavItemActive(href);

                    return (
                      <Link
                        key={label}
                        href={href}
                        onClick={() => setIsMobileDrawerOpen(false)}
                        className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-bold transition-all ${
                          isActive
                            ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/25 border border-emerald-400"
                            : "text-zinc-400 hover:text-white hover:bg-zinc-900 border border-transparent hover:border-emerald-500/20"
                        }`}
                      >
                        <Icon
                          className={`h-5 w-5 ${
                            isActive ? "text-black" : "text-zinc-400"
                          }`}
                          strokeWidth={isActive ? 2.5 : 2}
                        />
                        <span>{label}</span>
                      </Link>
                    );
                  })}
                </nav>
              </div>

              {/* Pied du Drawer */}
              <div className="pt-5 border-t border-emerald-500/20 space-y-3">
                <div className="p-3 rounded-xl bg-zinc-950 border border-emerald-500/20 text-center">
                  <p className="text-[11px] font-semibold text-zinc-400">Mode Live Actif</p>
                  <p className="text-[10px] text-emerald-400 font-mono mt-0.5">
                    Orchestrateur GeniusPay CI
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="flex w-full items-center justify-center gap-2.5 rounded-xl px-4 py-2.5 text-xs font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 transition-all active:scale-95 disabled:opacity-50"
                >
                  <LogOut className="h-4 w-4" />
                  <span>{signingOut ? "Déconnexion..." : "Se déconnecter"}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═════════════════════════════════════════════════════════
            4. CONTENU PRINCIPAL
           ═════════════════════════════════════════════════════════ */}
        <main
          className={`min-h-screen bg-black transition-all duration-300 ease-in-out ${
            isDesktopCollapsed ? "md:ml-20" : "md:ml-64"
          }`}
        >
          <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {children}
          </div>
        </main>

        {/* Alerte Toast d'Encaissement Flottante */}
        <PaymentAlertToast />
      </div>
    </NotificationProvider>
  );
}
