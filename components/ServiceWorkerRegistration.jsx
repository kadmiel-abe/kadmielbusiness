"use client";

import { useEffect, useState } from "react";
import { Download, X, Smartphone, Check } from "lucide-react";

/**
 * Composant d'enregistrement du Service Worker et gestion de l'installation PWA
 * (Compatible Android Chrome, Samsung Internet, et instructions iOS Safari)
 */
export default function ServiceWorkerRegistration() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // 1. Enregistrement propre du Service Worker dans le navigateur
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js", { scope: "/" })
          .then((registration) => {
            console.log(
              "[PWA] Service Worker Business Pay enregistré avec succès, scope :",
              registration.scope
            );

            // Vérification des mises à jour du SW
            registration.onupdatefound = () => {
              const installingWorker = registration.installing;
              if (installingWorker) {
                installingWorker.onstatechange = () => {
                  if (
                    installingWorker.state === "installed" &&
                    navigator.serviceWorker.controller
                  ) {
                    console.log(
                      "[PWA] Nouvelle version de Business Pay disponible."
                    );
                  }
                };
              }
            };
          })
          .catch((error) => {
            console.warn(
              "[PWA] Échec enregistrement du Service Worker :",
              error
            );
          });
      });
    }

    // 2. Détection si l'application est déjà lancée en mode autonome (PWA installée)
    if (typeof window !== "undefined") {
      const isStandalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        window.navigator.standalone === true;

      if (isStandalone) {
        setIsInstalled(true);
        return;
      }

      // Détection iOS
      const ua = window.navigator.userAgent.toLowerCase();
      const isIphoneOrIpad = /iphone|ipad|ipod/.test(ua);
      setIsIOS(isIphoneOrIpad);

      // Écoute de l'événement natif d'installation Chrome / Android
      const handleBeforeInstallPrompt = (e) => {
        e.preventDefault();
        setDeferredPrompt(e);

        // N'afficher la bannière que si l'utilisateur ne l'a pas masquée récemment
        const dismissedAt = localStorage.getItem("pwa_prompt_dismissed");
        const now = Date.now();
        if (!dismissedAt || now - Number(dismissedAt) > 1000 * 60 * 60 * 24 * 3) {
          // Afficher après 3 secondes pour ne pas gêner le premier affichage
          window.setTimeout(() => {
            setShowInstallBanner(true);
          }, 3000);
        }
      };

      window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

      window.addEventListener("appinstalled", () => {
        console.log("[PWA] Business Pay a été installée avec succès !");
        setIsInstalled(true);
        setShowInstallBanner(false);
        setDeferredPrompt(null);
      });

      return () => {
        window.removeEventListener(
          "beforeinstallprompt",
          handleBeforeInstallPrompt
        );
      };
    }
  }, []);

  // Déclenchement de l'installation native Android/Chrome
  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`[PWA] Choix d'installation : ${outcome}`);

    if (outcome === "accepted") {
      setShowInstallBanner(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowInstallBanner(false);
    try {
      localStorage.setItem("pwa_prompt_dismissed", String(Date.now()));
    } catch {}
  };

  if (isInstalled || !showInstallBanner) return null;

  return (
    <aside
      aria-label="Installation de l'application"
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-50 rounded-2xl border border-emerald-400/40 bg-zinc-950/95 p-4 text-white shadow-2xl backdrop-blur-md animate-slide-up"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-400/30 text-emerald-400">
          <Smartphone className="h-6 w-6 text-[#00F06C]" />
        </span>

        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-white tracking-tight">
            Installer Business Pay
          </h3>
          <p className="mt-0.5 text-xs text-zinc-400 leading-relaxed">
            {isIOS
              ? "Appuyez sur Partager puis « Sur l'écran d'accueil » pour l'utiliser comme une vraie app."
              : "Ajoutez l'application sur votre écran d'accueil pour un accès instantané hors-ligne."}
          </p>

          <div className="mt-3 flex items-center gap-2">
            {!isIOS && deferredPrompt && (
              <button
                type="button"
                onClick={handleInstallClick}
                className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-[#00F06C] hover:bg-emerald-400 px-3 text-xs font-extrabold text-black transition active:scale-95 shadow-md shadow-emerald-500/25"
              >
                <Download className="h-3.5 w-3.5 stroke-[2.5]" />
                <span>Installer l&apos;app</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleDismiss}
              className="inline-flex h-8 items-center justify-center rounded-lg px-2.5 text-xs font-semibold text-zinc-400 hover:text-white hover:bg-zinc-900 transition"
            >
              Plus tard
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          className="text-zinc-500 hover:text-white transition p-1"
          aria-label="Fermer la suggestion"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}
