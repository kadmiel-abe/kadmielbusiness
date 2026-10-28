"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import {
  ArrowLeftRight,
  LayoutDashboard,
  LogOut,
  Settings2,
  Users,
} from "lucide-react";

const navigation = [
  { label: "Vue d'ensemble", href: "/dashboard", icon: LayoutDashboard },
  { label: "Transactions", href: "/dashboard#transactions", icon: ArrowLeftRight },
  { label: "Clients", href: "/dashboard#clients", icon: Users },
  { label: "Réglages", href: "/dashboard#settings", icon: Settings2 },
];

export default function DashboardLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClientComponentClient();
  const [signingOut, setSigningOut] = useState(false);

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

  const sidebar = (
    <div className="flex h-full flex-col px-4 py-6">
      <Link href="/dashboard" className="mb-10 flex items-center gap-2 px-2">
        <span className="text-xl font-semibold tracking-tight text-white">
          Kadmiel Pay
        </span>
        <span className="h-2 w-2 rounded-full bg-green-500" aria-hidden="true" />
      </Link>

      <nav aria-label="Navigation principale" className="space-y-1">
        {navigation.map(({ label, href, icon: Icon }, index) => {
          const active = index === 0 && pathname === "/dashboard";
          return (
            <Link
              key={label}
              href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-green-500/10 text-green-400"
                  : "text-zinc-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-white/10 pt-5">
        <div className="flex items-center gap-3 px-2">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-500 text-sm font-bold text-black">
            KA
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">Kadmiel A.</p>
            <p className="truncate text-xs text-zinc-500">Administrateur</p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            aria-label={signingOut ? "Déconnexion en cours" : "Se déconnecter"}
            title={signingOut ? "Déconnexion en cours…" : "Se déconnecter"}
            className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-white/5 hover:text-white disabled:cursor-wait disabled:opacity-50"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-900 text-white">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-white/10 bg-zinc-950 md:block">
        {sidebar}
      </aside>

      <div className="border-b border-white/10 bg-zinc-950 px-4 md:hidden">
        <div className="flex h-14 items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="font-semibold tracking-tight text-white">Kadmiel Pay</span>
            <span className="h-2 w-2 rounded-full bg-green-500" aria-hidden="true" />
          </Link>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-zinc-400 hover:text-white disabled:opacity-50"
          >
            <LogOut className="h-4 w-4" />
            Déconnexion
          </button>
        </div>
        <nav aria-label="Navigation principale" className="no-scrollbar flex gap-2 overflow-x-auto pb-3">
          {navigation.map(({ label, href, icon: Icon }, index) => (
            <Link
              key={label}
              href={href}
              className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${
                index === 0 && pathname === "/dashboard"
                  ? "bg-green-500/10 text-green-400"
                  : "text-zinc-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
      </div>

      <main className="min-h-screen md:ml-64">
        <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
