import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAdminSupabase } from "@/lib/supabase-admin";

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const readBearerToken = (request: NextRequest): string | null => {
  const header = request.headers.get("authorization") || "";
  if (!header.toLowerCase().startsWith("bearer ")) return null;
  const token = header.slice(7).trim();
  return token || null;
};

export async function GET(request: NextRequest) {
  try {
    const token = readBearerToken(request);
    if (!token || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return NextResponse.json({ formId: null, option: null, playlistTitle: null }, { status: 200 });
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ formId: null, option: null, playlistTitle: null }, { status: 200 });
    }

    const admin = getAdminSupabase();
    const { searchParams } = new URL(request.url);
    let formId = searchParams.get("formId");

    if (!formId) {
      const { data: form, error: formError } = await admin
        .from("admin_forms")
        .select("id")
        .eq("form_type", "onboarding")
        .eq("onboard_step", 2)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (formError) {
        return NextResponse.json({ formId: null, option: null, playlistTitle: null }, { status: 200 });
      }
      formId = form?.id ?? null;
    }

    let option: string | null = null;
    let playlistTitle: string | null = null;
    if (formId) {
      const { data: resp, error: respError } = await admin
        .from("admin_form_responses")
        .select("answers, created_at")
        .eq("user_id", user.id)
        .eq("form_id", formId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!respError && resp?.answers && typeof (resp as any).answers === "object") {
        const ans: any = (resp as any).answers;
        if (typeof ans.option === "string") {
          option = ans.option;
        }
        if (typeof ans.playlist_title === "string") {
          playlistTitle = ans.playlist_title;
        } else if (typeof ans.playlistTitle === "string") {
          playlistTitle = ans.playlistTitle;
        }
      }
    }

    if (option && !playlistTitle) {
      const { data: playlistRow, error: playlistError } = await admin
        .from("playlists")
        .select("title")
        .eq("id", option)
        .maybeSingle();
      if (!playlistError && playlistRow?.title) {
        playlistTitle = String(playlistRow.title);
      }
    }

    return NextResponse.json({ formId, option, playlistTitle }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ formId: null, option: null, playlistTitle: null }, { status: 200 });
  }
}
