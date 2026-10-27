"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { LogOut, Loader2 } from "lucide-react";

export default function DashboardHeader() {
  const router = useRouter();
  const supabase = createClientComponentClient();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    try {
      setSigningOut(true);
      await supabase.auth.signOut();
      router.push("/");
      router.refresh();
    } catch (error) {
      console.error("Erreur lors de la déconnexion :", error);
      setSigningOut(false);
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
      {/* Partie gauche (Branding) */}
      <Link href="/dashboard" className="flex items-center gap-3 group">
        <img
          src="/logo.png"
          alt="Kadmiel Business Pay Logo"
          className="h-9 w-auto object-contain transition-transform duration-200 group-hover:scale-105"
        />
        <span className="font-semibold text-gray-900 text-lg tracking-tight">
          Kadmiel Business Pay
        </span>
      </Link>

      {/* Partie droite (Action) */}
      <button
        type="button"
        onClick={handleSignOut}
        disabled={signingOut}
        id="signout-button"
        className="text-gray-600 hover:text-red-600 hover:bg-red-50 px-3.5 py-2 rounded-lg transition-colors text-sm font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {signingOut ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin text-red-500" />
            <span>Déconnexion...</span>
          </>
        ) : (
          <>
            <LogOut className="w-4 h-4" />
            <span>Se déconnecter</span>
          </>
        )}
      </button>
    </header>
  );
}
