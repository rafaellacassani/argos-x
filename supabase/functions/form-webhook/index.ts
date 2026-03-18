import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return new Response(JSON.stringify({ error: "Token is required" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // Validate token and get workspace
    const { data: workspace, error: wsError } = await supabase
      .from("workspaces")
      .select("id, form_field_mapping, form_default_stage_id")
      .eq("form_webhook_token", token)
      .single();

    if (wsError || !workspace) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const workspaceId = workspace.id;
    const fieldMapping = (workspace.form_field_mapping || {}) as Record<string, string>;

    // Parse body
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate required fields
    if (!body.name && !body.nome) {
      return new Response(JSON.stringify({ error: "name is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!body.phone && !body.telefone && !body.whatsapp) {
      return new Response(JSON.stringify({ error: "phone is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Native field extraction (with PT aliases)
    const nativeFields: Record<string, string | number | null> = {
      name: String(body.name || body.nome || ""),
      phone: String(body.phone || body.telefone || body.whatsapp || ""),
      email: body.email ? String(body.email) : null,
      company: String(body.company || body.empresa || body.company_name || ""),
      source: String(body.source || body.origem || "form-webhook"),
      value: body.value !== undefined ? Number(body.value) : (body.valor !== undefined ? Number(body.valor) : 0),
    };

    // Apply custom mappings: map form fields to native/custom fields
    const customValues: Record<string, string> = {};
    const nativeKeys = new Set(["name", "phone", "email", "company", "source", "value", "nome", "telefone", "whatsapp", "empresa", "company_name", "origem", "valor"]);

    // Process explicit mappings first
    for (const [formField, crmField] of Object.entries(fieldMapping)) {
      if (body[formField] !== undefined) {
        if (crmField.startsWith("custom:")) {
          const customKey = crmField.replace("custom:", "");
          customValues[customKey] = String(body[formField]);
        } else if (["name", "phone", "email", "company", "source", "value"].includes(crmField)) {
          nativeFields[crmField] = crmField === "value" ? Number(body[formField]) : String(body[formField]);
        }
      }
    }

    // Collect remaining non-native fields as potential custom values
    for (const [key, val] of Object.entries(body)) {
      if (!nativeKeys.has(key) && !fieldMapping[key] && val !== undefined && val !== null) {
        customValues[key] = String(val);
      }
    }

    // Get default stage
    let stageId = workspace.form_default_stage_id;
    if (!stageId) {
      // Get first stage of default funnel
      const { data: defaultFunnel } = await supabase
        .from("funnels")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("is_default", true)
        .single();

      if (defaultFunnel) {
        const { data: firstStage } = await supabase
          .from("funnel_stages")
          .select("id")
          .eq("funnel_id", defaultFunnel.id)
          .order("position", { ascending: true })
          .limit(1)
          .single();
        stageId = firstStage?.id;
      }

      if (!stageId) {
        // Fallback: any first stage in workspace
        const { data: anyStage } = await supabase
          .from("funnel_stages")
          .select("id")
          .eq("workspace_id", workspaceId)
          .order("position", { ascending: true })
          .limit(1)
          .single();
        stageId = anyStage?.id;
      }
    }

    if (!stageId) {
      return new Response(JSON.stringify({ error: "No funnel stage configured" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Normalize Brazilian phone: add country code 55 if missing
    let phone = String(nativeFields.phone).replace(/[^0-9]/g, "");
    if ((phone.length === 10 || phone.length === 11) && !phone.startsWith("55")) {
      phone = "55" + phone;
    }
    const { data: existingLead } = await supabase
      .from("leads")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("phone", phone)
      .limit(1)
      .maybeSingle();

    let leadId: string;
    let status: "created" | "updated";

    if (existingLead) {
      // Update existing lead
      const updates: Record<string, unknown> = {};
      if (nativeFields.email) updates.email = nativeFields.email;
      if (nativeFields.company) updates.company = nativeFields.company;
      if (nativeFields.name) updates.name = nativeFields.name;

      if (Object.keys(updates).length > 0) {
        await supabase.from("leads").update(updates).eq("id", existingLead.id);
      }
      leadId = existingLead.id;
      status = "updated";
    } else {
      // Create new lead
      const { data: newLead, error: insertError } = await supabase
        .from("leads")
        .insert({
          name: String(nativeFields.name),
          phone,
          email: nativeFields.email ? String(nativeFields.email) : null,
          company: nativeFields.company ? String(nativeFields.company) : null,
          source: String(nativeFields.source),
          value: Number(nativeFields.value) || 0,
          stage_id: stageId,
          workspace_id: workspaceId,
        })
        .select("id")
        .single();

      if (insertError) {
        console.error("Error creating lead:", insertError);
        return new Response(JSON.stringify({ error: "Failed to create lead" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      leadId = newLead.id;
      status = "created";
    }

    // Save custom field values
    if (Object.keys(customValues).length > 0) {
      // Fetch matching field definitions
      const customKeys = Object.keys(customValues);
      const { data: fieldDefs } = await supabase
        .from("lead_custom_field_definitions")
        .select("id, field_key")
        .eq("workspace_id", workspaceId)
        .eq("is_active", true)
        .in("field_key", customKeys);

      if (fieldDefs && fieldDefs.length > 0) {
        const rows = fieldDefs.map((def) => ({
          lead_id: leadId,
          field_definition_id: def.id,
          workspace_id: workspaceId,
          value: customValues[def.field_key] || "",
          updated_at: new Date().toISOString(),
        }));

        await supabase
          .from("lead_custom_field_values")
          .upsert(rows, { onConflict: "lead_id,field_definition_id" });
      }
    }

    // Fire webhook event for lead.created (if applicable)
    if (status === "created") {
      try {
        const { data: webhooks } = await supabase
          .from("webhooks")
          .select("id, url, secret_hash, is_active, events")
          .eq("workspace_id", workspaceId)
          .eq("is_active", true);

        if (webhooks?.length) {
          const { data: fullLead } = await supabase
            .from("leads")
            .select("*")
            .eq("id", leadId)
            .single();

          for (const wh of webhooks) {
            const events = wh.events as string[];
            if (!events.includes("lead.created")) continue;

            const payload = {
              event: "lead.created",
              workspace_id: workspaceId,
              timestamp: new Date().toISOString(),
              data: fullLead,
            };

            // Fire and forget
            fetch(wh.url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            }).catch(() => {});
          }
        }
      } catch {
        // Silent fail for webhook
      }
    }

    return new Response(JSON.stringify({ lead_id: leadId, status }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("form-webhook error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
