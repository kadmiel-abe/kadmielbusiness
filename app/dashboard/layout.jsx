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
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
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

  const renderNavigation = (mobile = false) => (
    <nav
      aria-label="Navigation principale"
      className={mobile ? "no-scrollbar flex gap-2 overflow-x-auto pb-3" : "space-y-1"}
    >
      {navigation.map(({ label, href, icon: Icon }, index) => {
        const active = index === 0 && pathname === "/dashboard";
        return (
          <Link
            key={label}
            href={href}
            className={`${mobile ? "flex shrink-0 items-center gap-2 px-3 py-2 text-xs" : "flex items-center gap-3 px-3 py-2.5 text-sm"} rounded-lg font-medium transition-colors ${
              active
                ? "bg-lime-400/10 text-lime-400"
                : "text-zinc-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            <Icon className={mobile ? "h-4 w-4" : "h-[18px] w-[18px]"} strokeWidth={1.8} />
            {label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-white/5 bg-zinc-950 md:block">
        <div className="flex h-full flex-col px-4 py-6">
          <Link href="/dashboard" className="mb-10 flex items-center gap-3 px-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-lime-400 text-sm font-bold text-black">
              K
            </span>
            <span>
              <span className="block text-base font-semibold tracking-tight text-white">Kadmiel</span>
              <span className="block text-xs text-zinc-500">Admin</span>
            </span>
          </Link>

          {renderNavigation()}

          <div className="mt-auto border-t border-white/5 pt-5">
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-400 transition-colors hover:bg-white/5 hover:text-white disabled:cursor-wait disabled:opacity-50"
            >
              <LogOut className="h-[18px] w-[18px]" />
              {signingOut ? "Déconnexion…" : "Se déconnecter"}
            </button>
          </div>
        </div>
      </aside>

      <div className="border-b border-white/5 bg-zinc-950 px-4 md:hidden">
        <div className="flex h-14 items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-lime-400 text-xs font-bold text-black">K</span>
            <span className="text-sm font-semibold text-white">Kadmiel <span className="font-normal text-zinc-500">· Admin</span></span>
          </Link>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            aria-label="Se déconnecter"
            className="rounded-lg p-2 text-zinc-400 hover:bg-white/5 hover:text-white disabled:opacity-50"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
        {renderNavigation(true)}
      </div>

      <main className="min-h-screen bg-zinc-950 md:ml-64">
        <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
