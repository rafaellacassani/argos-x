import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "npm:stripe@14.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin");

    if (!roles?.length) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action || "list";

    // ──────────────────────────────────────
    // Helper: send WhatsApp invite message
    // ──────────────────────────────────────
    const sendWhatsAppInvite = async (phone: string, name: string, plan: string, link: string) => {
      try {
        const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL");
        const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");
        if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
          console.warn("Evolution API not configured, skipping WhatsApp invite");
          return false;
        }

        // Find the admin's alert instance or any available instance
        const { data: adminMember } = await supabaseAdmin
          .from("workspace_members")
          .select("workspace_id")
          .eq("user_id", user.id)
          .not("accepted_at", "is", null)
          .limit(1)
          .single();

        if (!adminMember) return false;

        // Try alert instance first, then any commercial instance
        const { data: alertWs } = await supabaseAdmin
          .from("workspaces")
          .select("alert_instance_name")
          .eq("id", adminMember.workspace_id)
          .single();

        let instanceName = alertWs?.alert_instance_name;

        if (!instanceName) {
          const { data: instances } = await supabaseAdmin
            .from("whatsapp_instances")
            .select("instance_name")
            .eq("workspace_id", adminMember.workspace_id)
            .limit(1)
            .single();
          instanceName = instances?.instance_name;
        }

        if (!instanceName) {
          console.warn("No WhatsApp instance available for admin workspace");
          return false;
        }

        // Clean phone number
        let cleanPhone = phone.replace(/\D/g, "");
        if (cleanPhone.length >= 10 && !cleanPhone.startsWith("55")) {
          cleanPhone = "55" + cleanPhone;
        }

        const planLabel = plan === "gratuito" ? "Gratuito" : plan.charAt(0).toUpperCase() + plan.slice(1);

        const message = `Olá, ${name}! 👋\n\nSua conta *Argos X* (Plano ${planLabel}) está quase pronta!\n\nClique no link abaixo para concluir seu cadastro:\n${link}\n\nQualquer dúvida, estamos à disposição! 🚀`;

        const apiUrl = EVOLUTION_API_URL.replace(/\/+$/, "");
        const response = await fetch(`${apiUrl}/message/sendText/${instanceName}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: EVOLUTION_API_KEY,
          },
          body: JSON.stringify({
            number: cleanPhone,
            text: message,
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          console.warn("WhatsApp send failed:", response.status, errText);
          return false;
        }

        console.log("WhatsApp invite sent to", cleanPhone);
        return true;
      } catch (e) {
        console.warn("sendWhatsAppInvite failed:", e);
        return false;
      }
    };

    // ──────────────────────────────────────
    // Helper: create lead in admin workspace with tag
    // ──────────────────────────────────────
    const createLeadForInvite = async (adminUserId: string, name: string, email: string, phone: string, plan: string) => {
      try {
        // Get admin's workspace
        const { data: adminMember } = await supabaseAdmin
          .from("workspace_members")
          .select("workspace_id")
          .eq("user_id", adminUserId)
          .not("accepted_at", "is", null)
          .limit(1)
          .single();

        if (!adminMember) return;

        const workspaceId = adminMember.workspace_id;

        // Get default funnel's first stage
        const { data: funnel } = await supabaseAdmin
          .from("funnels")
          .select("id")
          .eq("workspace_id", workspaceId)
          .eq("is_default", true)
          .limit(1)
          .single();

        if (!funnel) return;

        const { data: stage } = await supabaseAdmin
          .from("funnel_stages")
          .select("id")
          .eq("funnel_id", funnel.id)
          .order("position", { ascending: true })
          .limit(1)
          .single();

        if (!stage) return;

        // Create or find tag "convite enviado"
        let tagId: string;
        const { data: existingTag } = await supabaseAdmin
          .from("lead_tags")
          .select("id")
          .eq("workspace_id", workspaceId)
          .eq("name", "convite enviado")
          .limit(1)
          .single();

        if (existingTag) {
          tagId = existingTag.id;
        } else {
          const { data: newTag } = await supabaseAdmin
            .from("lead_tags")
            .insert({ workspace_id: workspaceId, name: "convite enviado", color: "#F59E0B" })
            .select("id")
            .single();
          if (!newTag) return;
          tagId = newTag.id;
        }

        // Check if lead with this phone/email already exists
        const phoneClean = (phone || "").replace(/\D/g, "");
        let existingLead = null;
        if (phoneClean) {
          const { data } = await supabaseAdmin
            .from("leads")
            .select("id")
            .eq("workspace_id", workspaceId)
            .eq("phone", phoneClean)
            .limit(1)
            .single();
          existingLead = data;
        }

        let leadId: string;
        if (existingLead) {
          leadId = existingLead.id;
        } else {
          const { data: newLead } = await supabaseAdmin
            .from("leads")
            .insert({
              workspace_id: workspaceId,
              name,
              phone: phoneClean || "sem-telefone",
              email: email || null,
              stage_id: stage.id,
              source: "admin",
              notes: `Plano: ${plan}`,
              responsible_user: adminUserId,
            })
            .select("id")
            .single();
          if (!newLead) return;
          leadId = newLead.id;
        }

        // Assign tag
        const { data: existingAssignment } = await supabaseAdmin
          .from("lead_tag_assignments")
          .select("id")
          .eq("lead_id", leadId)
          .eq("tag_id", tagId)
          .limit(1)
          .single();

        if (!existingAssignment) {
          await supabaseAdmin
            .from("lead_tag_assignments")
            .insert({ lead_id: leadId, tag_id: tagId, workspace_id: workspaceId });
        }
      } catch (e) {
        console.warn("createLeadForInvite failed:", e);
      }
    };

    // ──────────────────────────────────────
    // ACTION: LIST
    // ──────────────────────────────────────
    if (action === "list") {
      const { data: workspaces, error: wsError } = await supabaseAdmin
        .from("workspaces")
        .select("*")
        .order("created_at", { ascending: false });

      if (wsError) throw wsError;

      const ownerIds = [
        ...new Set((workspaces || []).map((w: any) => w.created_by)),
      ];
      const { data: profiles } = await supabaseAdmin
        .from("user_profiles")
        .select("user_id, full_name, email, phone, personal_whatsapp")
        .in("user_id", ownerIds);

      const profileMap = new Map(
        (profiles || []).map((p: any) => [p.user_id, p])
      );

      const enriched = await Promise.all(
        (workspaces || []).map(async (ws: any) => {
          const [leadResult, memberResult, instanceResult] =
            await Promise.all([
              supabaseAdmin
                .from("leads")
                .select("*", { count: "exact", head: true })
                .eq("workspace_id", ws.id),
              supabaseAdmin
                .from("workspace_members")
                .select("*", { count: "exact", head: true })
                .eq("workspace_id", ws.id)
                .not("accepted_at", "is", null),
              supabaseAdmin
                .from("whatsapp_instances")
                .select("*", { count: "exact", head: true })
                .eq("workspace_id", ws.id),
            ]);

          return {
            ...ws,
            owner: profileMap.get(ws.created_by) || null,
            leads_count: leadResult.count || 0,
            members_count: memberResult.count || 0,
            instances_count: instanceResult.count || 0,
          };
        })
      );

      // Fetch pending invites (no workspace yet)
      const { data: invites } = await supabaseAdmin
        .from("client_invites")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      return new Response(JSON.stringify({ clients: enriched, invites: invites || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ──────────────────────────────────────
    // ACTION: CREATE-CHECKOUT
    // ──────────────────────────────────────
    if (action === "create-checkout") {
      const { plan, email, fullName, phone, successUrl, cancelUrl } = body;

      if (!plan || !email || !fullName) {
        return new Response(
          JSON.stringify({
            error: "Campos obrigatórios: plan, email, fullName",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
        apiVersion: "2023-10-16",
      });

      const priceMap: Record<string, string | undefined> = {
        essencial: Deno.env.get("STRIPE_PRICE_ESSENCIAL"),
        negocio: Deno.env.get("STRIPE_PRICE_NEGOCIO"),
        escala: Deno.env.get("STRIPE_PRICE_ESCALA"),
      };

      const priceId = priceMap[plan];
      if (!priceId) {
        return new Response(
          JSON.stringify({
            error: `Stripe Price ID não configurado para o plano "${plan}". Configure o secret STRIPE_PRICE_${plan.toUpperCase()}.`,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Create Stripe customer
      const customer = await stripe.customers.create({
        email,
        name: fullName,
        phone: phone || undefined,
        metadata: { plan, created_by_admin: user.id },
      });

      // Create checkout session
      const session = await stripe.checkout.sessions.create({
        customer: customer.id,
        payment_method_types: ["card"],
        line_items: [{ price: priceId, quantity: 1 }],
        mode: "subscription",
        subscription_data: {
          trial_period_days: 7,
          metadata: { plan, admin_created: "true" },
        },
        success_url:
          successUrl || "https://argosx.com.br/auth",
        cancel_url:
          cancelUrl || "https://argosx.com.br/admin/clients",
      });

      // Send email with checkout link via Resend
      let emailSent = false;
      const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
      if (RESEND_API_KEY && session.url) {
        try {
          const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
          const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
          const emailRes = await fetch(`${supabaseUrl}/functions/v1/send-onboarding-email`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${serviceRoleKey}`,
            },
            body: JSON.stringify({
              to: email,
              fullName,
              checkoutUrl: session.url,
              plan,
            }),
          });
          const emailData = await emailRes.json();
          emailSent = !!emailData?.success;
        } catch (e) {
          console.warn("Failed to send onboarding email:", e);
        }
      }

      // Save invite record
      await supabaseAdmin.from("client_invites").insert({
        email,
        full_name: fullName,
        phone: phone || null,
        plan,
        invite_type: "checkout",
        status: "pending",
        checkout_url: session.url,
        stripe_customer_id: customer.id,
        created_by: user.id,
      });

      // Auto-create lead in admin's funnel with tag "convite enviado"
      await createLeadForInvite(user.id, fullName, email, phone || "", plan);

      // Send WhatsApp invite if phone is provided
      let whatsappSent = false;
      if (phone && session.url) {
        whatsappSent = await sendWhatsAppInvite(phone, fullName, plan, session.url);
      }

      return new Response(
        JSON.stringify({
          url: session.url,
          customerId: customer.id,
          sessionId: session.id,
          emailSent,
          whatsappSent,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ──────────────────────────────────────
    // ACTION: LINK-STRIPE
    // ──────────────────────────────────────
    if (action === "link-stripe") {
      const { workspaceId, stripeCustomerId } = body;
      if (!workspaceId || !stripeCustomerId) {
        return new Response(
          JSON.stringify({ error: "workspaceId and stripeCustomerId required" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const { error: updateError } = await supabaseAdmin
        .from("workspaces")
        .update({ stripe_customer_id: stripeCustomerId })
        .eq("id", workspaceId);

      if (updateError) throw updateError;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ──────────────────────────────────────
    // ACTION: CREATE-FREE-WORKSPACE
    // ──────────────────────────────────────
    if (action === "create-free-workspace") {
      const { email, fullName, phone } = body;

      if (!email || !fullName) {
        return new Response(
          JSON.stringify({ error: "Campos obrigatórios: email, fullName" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // 1. Create or find user
      let userId: string;
      const randomPassword = crypto.randomUUID() + "Aa1!";

      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: randomPassword,
        email_confirm: true,
      });

      if (createError) {
        if (createError.message?.includes("already been registered") || createError.message?.includes("already exists")) {
          const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1, page: 1 });
          const found = listData?.users?.find((u: any) => u.email === email);
          if (!found) {
            // Search more broadly
            const { data: allUsers } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
            const foundUser = allUsers?.users?.find((u: any) => u.email === email);
            if (!foundUser) {
              return new Response(
                JSON.stringify({ error: "Usuário existe mas não foi possível localizar." }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
            userId = foundUser.id;
          } else {
            userId = found.id;
          }
        } else {
          throw createError;
        }
      } else {
        userId = newUser.user.id;
      }

      // 2. Create user_profiles (upsert)
      await supabaseAdmin.from("user_profiles").upsert(
        { user_id: userId, full_name: fullName, email, phone: phone || null },
        { onConflict: "user_id" }
      );

      // 3. Create workspace
      const slug = fullName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");

      const { data: workspace, error: wsError } = await supabaseAdmin
        .from("workspaces")
        .insert({
          name: fullName,
          slug: `${slug}-${Date.now()}`,
          created_by: userId,
          plan_name: "gratuito",
          plan_type: "active",
          subscription_status: "active",
          lead_limit: 300,
          whatsapp_limit: 1,
          user_limit: 1,
          ai_interactions_limit: 100,
        })
        .select()
        .single();

      if (wsError) throw wsError;

      // 4. Add user as admin member
      await supabaseAdmin.from("workspace_members").insert({
        workspace_id: workspace.id,
        user_id: userId,
        role: "admin",
        accepted_at: new Date().toISOString(),
      });

      // 5. Create default funnel + stages
      const { data: funnel } = await supabaseAdmin
        .from("funnels")
        .insert({ name: "Funil de Vendas", workspace_id: workspace.id, is_default: true })
        .select()
        .single();

      if (funnel) {
        const defaultStages = [
          { name: "Leads de Entrada", color: "#6B7280", position: 0 },
          { name: "Em Qualificação", color: "#0171C3", position: 1 },
          { name: "Lixo", color: "#EF4444", position: 2, is_loss_stage: true },
          { name: "Reunião Agendada", color: "#F59E0B", position: 3 },
          { name: "Venda Realizada", color: "#22C55E", position: 4, is_win_stage: true },
          { name: "No Show", color: "#8B5CF6", position: 5 },
        ];

        for (const stage of defaultStages) {
          await supabaseAdmin.from("funnel_stages").insert({
            funnel_id: funnel.id,
            workspace_id: workspace.id,
            ...stage,
          });
        }
      }

      // 6. Generate password reset link for the client
      let recoveryLink = null;
      try {
        const redirectBase = body.redirectTo || "https://argosx.com.br";
        const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
          type: "recovery",
          email,
          options: {
            redirectTo: `${redirectBase}/auth/reset-password`,
          },
        });
        if (linkData?.properties?.action_link) {
          recoveryLink = linkData.properties.action_link;
        }
      } catch (e) {
        console.warn("Could not generate recovery link:", e);
      }

      // Save invite record (completed since workspace was created immediately)
      await supabaseAdmin.from("client_invites").insert({
        email,
        full_name: fullName,
        phone: phone || null,
        plan: "gratuito",
        invite_type: "free",
        status: "completed",
        workspace_id: workspace.id,
        created_by: user.id,
      });

      // Auto-create lead in admin's funnel with tag "convite enviado"
      await createLeadForInvite(user.id, fullName, email, phone || "", "gratuito");

      // Send WhatsApp invite if phone is provided
      let whatsappSent = false;
      if (phone && recoveryLink) {
        whatsappSent = await sendWhatsAppInvite(phone, fullName, "gratuito", recoveryLink);
      }

      return new Response(
        JSON.stringify({ success: true, workspace, recoveryLink, whatsappSent }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ──────────────────────────────────────
    // ACTION: RESEND-INVITE
    // ──────────────────────────────────────
    if (action === "resend-invite") {
      const { email } = body;
      if (!email) {
        return new Response(
          JSON.stringify({ error: "email required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let recoveryLink = null;
      try {
        const redirectBase = body.redirectTo || "https://argosx.com.br";
        const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
          type: "recovery",
          email,
          options: {
            redirectTo: `${redirectBase}/auth/reset-password`,
          },
        });
        if (linkData?.properties?.action_link) {
          recoveryLink = linkData.properties.action_link;
        }
      } catch (e) {
        console.warn("Could not generate recovery link:", e);
      }

      if (!recoveryLink) {
        return new Response(
          JSON.stringify({ error: "Não foi possível gerar link de recuperação." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, recoveryLink }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ──────────────────────────────────────
    // ACTION: DELETE-WORKSPACE
    // ──────────────────────────────────────
    if (action === "delete-workspace") {
      const { workspaceId } = body;
      if (!workspaceId) {
        return new Response(
          JSON.stringify({ error: "workspaceId required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // 1. Cancel Stripe subscription if exists
      const { data: wsData } = await supabaseAdmin
        .from("workspaces")
        .select("stripe_customer_id, stripe_subscription_id, created_by")
        .eq("id", workspaceId)
        .single();

      if (wsData) {
        const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
        if (stripeKey && (wsData.stripe_subscription_id || wsData.stripe_customer_id)) {
          try {
            const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

            // Cancel subscription directly if we have the ID
            if (wsData.stripe_subscription_id) {
              try {
                await stripe.subscriptions.cancel(wsData.stripe_subscription_id);
                console.log("Stripe subscription canceled:", wsData.stripe_subscription_id);
              } catch (e) {
                console.warn("Failed to cancel subscription:", e);
              }
            }

            // Also cancel any active subscriptions on the customer
            if (wsData.stripe_customer_id) {
              try {
                const subs = await stripe.subscriptions.list({
                  customer: wsData.stripe_customer_id,
                  status: "active",
                  limit: 10,
                });
                for (const sub of subs.data) {
                  await stripe.subscriptions.cancel(sub.id);
                  console.log("Canceled active subscription:", sub.id);
                }
                // Also cancel trialing subscriptions
                const trialSubs = await stripe.subscriptions.list({
                  customer: wsData.stripe_customer_id,
                  status: "trialing",
                  limit: 10,
                });
                for (const sub of trialSubs.data) {
                  await stripe.subscriptions.cancel(sub.id);
                  console.log("Canceled trialing subscription:", sub.id);
                }
              } catch (e) {
                console.warn("Failed to list/cancel customer subscriptions:", e);
              }
            }
          } catch (e) {
            console.warn("Stripe cleanup failed:", e);
          }
        }
      }

      // 2. Delete all dependent data in order
      const tables = [
        "reactivation_log",
        "agent_followup_queue", "agent_executions", "agent_memories", "agent_attachments", "ai_agents",
        "bot_execution_logs", "salesbots",
        "campaign_recipients", "campaigns",
        "lead_tag_assignments", "lead_proposals", "lead_sales", "lead_history", "leads",
        "funnel_stages", "funnels",
        "whatsapp_messages", "whatsapp_cloud_connections", "whatsapp_templates", "whatsapp_instances",
        "calendar_events", "google_calendar_tokens",
        "emails", "email_accounts",
        "notification_preferences", "notification_settings",
        "scheduled_messages", "tag_rules", "lead_tags",
        "stage_automation_queue", "stage_automations",
        "meta_conversations", "meta_pages", "meta_accounts",
        "alert_log", "lead_packs",
        "user_sessions", "webhook_message_log",
      ];

      for (const table of tables) {
        await supabaseAdmin.from(table).delete().eq("workspace_id", workspaceId);
      }

      // 3. Get members before deleting membership
      const { data: members } = await supabaseAdmin
        .from("workspace_members")
        .select("user_id")
        .eq("workspace_id", workspaceId);

      const memberUserIds = (members || []).map((m: any) => m.user_id);

      // Delete workspace members
      await supabaseAdmin.from("workspace_members").delete().eq("workspace_id", workspaceId);

      // Delete client invites linked to this workspace
      await supabaseAdmin.from("client_invites").delete().eq("workspace_id", workspaceId);

      // 4. Delete workspace itself
      const { error: delError } = await supabaseAdmin
        .from("workspaces")
        .delete()
        .eq("id", workspaceId);

      if (delError) throw delError;

      // 5. Clean up orphaned users (only if they don't belong to other workspaces)
      for (const uid of memberUserIds) {
        const { count } = await supabaseAdmin
          .from("workspace_members")
          .select("*", { count: "exact", head: true })
          .eq("user_id", uid);

        if (count === 0) {
          // No other workspace memberships — clean up user data
          await supabaseAdmin.from("user_roles").delete().eq("user_id", uid);
          await supabaseAdmin.from("user_profiles").delete().eq("user_id", uid);
          // Delete auth user
          try {
            await supabaseAdmin.auth.admin.deleteUser(uid);
            console.log("Deleted auth user:", uid);
          } catch (e) {
            console.warn("Failed to delete auth user:", uid, e);
          }
        }
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ──────────────────────────────────────
    // ACTION: UPDATE-LIMITS
    // ──────────────────────────────────────
    if (action === "update-limits") {
      const { workspaceId, leadLimit, extraLeads, whatsappLimit, userLimit, aiInteractionsLimit } = body;
      if (!workspaceId) {
        return new Response(
          JSON.stringify({ error: "workspaceId required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const updates: Record<string, number> = {};
      if (leadLimit !== undefined) updates.lead_limit = Number(leadLimit);
      if (extraLeads !== undefined) updates.extra_leads = Number(extraLeads);
      if (whatsappLimit !== undefined) updates.whatsapp_limit = Number(whatsappLimit);
      if (userLimit !== undefined) updates.user_limit = Number(userLimit);
      if (aiInteractionsLimit !== undefined) updates.ai_interactions_limit = Number(aiInteractionsLimit);

      if (Object.keys(updates).length === 0) {
        return new Response(
          JSON.stringify({ error: "No limits to update" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: updateError } = await supabaseAdmin
        .from("workspaces")
        .update(updates)
        .eq("id", workspaceId);

      if (updateError) throw updateError;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ──────────────────────────────────────
    // ACTION: UPDATE-WORKSPACE
    // ──────────────────────────────────────
    if (action === "update-workspace") {
      const { workspaceId, name, ownerEmail, ownerPhone, ownerName } = body;
      if (!workspaceId) {
        return new Response(
          JSON.stringify({ error: "workspaceId required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update workspace name
      if (name) {
        await supabaseAdmin.from("workspaces").update({ name }).eq("id", workspaceId);
      }

      // Update owner profile
      const { data: ws } = await supabaseAdmin
        .from("workspaces")
        .select("created_by")
        .eq("id", workspaceId)
        .single();

      if (ws?.created_by) {
        const updates: Record<string, string> = {};
        if (ownerName) updates.full_name = ownerName;
        if (ownerEmail) updates.email = ownerEmail;
        if (ownerPhone) updates.phone = ownerPhone;

        if (Object.keys(updates).length > 0) {
          await supabaseAdmin
            .from("user_profiles")
            .update(updates)
            .eq("user_id", ws.created_by);
        }

        // Update auth email if changed
        if (ownerEmail) {
          await supabaseAdmin.auth.admin.updateUserById(ws.created_by, { email: ownerEmail });
        }
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ──────────────────────────────────────
    // ACTION: GET-WORKSPACE (for admin view)
    // ──────────────────────────────────────
    if (action === "get-workspace") {
      const { workspaceId } = body;
      if (!workspaceId) {
        return new Response(JSON.stringify({ error: "workspaceId required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: ws, error: wsError } = await supabaseAdmin
        .from("workspaces")
        .select("*")
        .eq("id", workspaceId)
        .single();

      if (wsError || !ws) {
        return new Response(JSON.stringify({ error: "Workspace not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ workspace: ws }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ──────────────────────────────────────
    // ACTION: BULK-WHATSAPP
    // ──────────────────────────────────────
    if (action === "bulk-whatsapp") {
      const { workspaceIds, message, instanceName } = body;
      if (!workspaceIds?.length || !message || !instanceName) {
        return new Response(JSON.stringify({ error: "workspaceIds, message, and instanceName required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL");
      const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");
      if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
        return new Response(JSON.stringify({ error: "Evolution API not configured" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get owner phones for each workspace
      const ownerIds: string[] = [];
      const wsOwnerMap = new Map<string, string>();

      const { data: workspaces } = await supabaseAdmin
        .from("workspaces")
        .select("id, created_by, name")
        .in("id", workspaceIds);

      for (const ws of workspaces || []) {
        ownerIds.push(ws.created_by);
        wsOwnerMap.set(ws.id, ws.created_by);
      }

      const { data: profiles } = await supabaseAdmin
        .from("user_profiles")
        .select("user_id, full_name, phone, personal_whatsapp")
        .in("user_id", [...new Set(ownerIds)]);

      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));

      const apiUrl = EVOLUTION_API_URL.replace(/\/+$/, "");
      let sent = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const ws of workspaces || []) {
        const profile = profileMap.get(ws.created_by);
        const phone = profile?.personal_whatsapp || profile?.phone;
        if (!phone) {
          errors.push(`${ws.name}: sem telefone`);
          failed++;
          continue;
        }

        let cleanPhone = phone.replace(/\D/g, "");
        if (cleanPhone.length >= 10 && !cleanPhone.startsWith("55")) {
          cleanPhone = "55" + cleanPhone;
        }

        const personalizedMessage = message
          .replace(/{nome}/g, profile?.full_name || ws.name)
          .replace(/{workspace}/g, ws.name);

        try {
          const response = await fetch(`${apiUrl}/message/sendText/${instanceName}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: EVOLUTION_API_KEY,
            },
            body: JSON.stringify({
              number: cleanPhone,
              text: personalizedMessage,
            }),
          });

          if (!response.ok) {
            const errText = await response.text();
            errors.push(`${ws.name}: ${errText}`);
            failed++;
          } else {
            sent++;
          }

          // Interval between messages
          await new Promise(r => setTimeout(r, 2000));
        } catch (e) {
          errors.push(`${ws.name}: ${e.message}`);
          failed++;
        }
      }

      return new Response(JSON.stringify({ sent, failed, errors }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ──────────────────────────────────────
    // ACTION: HEALTH-MONITORING
    // ──────────────────────────────────────
    if (action === "health-monitoring") {
      const { data: workspaces } = await supabaseAdmin
        .from("workspaces")
        .select("id, name, plan_type, plan_name, subscription_status, trial_end, blocked_at, lead_limit, extra_leads, ai_interactions_limit, ai_interactions_used")
        .order("created_at", { ascending: false });

      if (!workspaces?.length) {
        return new Response(JSON.stringify({ workspaces: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Fetch all data in parallel
      const wsIds = workspaces.map((w: any) => w.id);

      const [
        leadsRes,
        membersRes,
        agentsRes,
        evoInstancesRes,
        wabaRes,
        executionsRes,
        allTokensRes,
        executions30dRes,
        profilesRes,
      ] = await Promise.all([
        supabaseAdmin.from("leads").select("workspace_id", { count: "exact" }).in("workspace_id", wsIds),
        supabaseAdmin.from("workspace_members").select("workspace_id, user_id, role").in("workspace_id", wsIds).not("accepted_at", "is", null),
        supabaseAdmin.from("ai_agents").select("id, name, model, is_active, workspace_id").in("workspace_id", wsIds),
        supabaseAdmin.from("whatsapp_instances").select("instance_name, display_name, workspace_id").in("workspace_id", wsIds),
        supabaseAdmin.from("whatsapp_cloud_connections").select("id, inbox_name, phone_number, workspace_id, status, is_active").in("workspace_id", wsIds),
        supabaseAdmin.from("agent_executions").select("agent_id, workspace_id, executed_at, status").in("workspace_id", wsIds).gte("executed_at", yesterday.toISOString()),
        supabaseAdmin.from("agent_executions").select("agent_id, workspace_id, tokens_used").in("workspace_id", wsIds),
        supabaseAdmin.from("agent_executions").select("agent_id, workspace_id, tokens_used").in("workspace_id", wsIds).gte("executed_at", thirtyDaysAgo.toISOString()),
        supabaseAdmin.from("user_profiles").select("user_id, full_name, phone, email"),
      ]);

      // Count leads per workspace
      // We need individual counts, so let's do it differently
      const leadCountsMap = new Map<string, number>();
      const memberCountsMap = new Map<string, number>();
      
      // Get leads count per workspace
      for (const wsId of wsIds) {
        const { count } = await supabaseAdmin.from("leads").select("*", { count: "exact", head: true }).eq("workspace_id", wsId);
        leadCountsMap.set(wsId, count || 0);
      }

      // Count members per workspace & find owner (admin) per workspace
      const membersData = membersRes.data || [];
      const profilesByUserId = new Map<string, any>();
      for (const p of (profilesRes.data || [])) {
        profilesByUserId.set(p.user_id, p);
      }
      const ownerByWs = new Map<string, any>();
      for (const m of membersData) {
        memberCountsMap.set(m.workspace_id, (memberCountsMap.get(m.workspace_id) || 0) + 1);
        if (m.role === "admin" && !ownerByWs.has(m.workspace_id)) {
          const profile = profilesByUserId.get(m.user_id);
          if (profile) {
            ownerByWs.set(m.workspace_id, { name: profile.full_name, phone: profile.phone, email: profile.email });
          }
        }
      }

      // Group agents by workspace
      const agentsByWs = new Map<string, any[]>();
      for (const a of (agentsRes.data || [])) {
        const arr = agentsByWs.get(a.workspace_id) || [];
        arr.push(a);
        agentsByWs.set(a.workspace_id, arr);
      }

      // Group executions by agent (24h)
      const execByAgent = new Map<string, number>();
      const respondedAgents = new Set<string>();
      for (const e of (executionsRes.data || [])) {
        execByAgent.set(e.agent_id, (execByAgent.get(e.agent_id) || 0) + 1);
        if (e.status === "success") respondedAgents.add(e.agent_id);
      }

      // Total tokens by agent (all time)
      const tokensByAgent = new Map<string, number>();
      const tokensByWs = new Map<string, number>();
      for (const e of (allTokensRes.data || [])) {
        const t = e.tokens_used || 0;
        tokensByAgent.set(e.agent_id, (tokensByAgent.get(e.agent_id) || 0) + t);
        tokensByWs.set(e.workspace_id, (tokensByWs.get(e.workspace_id) || 0) + t);
      }

      // Cost estimation: USD per 1K tokens by model family, then convert to BRL
      const USD_TO_BRL = 5.50;
      const costPer1kTokens = (model: string): number => {
        const m = (model || "").toLowerCase();
        if (m.includes("gpt-4o-mini") || m.includes("gpt-5-mini") || m.includes("gpt-5-nano")) return 0.0003;
        if (m.includes("gpt-4o") || m.includes("gpt-5") || m.includes("gpt-4")) return 0.005;
        if (m.includes("gemini") && m.includes("flash")) return 0.0001;
        if (m.includes("gemini") && m.includes("pro")) return 0.001;
        if (m.includes("claude") && m.includes("haiku")) return 0.0003;
        if (m.includes("claude")) return 0.003;
        return 0.0004; // default fallback
      };

      // Check Evolution API connection status
      const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL");
      const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");
      
      let evoStatusMap = new Map<string, string>();
      if (EVOLUTION_API_URL && EVOLUTION_API_KEY) {
        try {
          const apiUrl = EVOLUTION_API_URL.replace(/\/+$/, "");
          const res = await fetch(`${apiUrl}/instance/fetchInstances`, {
            headers: { apikey: EVOLUTION_API_KEY },
          });
          if (res.ok) {
            const instances = await res.json();
            console.log("[health] Evolution fetchInstances sample:", JSON.stringify(instances?.[0] || {}).slice(0, 500));
            for (const inst of instances) {
              // Evolution API v2: { name: "xxx", connectionStatus: "open"|"close"|"connecting" }
              const name = inst.name || inst.instance?.instanceName || inst.instanceName;
              const state = inst.connectionStatus || inst.instance?.state || inst.state || "close";
              const normalizedState = (typeof state === "string" && state.toLowerCase() === "open") ? "connected" : "disconnected";
              if (name) {
                evoStatusMap.set(name, normalizedState);
              }
            }
            console.log("[health] evoStatusMap entries:", [...evoStatusMap.entries()]);
          } else {
            console.warn("[health] Evolution API returned status:", res.status);
          }
        } catch (e) {
          console.warn("Failed to fetch Evolution instances:", e);
        }
      }

      // Build response
      const result = workspaces.map((ws: any) => {
        const agents = (agentsByWs.get(ws.id) || []).map((a: any) => {
          const agentTokens = tokensByAgent.get(a.id) || 0;
          const agentCostUsd = (agentTokens / 1000) * costPer1kTokens(a.model || "");
          const agentCostBrl = agentCostUsd * USD_TO_BRL;
          return {
            id: a.id,
            name: a.name,
            model: a.model || "N/A",
            is_active: !!a.is_active,
            interactions_24h: execByAgent.get(a.id) || 0,
            responded_24h: respondedAgents.has(a.id),
            tokens_total: agentTokens,
            cost_brl: Math.round(agentCostBrl * 100) / 100,
          };
        });

        // Workspace-level token totals
        const wsTokensTotal = tokensByWs.get(ws.id) || 0;
        const wsCostBrl = agents.reduce((sum: number, a: any) => sum + a.cost_brl, 0);

        const evoInstances = (evoInstancesRes.data || [])
          .filter((i: any) => i.workspace_id === ws.id)
          .map((i: any) => ({
            instance_name: i.instance_name,
            display_name: i.display_name,
            type: "evolution" as const,
            status: evoStatusMap.get(i.instance_name) || "disconnected",
          }));

        const wabaInstances = (wabaRes.data || [])
          .filter((i: any) => i.workspace_id === ws.id)
          .map((i: any) => ({
            instance_name: i.id,
            display_name: i.inbox_name || i.phone_number,
            type: "waba" as const,
            status: i.is_active ? (i.status === "active" ? "connected" : "disconnected") : "disconnected",
          }));

        const instances = [...evoInstances, ...wabaInstances];

        // Build alerts
        const alerts: string[] = [];
        const totalLeadLimit = (ws.lead_limit || 0) + (ws.extra_leads || 0);
        const leadPct = totalLeadLimit > 0 ? ((leadCountsMap.get(ws.id) || 0) / totalLeadLimit) * 100 : 0;
        const aiPct = (ws.ai_interactions_limit || 0) > 0 ? ((ws.ai_interactions_used || 0) / ws.ai_interactions_limit) * 100 : 0;

        if (leadPct > 90) alerts.push(`Leads ${Math.round(leadPct)}%`);
        if (aiPct > 90) alerts.push(`IA ${Math.round(aiPct)}%`);
        
        for (const inst of instances) {
          if (inst.status === "disconnected" || inst.status === "error") {
            alerts.push(`${inst.display_name || inst.instance_name} desconectado`);
          }
        }

        for (const agent of agents) {
          if (agent.is_active && !agent.responded_24h && agent.interactions_24h === 0) {
            // Check if agent has had no activity - we flag after 48h but use 24h data as proxy
            alerts.push(`${agent.name} sem atividade`);
          }
        }

        return {
          id: ws.id,
          name: ws.name,
          plan_type: ws.plan_type,
          plan_name: ws.plan_name,
          subscription_status: ws.subscription_status,
          trial_end: ws.trial_end,
          blocked_at: ws.blocked_at,
          leads_used: leadCountsMap.get(ws.id) || 0,
          lead_limit: ws.lead_limit || 0,
          extra_leads: ws.extra_leads || 0,
          ai_used: ws.ai_interactions_used || 0,
          ai_limit: ws.ai_interactions_limit || 0,
          members_count: memberCountsMap.get(ws.id) || 0,
          owner: ownerByWs.get(ws.id) || null,
          agents,
          instances,
          alerts,
          tokens_total: wsTokensTotal,
          cost_estimate_brl: Math.round(wsCostBrl * 100) / 100,
        };
      });

      return new Response(JSON.stringify({ workspaces: result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ──────────────────────────────────────
    // ACTION: EXECUTIVE-DASHBOARD
    // ──────────────────────────────────────
    if (action === "executive-dashboard") {
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      const monthStart = new Date(currentYear, currentMonth, 1).toISOString();

      // Fetch all workspaces
      const { data: allWorkspaces } = await supabaseAdmin
        .from("workspaces")
        .select("id, name, plan_type, plan_name, subscription_status, trial_end, blocked_at, created_at, created_by, lead_limit, extra_leads, ai_interactions_limit, ai_interactions_used, stripe_customer_id, stripe_subscription_id");

      const workspaces = allWorkspaces || [];

      // Fetch owner profiles
      const creatorIds = [...new Set(workspaces.map(w => w.created_by).filter(Boolean))];
      const { data: profiles } = await supabaseAdmin
        .from("user_profiles")
        .select("id, user_id, full_name, email, phone, personal_whatsapp")
        .in("user_id", creatorIds.length > 0 ? creatorIds : ["__none__"]);
      const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));

      // Lead counts per workspace
      const { data: leadCounts } = await supabaseAdmin
        .from("leads")
        .select("workspace_id")
        .eq("status", "active");
      const leadCountMap = new Map<string, number>();
      (leadCounts || []).forEach(l => {
        leadCountMap.set(l.workspace_id, (leadCountMap.get(l.workspace_id) || 0) + 1);
      });

      // Classify
      const paidPlans = ["essencial", "negocio", "escala"];
      const planPrices: Record<string, number> = { essencial: 47.90, negocio: 97.90, escala: 197.90, gratuito: 0 };
      const activeClients = workspaces.filter(w => paidPlans.includes(w.plan_type || "") && w.subscription_status === "active" && !w.blocked_at);
      const trialsActive = workspaces.filter(w => w.subscription_status === "trialing" && w.trial_end && new Date(w.trial_end) > now);
      const currentMRR = activeClients.reduce((sum, w) => sum + (planPrices[w.plan_type || "gratuito"] || 0), 0);

      // Churn this month
      const churnedThisMonth = workspaces.filter(w => {
        if (!w.blocked_at) return false;
        const blocked = new Date(w.blocked_at);
        return blocked.getMonth() === currentMonth && blocked.getFullYear() === currentYear;
      });
      const churnValue = churnedThisMonth.reduce((sum, w) => sum + (planPrices[w.plan_type || "gratuito"] || 0), 0);

      // Trials expiring in 7 days
      const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const trialsExpiring = trialsActive.filter(w => {
        const end = new Date(w.trial_end!);
        return end <= sevenDays && end > now;
      }).map(w => {
        const profile = profileMap.get(w.created_by);
        const daysLeft = Math.ceil((new Date(w.trial_end!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return { id: w.id, name: w.name, email: profile?.email || "", phone: profile?.phone || profile?.personal_whatsapp || "", days_left: daysLeft, trial_end: w.trial_end };
      });

      // Clients at plan limit (>90%)
      const atLimit = activeClients.filter(w => {
        const leadsUsed = leadCountMap.get(w.id) || 0;
        const totalLeadLimit = (w.lead_limit || 0) + (w.extra_leads || 0);
        const aiUsed = w.ai_interactions_used || 0;
        const aiLimit = w.ai_interactions_limit || 0;
        return (totalLeadLimit > 0 && leadsUsed / totalLeadLimit > 0.9) || (aiLimit > 0 && aiUsed / aiLimit > 0.9);
      }).map(w => {
        const profile = profileMap.get(w.created_by);
        const leadsUsed = leadCountMap.get(w.id) || 0;
        const totalLeadLimit = (w.lead_limit || 0) + (w.extra_leads || 0);
        return { id: w.id, name: w.name, plan: w.plan_type, email: profile?.email || "", phone: profile?.phone || profile?.personal_whatsapp || "", leads_used: leadsUsed, lead_limit: totalLeadLimit, ai_used: w.ai_interactions_used || 0, ai_limit: w.ai_interactions_limit || 0 };
      });

      // MRR history (last 6 months)
      const mrrHistory: { month: string; mrr: number; clients: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const m = new Date(currentYear, currentMonth - i, 1);
        const label = `${String(m.getMonth() + 1).padStart(2, "0")}/${m.getFullYear()}`;
        if (i === 0) {
          mrrHistory.push({ month: label, mrr: currentMRR, clients: activeClients.length });
        } else {
          const monthEnd = new Date(m.getFullYear(), m.getMonth() + 1, 0);
          const activeBefore = workspaces.filter(w => {
            const created = new Date(w.created_at);
            return created <= monthEnd && paidPlans.includes(w.plan_type || "") && (!w.blocked_at || new Date(w.blocked_at) > monthEnd);
          });
          const mrr = activeBefore.reduce((s, w) => s + (planPrices[w.plan_type || "gratuito"] || 0), 0);
          mrrHistory.push({ month: label, mrr, clients: activeBefore.length });
        }
      }

      // Plan distribution
      const planDistribution = Object.entries(planPrices).map(([plan, price]) => {
        const count = activeClients.filter(w => w.plan_type === plan).length;
        return { plan, count, mrr: count * price };
      }).filter(p => p.count > 0 || p.plan !== "gratuito");

      // Funnel
      const signupsThisMonth = workspaces.filter(w => new Date(w.created_at) >= new Date(monthStart));
      const trialsThisMonth = signupsThisMonth.filter(w => w.subscription_status === "trialing" || w.subscription_status === "active");
      const convertedThisMonth = signupsThisMonth.filter(w => paidPlans.includes(w.plan_type || "") && w.subscription_status === "active");

      // New clients this month
      const newClientsThisMonth = signupsThisMonth.map(w => {
        const profile = profileMap.get(w.created_by);
        return { id: w.id, name: w.name, created_at: w.created_at, plan: w.plan_type, status: w.subscription_status, email: profile?.email || "", phone: profile?.phone || profile?.personal_whatsapp || "" };
      });

      const prevMRR = mrrHistory.length >= 2 ? mrrHistory[mrrHistory.length - 2].mrr : 0;
      const mrrVariation = prevMRR > 0 ? ((currentMRR - prevMRR) / prevMRR) * 100 : 0;

      return new Response(JSON.stringify({
        current_mrr: currentMRR, mrr_variation: mrrVariation,
        active_clients: activeClients.length, active_trials: trialsActive.length,
        churn_count: churnedThisMonth.length, churn_value: churnValue,
        trials_expiring: trialsExpiring, at_limit: atLimit,
        mrr_history: mrrHistory, plan_distribution: planDistribution,
        funnel: { signups: signupsThisMonth.length, trials: trialsThisMonth.length, converted: convertedThisMonth.length, conversion_rate: signupsThisMonth.length > 0 ? (convertedThisMonth.length / signupsThisMonth.length) * 100 : 0 },
        new_clients: newClientsThisMonth,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("admin-clients error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
