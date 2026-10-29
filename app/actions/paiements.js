"use server";

import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function creerLienPaiement(formData) {
    const nom = formData.get("nom");
    const telephone = formData.get("telephone");
    const email = formData.get("email") || null;
    const service = formData.get("service");
    const montantNet = Number(formData.get("montant_net"));

    // 1. Calcul des frais : 1% + 100 XOF supportés par le client
    const montantTotal = Math.ceil((montantNet + 100) / (1 - 0.01));

    const cookieStore = cookies();
    const supabase = createServerComponentClient({ cookies: () => cookieStore });

    try {
        // 2. Appel de l'API GeniusPay (selon la documentation officielle de checkout)
        const geniusPayRes = await fetch("https://geniuspay.ci/api/v1/merchant/payments", {
            method: "POST",
            headers: {
                "X-API-Key": process.env.GENIUSPAY_API_KEY,
                "X-API-Secret": process.env.GENIUSPAY_API_SECRET,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                amount: montantTotal,
                description: service,
                customer: {
                    name: nom,
                    phone: telephone,
                    email: email,
                },
            }),
        });

        const geniusData = await geniusPayRes.json();

        if (!geniusData.success) {
            throw new Error(geniusData.error?.message || "Erreur lors de l'initialisation GeniusPay");
        }

        // Récupération de l'URL de checkout et de la référence unique (ex: MTX-...)
        const checkoutUrl = geniusData.data.checkout_url || geniusData.data.payment_url;
        const paymentReference = geniusData.data.reference;

        // 3. Gestion du client dans Supabase
        let clientId;
        const { data: existingClient } = await supabase
            .from("clients")
            .select("id")
            .eq("telephone", telephone)
            .single();

        if (existingClient) {
            clientId = existingClient.id;
        } else {
            const { data: newClient, error: clientError } = await supabase
                .from("clients")
                .insert([{ nom, telephone, email }])
                .select("id")
                .single();

            if (clientError) throw clientError;
            clientId = newClient.id;
        }

        // 4. Enregistrement du paiement avec la vraie URL GeniusPay
        const { error: paymentError } = await supabase.from("paiements").insert([
            {
                client_id: clientId,
                service,
                montant_net: montantNet,
                montant_total: montantTotal,
                statut: "en_attente",
                geniuspay_url: checkoutUrl,
                geniuspay_id: paymentReference,
            },
        ]);

        if (paymentError) throw paymentError;

    } catch (err) {
        console.error("Erreur backend création paiement:", err);
        throw new Error(err.message);
    }

    redirect("/dashboard");
}