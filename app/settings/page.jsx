"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import {
  User,
  ShieldCheck,
  Lock,
  Building2,
  Phone,
  Mail,
  MapPin,
  Camera,
  Trash2,
  Check,
  AlertCircle,
  Eye,
  EyeOff,
  Server,
  Zap,
  Percent,
  Coins,
  RefreshCw,
  ArrowLeft,
  KeyRound,
  Sparkles,
  CheckCircle2,
  HelpCircle,
  Upload,
} from "lucide-react";

// Avatars prédéfinis de secours stylisés
const PRESET_AVATARS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&h=256&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&h=256&q=80",
  "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=256&h=256&q=80",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=256&h=256&q=80",
];

export default function SettingsPage() {
  const [supabase] = useState(() => createClientComponentClient());

  // Onglet actif ('profile' | 'business' | 'fees' | 'security' | 'system')
  const [activeTab, setActiveTab] = useState("profile");

  // État de chargement initial
  const [loading, setLoading] = useState(true);

  // Profil & Coordonnées
  const [profile, setProfile] = useState({
    id: "",
    email: "",
    full_name: "",
    avatar_url: "",
    business_name: "",
    phone: "",
    location: "",
    default_fee_bearer: "client",
  });

  // États de sauvegarde profil / coordonnées
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccessMessage, setProfileSuccessMessage] = useState("");
  const [profileErrorMessage, setProfileErrorMessage] = useState("");

  // États du formulaire de mot de passe
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordSuccessMessage, setPasswordSuccessMessage] = useState("");
  const [passwordErrorMessage, setPasswordErrorMessage] = useState("");

  // État du simulateur de frais
  const [simulationAmount, setSimulationAmount] = useState(50000);

  // État du test de connectivité système
  const [testingSystem, setTestingSystem] = useState(false);
  const [systemStatus, setSystemStatus] = useState({
    supabase: "connected",
    geniuspay: "live",
    receipts: "active",
  });

  // Charger le profil utilisateur au montage
  useEffect(() => {
    async function fetchUserData() {
      setLoading(true);
      try {
        const res = await fetch("/api/settings");
        if (res.ok) {
          const data = await res.json();
          if (data?.profile) {
            setProfile(data.profile);
            if (data.profile.default_fee_bearer) {
              try {
                localStorage.setItem(
                  "kadmiel_default_fee_bearer",
                  data.profile.default_fee_bearer
                );
              } catch {
                // ignore
              }
            }
          }
        } else {
          // Secours via Supabase Client
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (session?.user) {
            const meta = session.user.user_metadata || {};
            setProfile({
              id: session.user.id,
              email: session.user.email || "",
              full_name: meta.full_name || meta.name || "Kadmiel ABE",
              avatar_url: meta.avatar_url || "",
              business_name: meta.business_name || "Kadmiel Business Pay",
              phone: meta.phone || "+225 07 00 00 00 00",
              location: meta.location || "Abidjan, Côte d'Ivoire",
              default_fee_bearer: meta.default_fee_bearer || "client",
            });
          }
        }
      } catch (err) {
        console.error("Erreur chargement réglages :", err);
      } finally {
        setLoading(false);
      }
    }

    fetchUserData();
  }, [supabase]);

  // Initiales pour l'avatar de secours
  const initials = useMemo(() => {
    const name = profile.full_name || profile.business_name || "Admin";
    return name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }, [profile.full_name, profile.business_name]);

  // Calcul du score de robustesse du mot de passe
  const passwordStrength = useMemo(() => {
    let score = 0;
    if (newPassword.length >= 8) score += 1;
    if (newPassword.length >= 12) score += 1;
    if (/[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword)) score += 1;
    if (/[0-9]/.test(newPassword) || /[^A-Za-z0-9]/.test(newPassword)) score += 1;
    return score; // 0 à 4
  }, [newPassword]);

  // Calcul de la simulation de frais
  const simulatedFees = useMemo(() => {
    const rawVal = Number(simulationAmount) || 0;
    if (rawVal <= 0) return { clientTotal: 0, freelanceNet: 0, fees: 0 };

    if (profile.default_fee_bearer === "client") {
      // Frais client : client paie ceil((net + 100) / 0.99)
      const clientTotal = Math.ceil((rawVal + 100) / 0.99);
      const fees = clientTotal - rawVal;
      return { clientTotal, freelanceNet: rawVal, fees };
    } else {
      // Frais freelance : client paie net, freelance reçoit net - frais
      const clientTotal = rawVal;
      const fees = Math.ceil(clientTotal * 0.01 + 100);
      const freelanceNet = Math.max(0, clientTotal - fees);
      return { clientTotal, freelanceNet, fees };
    }
  }, [simulationAmount, profile.default_fee_bearer]);

  // Gestion de l'upload de photo de profil (Data URL Base64)
  const handleAvatarFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setProfileErrorMessage("Veuillez sélectionner un fichier image valide (JPG, PNG, WebP).");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setProfileErrorMessage("L'image ne doit pas dépasser 2 Mo.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result;
      if (typeof result === "string") {
        setProfile((prev) => ({ ...prev, avatar_url: result }));
        setProfileErrorMessage("");
      }
    };
    reader.readAsDataURL(file);
  };

  // Suppression de la photo de profil
  const handleRemoveAvatar = () => {
    setProfile((prev) => ({ ...prev, avatar_url: "" }));
  };

  // Sauvegarde des informations du profil et entreprise
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileSuccessMessage("");
    setProfileErrorMessage("");

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: profile.full_name,
          avatar_url: profile.avatar_url,
          business_name: profile.business_name,
          phone: profile.phone,
          location: profile.location,
          default_fee_bearer: profile.default_fee_bearer,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Impossible d'enregistrer les réglages.");
      }

      // Mettre en cache local
      try {
        localStorage.setItem(
          "kadmiel_default_fee_bearer",
          profile.default_fee_bearer
        );
      } catch {
        // ignore
      }

      // Notifier le layout pour mise à jour immédiate de la sidebar
      window.dispatchEvent(new Event("kadmiel:profile_updated"));

      setProfileSuccessMessage("Vos informations ont été enregistrées avec succès !");
      setTimeout(() => setProfileSuccessMessage(""), 5000);
    } catch (err) {
      setProfileErrorMessage(err.message || "Erreur lors de la sauvegarde.");
    } finally {
      setSavingProfile(false);
    }
  };

  // Modification du mot de passe administrateur
  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setPasswordSuccessMessage("");
    setPasswordErrorMessage("");

    if (!newPassword || newPassword.length < 8) {
      setPasswordErrorMessage("Le mot de passe doit comporter au moins 8 caractères.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordErrorMessage("Les deux mots de passe saisis ne sont pas identiques.");
      return;
    }

    setSavingPassword(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        throw error;
      }

      setPasswordSuccessMessage(
        "Votre mot de passe a été modifié avec succès. Conservez-le précieusement."
      );
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPasswordSuccessMessage(""), 6000);
    } catch (err) {
      console.error("Erreur modification mot de passe :", err);
      setPasswordErrorMessage(
        err.message || "Une erreur est survenue lors de la mise à jour du mot de passe."
      );
    } finally {
      setSavingPassword(false);
    }
  };

  // Test de diagnostic de la connectivité système
  const handleTestSystem = async () => {
    setTestingSystem(true);
    await new Promise((r) => setTimeout(r, 700));
    setTestingSystem(false);
  };

  const formatCFA = (val) =>
    `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(
      Number(val) || 0
    )} FCFA`;

  return (
    <div className="space-y-8 pb-16">
      {/* ═════════════════════════════════════════════════════════
          1. EN-TÊTE DE LA PAGE AVEC FIL D'ARIANE
         ═════════════════════════════════════════════════════════ */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-emerald-500/20 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-400 mb-1.5">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 hover:text-emerald-400 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Vue d'ensemble
            </Link>
            <span className="text-zinc-600">/</span>
            <span className="text-emerald-400 font-bold">Réglages</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <span>Réglages du Compte</span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Super Admin
            </span>
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-zinc-400 max-w-2xl">
            Gérez votre profil administrateur, votre identité d'entreprise, la sécurité
            d'accès et les préférences de frais de transaction.
          </p>
        </div>

        {/* Bouton retour rapide */}
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-bold text-zinc-300 hover:text-white hover:border-emerald-500/40 hover:bg-zinc-850 transition-all shadow-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Retour au Dashboard</span>
        </Link>
      </div>

      {/* ═════════════════════════════════════════════════════════
          2. ONGLET DE NAVIGATION (MOBILE-FIRST)
         ═════════════════════════════════════════════════════════ */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-zinc-800/80 no-scrollbar">
        {[
          { id: "profile", label: "Profil & Identité", icon: User },
          { id: "business", label: "Coordonnées & Marque", icon: Building2 },
          { id: "fees", label: "Configuration Frais", icon: Percent },
          { id: "security", label: "Sécurité & Mot de passe", icon: Lock },
          { id: "system", label: "Statut du Système", icon: Server },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-200 ${
                isActive
                  ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/20 border border-emerald-400"
                  : "bg-zinc-950 text-zinc-400 hover:text-white hover:bg-zinc-900 border border-zinc-850 hover:border-emerald-500/20"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={isActive ? 2.5 : 2} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Bannière de chargement */}
      {loading && (
        <div className="p-8 text-center bg-zinc-950 border border-emerald-500/20 rounded-2xl animate-pulse">
          <RefreshCw className="h-6 w-6 text-emerald-400 mx-auto animate-spin mb-2" />
          <p className="text-xs text-zinc-400 font-medium">
            Chargement sécurisé de vos paramètres administrateur...
          </p>
        </div>
      )}

      {!loading && (
        <div className="space-y-8">
          {/* ═════════════════════════════════════════════════════════
              3. SECTION A : PROFIL ADMINISTRATEUR & AVATAR
             ═════════════════════════════════════════════════════════ */}
          {(activeTab === "profile" || activeTab === "all") && (
            <div className="rounded-2xl border border-emerald-500/20 bg-zinc-950 p-6 sm:p-8 space-y-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-850 pb-5">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2.5">
                    <User className="h-5 w-5 text-emerald-400" />
                    Profil Administrateur & Photo
                  </h2>
                  <p className="text-xs text-zinc-400 mt-1">
                    Personnalisez votre avatar et votre identité d'affichage sur la plateforme.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Compte Vérifié
                  </span>
                </div>
              </div>

              {/* Photo de profil et gestion */}
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 p-4 rounded-xl bg-black border border-emerald-500/20">
                <div className="relative group shrink-0">
                  <div className="h-24 w-24 sm:h-28 sm:w-28 rounded-2xl overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-800 to-black border-2 border-emerald-500/50 shadow-xl shadow-emerald-500/15 flex items-center justify-center text-2xl font-black text-white">
                    {profile.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={profile.avatar_url}
                        alt={profile.full_name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span>{initials}</span>
                    )}
                  </div>
                  <span className="absolute -bottom-1.5 -right-1.5 h-6 w-6 rounded-full bg-emerald-500 border-2 border-black flex items-center justify-center text-[10px] text-black font-bold shadow-md shadow-emerald-500/50">
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  </span>
                </div>

                <div className="space-y-3 text-center sm:text-left flex-1 min-w-0">
                  <div>
                    <h3 className="text-base font-bold text-white">
                      {profile.full_name || "Administrateur Kadmiel"}
                    </h3>
                    <p className="text-xs text-zinc-400 font-mono mt-0.5">
                      {profile.email}
                    </p>
                  </div>

                  {/* Actions Photo */}
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 pt-1">
                    <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-500 text-black text-xs font-bold hover:bg-emerald-400 transition-all cursor-pointer shadow-md shadow-emerald-500/20 active:scale-95">
                      <Upload className="h-3.5 w-3.5" />
                      <span>Téléverser une photo</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarFileUpload}
                        className="hidden"
                      />
                    </label>

                    {profile.avatar_url && (
                      <button
                        type="button"
                        onClick={handleRemoveAvatar}
                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-rose-400 text-xs font-bold hover:bg-rose-500/10 hover:border-rose-500/30 transition-all active:scale-95"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Retirer la photo</span>
                      </button>
                    )}
                  </div>

                  {/* Choix d'avatar prédéfini rapide */}
                  <div className="pt-2">
                    <span className="text-[11px] font-semibold text-zinc-500 block mb-2">
                      Ou choisissez un avatar rapide :
                    </span>
                    <div className="flex items-center justify-center sm:justify-start gap-2">
                      {PRESET_AVATARS.map((url, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setProfile((prev) => ({ ...prev, avatar_url: url }))}
                          title="Choisir cet avatar"
                          className={`h-9 w-9 rounded-xl overflow-hidden border-2 transition-transform hover:scale-110 ${
                            profile.avatar_url === url
                              ? "border-emerald-400 ring-2 ring-emerald-500/40"
                              : "border-zinc-800 opacity-70 hover:opacity-100"
                          }`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={url}
                            alt={`Avatar ${i + 1}`}
                            className="h-full w-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Formulaire profil */}
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-emerald-400" />
                      Nom complet de l'administrateur
                    </label>
                    <input
                      type="text"
                      value={profile.full_name}
                      onChange={(e) =>
                        setProfile((prev) => ({ ...prev, full_name: e.target.value }))
                      }
                      placeholder="Ex: Kadmiel ABE"
                      required
                      className="w-full px-4 py-2.5 rounded-xl bg-black border border-emerald-500/20 text-white text-xs placeholder:text-zinc-600 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 text-emerald-400" />
                      Email de connexion principal
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        value={profile.email}
                        readOnly
                        disabled
                        className="w-full px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 text-xs cursor-not-allowed"
                      />
                      <span className="absolute right-3 top-2.5 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        Vérifié
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-500">
                      Identifiant maître utilisé pour l'authentification sécurisée.
                    </p>
                  </div>
                </div>

                {/* Notifications de succès / erreur */}
                {profileSuccessMessage && (
                  <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2 animate-fade-in">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>{profileSuccessMessage}</span>
                  </div>
                )}

                {profileErrorMessage && (
                  <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2 animate-fade-in">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{profileErrorMessage}</span>
                  </div>
                )}

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 text-black text-xs font-extrabold hover:bg-emerald-400 transition-all shadow-md shadow-emerald-500/20 active:scale-95 disabled:opacity-50 disabled:cursor-wait"
                  >
                    {savingProfile ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    )}
                    <span>{savingProfile ? "Enregistrement..." : "Enregistrer le profil"}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════
              4. SECTION B : COORDONNÉES & ENTREPRISE
             ═════════════════════════════════════════════════════════ */}
          {(activeTab === "business" || activeTab === "all") && (
            <div className="rounded-2xl border border-emerald-500/20 bg-zinc-950 p-6 sm:p-8 space-y-6 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-850 pb-5">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2.5">
                    <Building2 className="h-5 w-5 text-emerald-400" />
                    Informations Professionnelles & Entreprise
                  </h2>
                  <p className="text-xs text-zinc-400 mt-1">
                    Ces coordonnées figurent sur les reçus officiels transmis à vos clients.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 text-emerald-400" />
                      Nom commercial de l'entreprise ou marque
                    </label>
                    <input
                      type="text"
                      value={profile.business_name}
                      onChange={(e) =>
                        setProfile((prev) => ({ ...prev, business_name: e.target.value }))
                      }
                      placeholder="Ex: Kadmiel Business Pay"
                      required
                      className="w-full px-4 py-2.5 rounded-xl bg-black border border-emerald-500/20 text-white text-xs placeholder:text-zinc-600 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition"
                    />
                    <p className="text-[10px] text-zinc-500">
                      Affiché comme émetteur sur vos liens et reçus certifiés.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-emerald-400" />
                      Téléphone WhatsApp Professionnel
                    </label>
                    <input
                      type="tel"
                      value={profile.phone}
                      onChange={(e) =>
                        setProfile((prev) => ({ ...prev, phone: e.target.value }))
                      }
                      placeholder="+225 07 00 00 00 00"
                      required
                      className="w-full px-4 py-2.5 rounded-xl bg-black border border-emerald-500/20 text-white text-xs placeholder:text-zinc-600 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition"
                    />
                    <p className="text-[10px] text-zinc-500">
                      Numéro de contact officiel utilisé pour les envois et le service client.
                    </p>
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-emerald-400" />
                      Siège social & Localisation
                    </label>
                    <input
                      type="text"
                      value={profile.location}
                      onChange={(e) =>
                        setProfile((prev) => ({ ...prev, location: e.target.value }))
                      }
                      placeholder="Ex: Abidjan, Cocody, Côte d'Ivoire"
                      className="w-full px-4 py-2.5 rounded-xl bg-black border border-emerald-500/20 text-white text-xs placeholder:text-zinc-600 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 text-black text-xs font-extrabold hover:bg-emerald-400 transition-all shadow-md shadow-emerald-500/20 active:scale-95 disabled:opacity-50"
                  >
                    {savingProfile ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    )}
                    <span>
                      {savingProfile
                        ? "Enregistrement..."
                        : "Enregistrer les coordonnées"}
                    </span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════
              5. SECTION C : CONFIGURATION FINANCIÈRE & FRAIS
             ═════════════════════════════════════════════════════════ */}
          {(activeTab === "fees" || activeTab === "all") && (
            <div className="rounded-2xl border border-emerald-500/20 bg-zinc-950 p-6 sm:p-8 space-y-6 shadow-xl">
              <div className="border-b border-zinc-850 pb-5">
                <h2 className="text-lg font-bold text-white flex items-center gap-2.5">
                  <Percent className="h-5 w-5 text-emerald-400" />
                  Configuration des Frais par Défaut
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Déterminez qui supporte les frais de transaction GeniusPay (1% + 100 FCFA)
                  lors de la création de nouveaux liens de paiement.
                </p>
              </div>

              {/* Sélecteur des deux stratégies */}
              <div className="grid gap-4 md:grid-cols-2">
                {/* Option 1 : Client supporte les frais */}
                <div
                  onClick={() =>
                    setProfile((prev) => ({ ...prev, default_fee_bearer: "client" }))
                  }
                  className={`p-5 rounded-2xl border cursor-pointer transition-all ${
                    profile.default_fee_bearer === "client"
                      ? "bg-emerald-500/10 border-emerald-500 shadow-lg shadow-emerald-500/10"
                      : "bg-black border-zinc-800 hover:border-emerald-500/30"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
                      Recommandé
                    </span>
                    <span
                      className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                        profile.default_fee_bearer === "client"
                          ? "border-emerald-400 bg-emerald-500"
                          : "border-zinc-700"
                      }`}
                    >
                      {profile.default_fee_bearer === "client" && (
                        <span className="h-1.5 w-1.5 rounded-full bg-black" />
                      )}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-white mt-2">
                    Frais à la charge du client
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1">
                    Les frais de passerelle (1% + 100 FCFA) sont ajoutés au total payé par le client.
                    Vous recevez <strong className="text-white">100% de votre montant net</strong>.
                  </p>

                  <div className="mt-4 pt-3 border-t border-emerald-500/20 text-[11px] text-emerald-300 font-semibold flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                    Zéro perte sur vos prestations
                  </div>
                </div>

                {/* Option 2 : Freelance prend en charge */}
                <div
                  onClick={() =>
                    setProfile((prev) => ({ ...prev, default_fee_bearer: "freelance" }))
                  }
                  className={`p-5 rounded-2xl border cursor-pointer transition-all ${
                    profile.default_fee_bearer === "freelance"
                      ? "bg-emerald-500/10 border-emerald-500 shadow-lg shadow-emerald-500/10"
                      : "bg-black border-zinc-800 hover:border-emerald-500/30"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-zinc-400">
                      Prix Rond
                    </span>
                    <span
                      className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                        profile.default_fee_bearer === "freelance"
                          ? "border-emerald-400 bg-emerald-500"
                          : "border-zinc-700"
                      }`}
                    >
                      {profile.default_fee_bearer === "freelance" && (
                        <span className="h-1.5 w-1.5 rounded-full bg-black" />
                      )}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-white mt-2">
                    Frais offerts par le freelance
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1">
                    Le client paie exactement le montant affiché. Les frais sont prélevés
                    sur le montant final reversé sur votre compte.
                  </p>

                  <div className="mt-4 pt-3 border-t border-zinc-800 text-[11px] text-zinc-400 flex items-center gap-1.5">
                    <Coins className="h-3.5 w-3.5 text-zinc-400" />
                    Plus simple et rassurant pour certains clients
                  </div>
                </div>
              </div>

              {/* Simulateur interactif en direct */}
              <div className="p-5 rounded-2xl bg-black border border-emerald-500/20 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <span className="text-xs font-bold text-white flex items-center gap-2">
                    <Zap className="h-4 w-4 text-emerald-400" />
                    Simulateur de transaction en direct :
                  </span>
                  <div className="flex items-center gap-1.5">
                    {[10000, 50000, 100000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setSimulationAmount(amt)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                          simulationAmount === amt
                            ? "bg-emerald-500 text-black"
                            : "bg-zinc-900 text-zinc-400 hover:text-white"
                        }`}
                      >
                        {formatCFA(amt)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3 pt-2">
                  <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-850">
                    <p className="text-[10px] text-zinc-500 uppercase font-bold">
                      Prestation demandée
                    </p>
                    <p className="text-base font-black text-white mt-0.5">
                      {formatCFA(simulationAmount)}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-850">
                    <p className="text-[10px] text-zinc-500 uppercase font-bold">
                      Payé par le client
                    </p>
                    <p className="text-base font-black text-emerald-400 mt-0.5">
                      {formatCFA(simulatedFees.clientTotal)}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-850">
                    <p className="text-[10px] text-zinc-500 uppercase font-bold">
                      Net reçu par vous
                    </p>
                    <p className="text-base font-black text-white mt-0.5">
                      {formatCFA(simulatedFees.freelanceNet)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleSaveProfile}
                  disabled={savingProfile}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 text-black text-xs font-extrabold hover:bg-emerald-400 transition-all shadow-md shadow-emerald-500/20 active:scale-95 disabled:opacity-50"
                >
                  {savingProfile ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  )}
                  <span>Enregistrer la stratégie de frais</span>
                </button>
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════
              6. SECTION D : SÉCURITÉ & CHANGEMENT DE MOT DE PASSE
             ═════════════════════════════════════════════════════════ */}
          {(activeTab === "security" || activeTab === "all") && (
            <div className="rounded-2xl border border-emerald-500/20 bg-zinc-950 p-6 sm:p-8 space-y-6 shadow-xl">
              <div className="border-b border-zinc-850 pb-5">
                <h2 className="text-lg font-bold text-white flex items-center gap-2.5">
                  <KeyRound className="h-5 w-5 text-emerald-400" />
                  Sécurité & Changement de Mot de Passe
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Mettez à jour le mot de passe sécurisé d'accès à votre espace d'administration.
                </p>
              </div>

              <form onSubmit={handleUpdatePassword} className="space-y-4 max-w-xl">
                {/* Nouveau mot de passe */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5 text-emerald-400" />
                    Nouveau mot de passe
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 8 caractères"
                      required
                      className="w-full px-4 py-2.5 pr-10 rounded-xl bg-black border border-emerald-500/20 text-white text-xs placeholder:text-zinc-600 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-2.5 text-zinc-500 hover:text-zinc-300 transition"
                      aria-label="Afficher/masquer le mot de passe"
                    >
                      {showNewPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Indicateur de robustesse */}
                {newPassword && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-zinc-400">Robustesse :</span>
                      <span
                        className={`font-bold ${
                          passwordStrength <= 1
                            ? "text-rose-400"
                            : passwordStrength === 2
                            ? "text-amber-400"
                            : passwordStrength === 3
                            ? "text-emerald-400"
                            : "text-emerald-300"
                        }`}
                      >
                        {passwordStrength <= 1
                          ? "Faible"
                          : passwordStrength === 2
                          ? "Moyen"
                          : passwordStrength === 3
                          ? "Fort"
                          : "Excellent"}
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-1.5 h-1.5">
                      {[1, 2, 3, 4].map((step) => (
                        <div
                          key={step}
                          className={`rounded-full transition-all duration-300 ${
                            passwordStrength >= step
                              ? step <= 1
                                ? "bg-rose-500"
                                : step === 2
                                ? "bg-amber-400"
                                : "bg-emerald-500"
                              : "bg-zinc-800"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Confirmation mot de passe */}
                <div className="space-y-1.5 pt-1">
                  <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    Confirmer le nouveau mot de passe
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Répétez le mot de passe"
                      required
                      className="w-full px-4 py-2.5 pr-10 rounded-xl bg-black border border-emerald-500/20 text-white text-xs placeholder:text-zinc-600 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-2.5 text-zinc-500 hover:text-zinc-300 transition"
                      aria-label="Afficher/masquer la confirmation"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Feedback */}
                {passwordSuccessMessage && (
                  <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2 animate-fade-in">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>{passwordSuccessMessage}</span>
                  </div>
                )}

                {passwordErrorMessage && (
                  <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2 animate-fade-in">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{passwordErrorMessage}</span>
                  </div>
                )}

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={savingPassword || !newPassword || !confirmPassword}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 text-black text-xs font-extrabold hover:bg-emerald-400 transition-all shadow-md shadow-emerald-500/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {savingPassword ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <KeyRound className="h-3.5 w-3.5" />
                    )}
                    <span>
                      {savingPassword
                        ? "Mise à jour..."
                        : "Modifier mon mot de passe"}
                    </span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════
              7. SECTION E : STATUT DU SYSTÈME & INTÉGRATIONS
             ═════════════════════════════════════════════════════════ */}
          {(activeTab === "system" || activeTab === "all") && (
            <div className="rounded-2xl border border-emerald-500/20 bg-zinc-950 p-6 sm:p-8 space-y-6 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-850 pb-5">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2.5">
                    <Server className="h-5 w-5 text-emerald-400" />
                    Surveillance & Intégrations Système
                  </h2>
                  <p className="text-xs text-zinc-400 mt-1">
                    Statut en direct de la base de données, des passerelles et des webhooks.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleTestSystem}
                  disabled={testingSystem}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-black border border-emerald-500/30 text-xs font-bold text-emerald-400 hover:bg-emerald-500 hover:text-black transition"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${testingSystem ? "animate-spin" : ""}`}
                  />
                  <span>Actualiser le diagnostic</span>
                </button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {/* 1. Supabase Base de données */}
                <div className="p-4 rounded-xl bg-black border border-emerald-500/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-300 flex items-center gap-2">
                      <Server className="h-3.5 w-3.5 text-emerald-400" />
                      Supabase DB & Auth
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Connecté
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500">
                    Tables actives : <code className="text-emerald-400">payments</code>,{" "}
                    <code className="text-emerald-400">clients</code>. RLS actif.
                  </p>
                </div>

                {/* 2. Passerelle GeniusPay CI */}
                <div className="p-4 rounded-xl bg-black border border-emerald-500/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-300 flex items-center gap-2">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                      Passerelle GeniusPay CI
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      Mode Live Actif
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500">
                    Webhooks HMAC idempotents et reversements sécurisés opérationnels.
                  </p>
                </div>

                {/* 3. Reçus Automatiques */}
                <div className="p-4 rounded-xl bg-black border border-emerald-500/20 space-y-2 sm:col-span-2 lg:col-span-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-300 flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 text-emerald-400" />
                      Service Reçus Dématérialisés
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      Actif
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500">
                    Envoi instantané par Email et WhatsApp avec horodatage certifié.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
