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

    const { campaignId, retryFailed, newInstanceName } = await req.json();
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

    // --- RETRY FAILED MODE ---
    if (retryFailed) {
      if (!["completed", "paused", "canceled"].includes(campaign.status)) {
        return new Response(JSON.stringify({ error: "Campaign must be completed, paused or canceled to retry" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: failedRecipients, error: failedErr } = await supabase
        .from("campaign_recipients")
        .select("id")
        .eq("campaign_id", campaignId)
        .eq("status", "failed");

      if (failedErr) throw failedErr;

      const failedCount = failedRecipients?.length || 0;
      if (failedCount === 0) {
        return new Response(JSON.stringify({ error: "No failed recipients to retry" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      await supabase
        .from("campaign_recipients")
        .update({ status: "pending", error_message: null, sent_at: null })
        .eq("campaign_id", campaignId)
        .eq("status", "failed");

      const updateData: Record<string, unknown> = {
        status: "running",
        failed_count: 0,
        last_sent_at: null,
        updated_at: new Date().toISOString(),
      };

      if (newInstanceName) {
        updateData.instance_name = newInstanceName;
      }

      await supabase.from("campaigns").update(updateData).eq("id", campaignId);

      console.log(`[prepare-campaign] 🔄 Retry: Campaign ${campaignId}: ${failedCount} failed recipients reset to pending${newInstanceName ? `, instance changed to ${newInstanceName}` : ""}`);

      return new Response(JSON.stringify({
        retried: failedCount,
        instance_name: newInstanceName || campaign.instance_name,
        status: "running",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // --- NORMAL PREPARE MODE ---
    if (campaign.status !== "draft") {
      return new Response(JSON.stringify({ error: "Campaign must be in draft status" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const pageSize = 1000;

    // Build lead query with filters
    const filterTagIds: string[] = campaign.filter_tag_ids || [];
    const filterStageIds: string[] = campaign.filter_stage_ids || [];
    const filterResponsibleIds: string[] = campaign.filter_responsible_ids || [];

    // Fetch ALL leads with pagination
    let allLeads: any[] = [];
    let from = 0;
    while (true) {
      let query = supabase
        .from("leads")
        .select("id, name, phone, email, company")
        .eq("workspace_id", campaign.workspace_id)
        .eq("status", "active")
        .range(from, from + pageSize - 1);

      if (filterStageIds.length > 0) query = query.in("stage_id", filterStageIds);
      if (filterResponsibleIds.length > 0) query = query.in("responsible_user", filterResponsibleIds);

      const { data: page, error: pageError } = await query;
      if (pageError) throw pageError;
      if (!page || page.length === 0) break;
      allLeads = allLeads.concat(page);
      if (page.length < pageSize) break;
      from += pageSize;
    }

    let filteredLeads = allLeads;

    // Tag filter
    if (filterTagIds.length > 0) {
      let allTagAssignments: any[] = [];
      let tagFrom = 0;
      while (true) {
        const { data: tagPage } = await supabase
          .from("lead_tag_assignments")
          .select("lead_id")
          .eq("workspace_id", campaign.workspace_id)
          .in("tag_id", filterTagIds)
          .range(tagFrom, tagFrom + pageSize - 1);
        if (!tagPage || tagPage.length === 0) break;
        allTagAssignments = allTagAssignments.concat(tagPage);
        if (tagPage.length < pageSize) break;
        tagFrom += pageSize;
      }

      const leadIdsWithTags = new Set(allTagAssignments.map(t => t.lead_id));
      filteredLeads = filteredLeads.filter(l => leadIdsWithTags.has(l.id));
    }

    // Filter valid phones and collect lead recipients
    const validLeads = filteredLeads.filter(l => {
      const clean = (l.phone || "").replace(/\D/g, "");
      return clean.length >= 10;
    });

    const leadPhones = new Set(validLeads.map(l => (l.phone || "").replace(/\D/g, "")));

    // --- Include all WhatsApp contacts (non-leads) ---
    let contactRecipients: { phone: string; name: string }[] = [];
    if (campaign.include_all_contacts) {
      let contactFrom = 0;
      const uniqueContacts = new Map<string, string>(); // phone -> push_name

      while (true) {
        const { data: msgPage, error: msgErr } = await supabase
          .from("whatsapp_messages")
          .select("remote_jid, push_name")
          .eq("workspace_id", campaign.workspace_id)
          .eq("from_me", false)
          .order("remote_jid")
          .range(contactFrom, contactFrom + pageSize - 1);

        if (msgErr) throw msgErr;
        if (!msgPage || msgPage.length === 0) break;

        for (const msg of msgPage) {
          if (!msg.remote_jid || !msg.remote_jid.endsWith("@s.whatsapp.net")) continue;
          const phone = msg.remote_jid.replace("@s.whatsapp.net", "");
          if (phone.length < 10) continue;
          if (leadPhones.has(phone)) continue; // already a lead
          if (!uniqueContacts.has(phone)) {
            uniqueContacts.set(phone, msg.push_name || "");
          }
        }

        if (msgPage.length < pageSize) break;
        contactFrom += pageSize;
      }

      contactRecipients = Array.from(uniqueContacts.entries()).map(([phone, name]) => ({ phone, name }));
      console.log(`[prepare-campaign] 📱 Found ${contactRecipients.length} non-lead contacts`);
    }

    const skipped = filteredLeads.length - validLeads.length;

    // Delete existing recipients (in case of re-prepare)
    await supabase.from("campaign_recipients").delete().eq("campaign_id", campaignId);

    // Build all recipients
    const allRecipients: any[] = [];

    // Lead recipients
    for (let i = 0; i < validLeads.length; i++) {
      const lead = validLeads[i];
      allRecipients.push({
        campaign_id: campaignId,
        lead_id: lead.id,
        phone: (lead.phone || "").replace(/\D/g, ""),
        personalized_message: replaceShortcodes(campaign.message_text, lead),
        status: "pending",
        position: i,
      });
    }

    // Non-lead contact recipients
    for (let i = 0; i < contactRecipients.length; i++) {
      const contact = contactRecipients[i];
      allRecipients.push({
        campaign_id: campaignId,
        lead_id: null,
        phone: contact.phone,
        personalized_message: campaign.message_text.replace(/#nome#/gi, contact.name || "").replace(/#empresa#/gi, "").replace(/#telefone#/gi, contact.phone).replace(/#email#/gi, ""),
        status: "pending",
        position: validLeads.length + i,
      });
    }

    // Insert in batches of 500
    if (allRecipients.length > 0) {
      for (let i = 0; i < allRecipients.length; i += 500) {
        const batch = allRecipients.slice(i, i + 500);
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
      total_recipients: allRecipients.length,
      sent_count: 0,
      failed_count: 0,
      status: newStatus,
      updated_at: new Date().toISOString(),
    }).eq("id", campaignId);

    console.log(`[prepare-campaign] ✅ Campaign ${campaignId}: ${allRecipients.length} recipients (${validLeads.length} leads + ${contactRecipients.length} contacts), ${skipped} skipped, status=${newStatus}`);

    return new Response(JSON.stringify({
      total_recipients: allRecipients.length,
      skipped,
      status: newStatus,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("[prepare-campaign] ❌ Error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
