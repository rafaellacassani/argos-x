import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function replaceShortcodes(template: string, lead: Record<string, unknown>): string {
  return template
    .replace(/#nome#/gi, (lead.name as string) || "")
    .replace(/#empresa#/gi, (lead.company as string) || "")
    .replace(/#telefone#/gi, (lead.phone as string) || "")
    .replace(/#email#/gi, (lead.email as string) || "");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Auth check
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const token = authHeader.replace("Bearer ", "");
    let isInternal = false;

    if (token === supabaseServiceKey) {
      isInternal = true;
    } else {
      const authClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error } = await authClient.auth.getUser();
      if (error || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const { campaignId } = await req.json();
    if (!campaignId) {
      return new Response(JSON.stringify({ error: "campaignId is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch campaign
    const { data: campaign, error: campError } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", campaignId)
      .single();

    if (campError || !campaign) {
      return new Response(JSON.stringify({ error: "Campaign not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (campaign.status !== "draft") {
      return new Response(JSON.stringify({ error: "Campaign must be in draft status" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Build lead query with filters
    const filterTagIds: string[] = campaign.filter_tag_ids || [];
    const filterStageIds: string[] = campaign.filter_stage_ids || [];
    const filterResponsibleIds: string[] = campaign.filter_responsible_ids || [];

    let query = supabase
      .from("leads")
      .select("id, name, phone, email, company")
      .eq("workspace_id", campaign.workspace_id)
      .eq("status", "active");

    // Stage filter
    if (filterStageIds.length > 0) {
      query = query.in("stage_id", filterStageIds);
    }

    // Responsible filter
    if (filterResponsibleIds.length > 0) {
      query = query.in("responsible_user", filterResponsibleIds);
    }

    const { data: leads, error: leadsError } = await query;
    if (leadsError) throw leadsError;

    let filteredLeads = leads || [];

    // Tag filter: leads with ANY of the selected tags
    if (filterTagIds.length > 0) {
      const { data: tagAssignments } = await supabase
        .from("lead_tag_assignments")
        .select("lead_id")
        .eq("workspace_id", campaign.workspace_id)
        .in("tag_id", filterTagIds);

      const leadIdsWithTags = new Set((tagAssignments || []).map(t => t.lead_id));
      filteredLeads = filteredLeads.filter(l => leadIdsWithTags.has(l.id));
    }

    // Filter valid phones and deduplicate
    const validLeads = filteredLeads.filter(l => {
      const clean = (l.phone || "").replace(/\D/g, "");
      return clean.length >= 10;
    });

    const skipped = filteredLeads.length - validLeads.length;

    // Delete existing recipients (in case of re-prepare)
    await supabase.from("campaign_recipients").delete().eq("campaign_id", campaignId);

    // Insert recipients
    if (validLeads.length > 0) {
      const recipients = validLeads.map((lead, index) => ({
        campaign_id: campaignId,
        lead_id: lead.id,
        phone: (lead.phone || "").replace(/\D/g, ""),
        personalized_message: replaceShortcodes(campaign.message_text, lead),
        status: "pending",
        position: index,
      }));

      // Insert in batches of 500
      for (let i = 0; i < recipients.length; i += 500) {
        const batch = recipients.slice(i, i + 500);
        const { error: insertErr } = await supabase.from("campaign_recipients").insert(batch);
        if (insertErr) {
          console.error("[prepare-campaign] ❌ Insert error:", insertErr);
          throw insertErr;
        }
      }
    }

    // Update campaign
    const newStatus = campaign.scheduled_at ? "scheduled" : "running";
    await supabase.from("campaigns").update({
      total_recipients: validLeads.length,
      sent_count: 0,
      failed_count: 0,
      status: newStatus,
      updated_at: new Date().toISOString(),
    }).eq("id", campaignId);

    console.log(`[prepare-campaign] ✅ Campaign ${campaignId}: ${validLeads.length} recipients, ${skipped} skipped, status=${newStatus}`);

    return new Response(JSON.stringify({
      total_recipients: validLeads.length,
      skipped,
      status: newStatus,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("[prepare-campaign] ❌ Error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
