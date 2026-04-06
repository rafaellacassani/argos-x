import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { agent_id } = await req.json();
    if (!agent_id) {
      return new Response(JSON.stringify({ error: "agent_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get agent
    const { data: agent, error: agentErr } = await adminClient
      .from("ai_agents")
      .select("id, workspace_id, website_url, website_scraped_at")
      .eq("id", agent_id)
      .single();

    if (agentErr || !agent) {
      return new Response(JSON.stringify({ error: "Agent not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!agent.website_url) {
      return new Response(JSON.stringify({ error: "No website_url configured" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check plan is Escala
    const { data: workspace } = await adminClient
      .from("workspaces")
      .select("plan_name")
      .eq("id", agent.workspace_id)
      .single();

    if (!workspace || workspace.plan_name?.toLowerCase() !== "escala") {
      return new Response(JSON.stringify({ error: "Feature available only on Escala plan" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check cooldown (6 hours)
    if (agent.website_scraped_at) {
      const lastScrape = new Date(agent.website_scraped_at).getTime();
      const sixHours = 6 * 60 * 60 * 1000;
      if (Date.now() - lastScrape < sixHours) {
        return new Response(JSON.stringify({ 
          error: "Cooldown active. Try again later.",
          next_available_at: new Date(lastScrape + sixHours).toISOString(),
        }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Call Firecrawl
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!firecrawlKey) {
      console.error("FIRECRAWL_API_KEY not configured");
      return new Response(JSON.stringify({ error: "Scraping service not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let formattedUrl = agent.website_url.trim();
    if (!formattedUrl.startsWith("http://") && !formattedUrl.startsWith("https://")) {
      formattedUrl = `https://${formattedUrl}`;
    }

    console.log("[scrape-agent-website] Scraping:", formattedUrl);

    const scrapeRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${firecrawlKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: formattedUrl,
        formats: ["markdown"],
        onlyMainContent: true,
      }),
    });

    const scrapeData = await scrapeRes.json();

    if (!scrapeRes.ok) {
      console.error("[scrape-agent-website] Firecrawl error:", scrapeData);
      return new Response(JSON.stringify({ error: scrapeData.error || "Scrape failed" }), {
        status: scrapeRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract markdown and truncate to ~8000 chars
    const rawMarkdown = scrapeData?.data?.markdown || scrapeData?.markdown || "";
    const MAX_CHARS = 8000;
    const content = rawMarkdown.length > MAX_CHARS
      ? rawMarkdown.substring(0, MAX_CHARS) + "\n\n[... conteúdo truncado ...]"
      : rawMarkdown;

    // Save to agent
    const { error: updateErr } = await adminClient
      .from("ai_agents")
      .update({
        website_content: content,
        website_scraped_at: new Date().toISOString(),
      })
      .eq("id", agent_id);

    if (updateErr) {
      console.error("[scrape-agent-website] Update error:", updateErr);
      return new Response(JSON.stringify({ error: "Failed to save content" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[scrape-agent-website] Success. ${content.length} chars saved.`);

    return new Response(JSON.stringify({
      success: true,
      chars_saved: content.length,
      preview: content.substring(0, 200),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[scrape-agent-website] Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
