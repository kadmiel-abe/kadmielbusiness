import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/settings/avatar
 * Téléverse et enregistre directement la photo de profil administrateur dans Supabase Storage.
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
        { error: "Session expirée. Veuillez vous reconnecter." },
        { status: 401 }
      );
    }

    const user = session.user;
    const contentType = request.headers.get("content-type") || "";

    let finalPublicUrl = "";

    // S'assurer que le bucket 'avatars' existe
    try {
      const { data: buckets } = await supabaseAdmin.storage.listBuckets();
      const exists = (buckets || []).some((b) => b.name === "avatars");
      if (!exists) {
        await supabaseAdmin.storage.createBucket("avatars", {
          public: true,
          fileSizeLimit: 10485760, // 10MB
          allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "image/gif"],
        });
      }
    } catch (bErr) {
      console.warn("[Avatar Storage] Vérification bucket :", bErr);
    }

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") || formData.get("avatar");

      if (!file || typeof file === "string") {
        return NextResponse.json(
          { error: "Aucun fichier image trouvé dans la requête." },
          { status: 400 }
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const extension = file.type?.split("/")?.[1] || "webp";
      const fileName = `${user.id}-${Date.now()}.${extension}`;

      const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
        .from("avatars")
        .upload(fileName, buffer, {
          contentType: file.type || "image/webp",
          upsert: true,
        });

      if (uploadError) {
        console.error("[Avatar Upload Error] :", uploadError);
        return NextResponse.json(
          { error: "Échec du téléversement vers Supabase Storage.", details: uploadError.message },
          { status: 500 }
        );
      }

      const { data: publicUrlData } = supabaseAdmin.storage
        .from("avatars")
        .getPublicUrl(uploadData.path);

      finalPublicUrl = publicUrlData?.publicUrl;
    } else {
      // JSON body (ex: URL prédéfinie ou Base64)
      const body = await request.json();
      const { avatar_url, base64 } = body || {};

      if (base64) {
        const matches = base64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const mime = matches[1];
          const ext = mime.split("/")[1] || "webp";
          const buffer = Buffer.from(matches[2], "base64");
          const fileName = `${user.id}-${Date.now()}.${ext}`;

          const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
            .from("avatars")
            .upload(fileName, buffer, {
              contentType: mime,
              upsert: true,
            });

          if (!uploadError && uploadData) {
            const { data: publicUrlData } = supabaseAdmin.storage
              .from("avatars")
              .getPublicUrl(uploadData.path);
            finalPublicUrl = publicUrlData?.publicUrl;
          }
        }
      }

      if (!finalPublicUrl && avatar_url) {
        finalPublicUrl = avatar_url;
      }
    }

    if (!finalPublicUrl) {
      return NextResponse.json(
        { error: "Impossible de déterminer l'URL de la photo de profil." },
        { status: 400 }
      );
    }

    // Mise à jour immédiate des métadonnées utilisateur
    const currentMeta = user.user_metadata || {};
    const { error: metaError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      {
        user_metadata: {
          ...currentMeta,
          avatar_url: finalPublicUrl,
          updated_at: new Date().toISOString(),
        },
      }
    );

    if (metaError) {
      console.error("[Avatar Meta Error] :", metaError);
      return NextResponse.json(
        { error: "Photo téléversée mais échec de liaison au profil.", details: metaError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Photo de profil mise à jour et enregistrée avec succès !",
      avatar_url: finalPublicUrl,
    });
  } catch (error) {
    console.error("[API Settings Avatar POST] Exception :", error);
    return NextResponse.json(
      { error: "Erreur lors du traitement de l'image.", details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/settings/avatar
 * Retire la photo de profil et rétablit les initiales de l'administrateur.
 */
export async function DELETE() {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.user) {
      return NextResponse.json(
        { error: "Session non authentifiée." },
        { status: 401 }
      );
    }

    const user = session.user;
    const currentMeta = user.user_metadata || {};

    const { error: metaError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      {
        user_metadata: {
          ...currentMeta,
          avatar_url: "",
          updated_at: new Date().toISOString(),
        },
      }
    );

    if (metaError) {
      return NextResponse.json(
        { error: "Échec de la suppression de la photo.", details: metaError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Photo de profil retirée.",
      avatar_url: "",
    });
  } catch (error) {
    console.error("[API Settings Avatar DELETE] :", error);
    return NextResponse.json(
      { error: "Erreur serveur.", details: error.message },
      { status: 500 }
    );
  }
}
