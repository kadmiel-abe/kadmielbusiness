import DashboardLayoutShell from "@/components/DashboardLayoutShell";

export const metadata = {
  title: "Réglages & Configuration du Compte | Kadmiel Business Pay",
  description:
    "Gérez votre profil administrateur, sécurité, mot de passe, coordonnées professionnelles et configuration des frais sur Kadmiel Business Pay.",
};

export default function SettingsLayout({ children }) {
  return <DashboardLayoutShell>{children}</DashboardLayoutShell>;
}
