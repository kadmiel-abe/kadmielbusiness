import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/settings
 * Récupère le profil administrateur et les réglages de la plateforme.
 */
export async function GET() {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.user) {
      return NextResponse.json(
        { error: "Session non authentifiée. Veuillez vous reconnecter." },
        { status: 401 }
      );
    }

    const user = session.user;
    const metadata = user.user_metadata || {};

    const profile = {
      id: user.id,
      email: user.email || "",
      full_name: metadata.full_name || metadata.name || "Kadmiel ABE",
      avatar_url: metadata.avatar_url || "",
      business_name: metadata.business_name || "Kadmiel Business Pay",
      phone: metadata.phone || "+225 07 00 00 00 00",
      location: metadata.location || "Abidjan, Côte d'Ivoire",
      default_fee_bearer: metadata.default_fee_bearer || "client",
      role: "Administrateur Principal",
      created_at: user.created_at || null,
      last_sign_in_at: user.last_sign_in_at || null,
    };

    return NextResponse.json({ success: true, profile });
  } catch (error) {
    console.error("[API Settings GET] Erreur :", error);
    return NextResponse.json(
      { error: "Impossible de récupérer les réglages.", details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/settings
 * Met à jour le profil administrateur et les métadonnées de l'entreprise.
 */
export async function POST(request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.user) {
      return NextResponse.json(
        { error: "Session expirée ou non authentifiée." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      full_name,
      avatar_url,
      business_name,
      phone,
      location,
      default_fee_bearer,
    } = body || {};

    const user = session.user;
    const currentMetadata = user.user_metadata || {};

    const updatedMetadata = {
      ...currentMetadata,
      ...(full_name !== undefined && { full_name: full_name.trim() }),
      ...(avatar_url !== undefined && { avatar_url }),
      ...(business_name !== undefined && { business_name: business_name.trim() }),
      ...(phone !== undefined && { phone: phone.trim() }),
      ...(location !== undefined && { location: location.trim() }),
      ...(default_fee_bearer !== undefined && {
        default_fee_bearer:
          default_fee_bearer === "freelance" ? "freelance" : "client",
      }),
      updated_at: new Date().toISOString(),
    };

    // Mise à jour sécurisée via Supabase Admin (Service Role)
    const { data: updatedUserData, error: updateError } =
      await supabaseAdmin.auth.admin.updateUserById(user.id, {
        user_metadata: updatedMetadata,
      });

    if (updateError) {
      console.error("[API Settings POST] Erreur mise à jour :", updateError);
      return NextResponse.json(
        {
          error: "Échec de la mise à jour des informations.",
          details: updateError.message,
        },
        { status: 500 }
      );
    }

    const resUser = updatedUserData.user;
    const finalMetadata = resUser.user_metadata || {};

    return NextResponse.json({
      success: true,
      message: "Profil et réglages enregistrés avec succès.",
      profile: {
        id: resUser.id,
        email: resUser.email,
        full_name: finalMetadata.full_name || "Kadmiel ABE",
        avatar_url: finalMetadata.avatar_url || "",
        business_name: finalMetadata.business_name || "Kadmiel Business Pay",
        phone: finalMetadata.phone || "+225 07 00 00 00 00",
        location: finalMetadata.location || "Abidjan, Côte d'Ivoire",
        default_fee_bearer: finalMetadata.default_fee_bearer || "client",
      },
    });
  } catch (error) {
    console.error("[API Settings POST] Exception :", error);
    return NextResponse.json(
      { error: "Erreur serveur inattendue.", details: error.message },
      { status: 500 }
    );
  }
}
