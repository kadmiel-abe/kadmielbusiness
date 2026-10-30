import DashboardLayoutShell from "@/components/DashboardLayoutShell";

export const metadata = {
  title: "Répertoire Clients & CRM | Kadmiel Business Pay",
  description: "Gestion complète du portefeuille clients, statistiques financières et historique des factures.",
};

export default function ClientsLayout({ children }) {
  return <DashboardLayoutShell>{children}</DashboardLayoutShell>;
}
