import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get("slug");
    if (!slug) {
      return new Response(JSON.stringify({ error: "Missing slug parameter" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data, error } = await supabase
      .from("generated_apps")
      .select("html_content, title")
      .eq("slug", slug)
      .eq("is_published", true)
      .single();

    if (error || !data) {
      return new Response(
        `<!DOCTYPE html><html><head><title>Not Found</title></head><body style="background:#111;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif"><h1>App not found or not published</h1></body></html>`,
        { status: 404, headers: { ...corsHeaders, "Content-Type": "text/html" } }
      );
    }

    return new Response(data.html_content, {
      headers: { ...corsHeaders, "Content-Type": "text/html" },
    });
  } catch (e) {
    console.error("serve-app error:", e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
