import DashboardHeader from "@/components/DashboardHeader";

export const metadata = {
  title: "Dashboard — Kadmiel Business Pay",
  description: "Portail d'administration et de gestion des paiements privés",
};

export default function DashboardLayout({ children }) {
  return (
    <div className="bg-gray-50 min-h-screen flex flex-col">
      <DashboardHeader />
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
        {children}
      </main>
    </div>
  );
}
