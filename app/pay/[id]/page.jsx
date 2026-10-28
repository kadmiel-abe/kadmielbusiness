"use client";

import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { LoaderCircle, CheckCircle2, ShieldCheck, CreditCard, ArrowRight } from "lucide-react";

export default function PagePaiementClient({ params }) {
  const supabase = createClientComponentClient();
  const [transaction, setTransaction] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    const fetchTransaction = async () => {
      try {
        const { data, error } = await supabase
          .from("paiements")
          .select("*, clients(nom, telephone)")
          .eq("id", params.id)
          .single();

        if (error) throw error;
        if (!data) throw new Error("Facture introuvable");

        setTransaction(data);
      } catch (err) {
        console.error("Erreur:", err);
        setErreur("Ce lien de paiement est invalide ou n'existe plus.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchTransaction();
  }, [params.id, supabase]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-lime-400">
        <LoaderCircle className="w-10 h-10 animate-spin mb-4" />
        <p className="text-zinc-400">Chargement de votre facture sécurisée...</p>
      </div>
    );
  }

  if (erreur || !transaction) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="bg-zinc-900 border border-red-500/20 p-6 rounded-2xl max-w-md w-full text-center">
          <p className="text-red-400 font-medium">{erreur}</p>
        </div>
      </div>
    );
  }

  // Gérer l'objet client retourné par Supabase
  const client = Array.isArray(transaction.clients) ? transaction.clients[0] : transaction.clients;
  const isPaye = transaction.statut === "paye";

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4 font-sans text-zinc-200">
      <div className="max-w-md w-full">
        {/* En-tête */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-lime-400/10 text-lime-400 mb-4">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-white">Facture Sécurisée</h1>
          <p className="text-sm text-zinc-500 mt-1">Kadmiel Business</p>
        </div>

        {/* Carte de reçu */}
        <div className="bg-zinc-900 border border-white/5 rounded-3xl overflow-hidden shadow-2xl">

          {/* Infos Client & Service */}
          <div className="p-6 border-b border-white/5">
            <p className="text-sm text-zinc-400 mb-1">Facturé à</p>
            <p className="text-lg font-medium text-white">{client?.nom}</p>

            <div className="mt-6">
              <p className="text-sm text-zinc-400 mb-1">Prestation</p>
              <p className="text-base text-zinc-200">{transaction.service}</p>
            </div>
          </div>

          {/* Décomposition des montants */}
          <div className="p-6 bg-black/20 space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Montant de la prestation</span>
              <span className="text-white">{transaction.montant_net.toLocaleString('fr-FR')} FCFA</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Frais de transaction</span>
              <span className="text-white">{(transaction.montant_total - transaction.montant_net).toLocaleString('fr-FR')} FCFA</span>
            </div>

            <div className="pt-4 border-t border-white/5 flex justify-between items-center">
              <span className="text-base font-medium text-white">Total à payer</span>
              <span className="text-2xl font-bold text-lime-400">
                {transaction.montant_total.toLocaleString('fr-FR')} FCFA
              </span>
            </div>
          </div>

          {/* Bouton d'action */}
          <div className="p-6">
            {isPaye ? (
              <div className="w-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 py-3 rounded-xl flex items-center justify-center gap-2 font-medium">
                <CheckCircle2 className="w-5 h-5" />
                Paiement validé
              </div>
            ) : (
              <a
                href={transaction.geniuspay_url}
                className="w-full bg-lime-400 hover:bg-lime-500 text-black py-4 rounded-xl flex items-center justify-center gap-2 font-bold text-lg transition-colors"
              >
                <CreditCard className="w-5 h-5" />
                Procéder au paiement
                <ArrowRight className="w-5 h-5 ml-1" />
              </a>
            )}
            <p className="text-center text-xs text-zinc-500 mt-4 flex items-center justify-center gap-1">
              Paiement sécurisé par GeniusPay
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
