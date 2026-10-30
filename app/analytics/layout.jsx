import DashboardLayoutShell from "@/components/DashboardLayoutShell";

export const metadata = {
  title: "Statistiques & Pilotage Financier | Kadmiel Business Pay",
  description: "Tableau de bord financier avancé : délai moyen de règlement, comparaison MoM, répartition Wave/Orange/MTN/Moov et tops rentabilité.",
};

export default function AnalyticsLayout({ children }) {
  return <DashboardLayoutShell>{children}</DashboardLayoutShell>;
}
