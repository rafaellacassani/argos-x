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
